// src/modules/renting/services/lease.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository, DataSource, EntityManager } from 'typeorm';
import { Lease } from '../../entities/lease.entity';
import { Application } from '../../entities/application.entity';

import { ContractService } from '../contract/contract.service';

import { Transaction } from '../../entities/transaction.entity';
import { LedgerCategory } from '../../../finance/entities/wallet.entity';
import { LedgerService } from '../../../finance/services/ledger/ledger.service';
import { PayoutService } from '../../../finance/services/payout/payout.service';
import {
  PropertyStatus,
  Property,
} from '../../../properties/entities/property.entity';

@Injectable()
export class LeaseService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Lease) private leaseRepo: Repository<Lease>,
    @InjectRepository(Application) private appRepo: Repository<Application>,
    private contractService: ContractService,
    private ledgerService: LedgerService,
    private payoutService: PayoutService,
  ) {}

  async prepareLease(applicationId: string, renterId: string) {
    // 1. Fetch application with full relations
    const app = await this.appRepo.findOne({
      where: { id: applicationId, renter_id: renterId },
      relations: ['property', 'property.owner', 'renter'],
    });

    if (!app) throw new NotFoundException('Application not found.');

    // 2. Idempotency Check: Return existing if already prepared
    if (app.lease_id) {
      return await this.leaseRepo.findOne({ where: { id: app.lease_id } });
    }

    // 3. Prevent Multiple Active Tenancies
    // const existingActiveLease = await this.leaseRepo.findOne({
    //   where: { renterId: app.renter_id, isActive: true },
    // });
    // if (existingActiveLease) {
    //   throw new BadRequestException('You already have an active lease.');
    // }

    // 4. Property Availability Check
    if (app.property.status === PropertyStatus.RENTED) {
      throw new BadRequestException('This property has already been taken.');
    }

    // 5. Generate Lease Record
    const lease = this.leaseRepo.create({
      propertyId: app.property_id,
      ownerId: app.property.ownerId,
      renterId: app.renter_id,
      rent: app.property.price,
      startDate: new Date(),
      isActive: false,
    });

    const savedLease = await this.leaseRepo.save(lease);

    // 6. Generate PDF Document
    try {
      const contractUrl = await this.contractService.generateLeasePDF({
        leaseId: savedLease.id,
        ownerName: `${app.property.owner.firstName} ${app.property.owner.lastName}`,
        renterName: `${app.renter.firstName} ${app.renter.lastName}`,
        propertyTitle: app.property.title,
        amount: app.property.price,
        currency: app.property.currency || '₦',
        agreementContent: app.property.agreementContent,
        address: app.property.addressFull,
      });

      // 7. Update Lease with URL
      savedLease.contractUrl = contractUrl;
      await this.leaseRepo.save(savedLease);

      // 8. LINK TO APPLICATION (Crucial for frontend)
      await this.appRepo.update(applicationId, {
        lease_id: savedLease.id,
        contract_url: savedLease.contractUrl,
      });

      return savedLease;
    } catch (error) {
      console.error('PDF Generation failed:', error);
      throw new InternalServerErrorException(
        'Could not generate lease document.',
      );
    }
  }

  async completeRental(leaseId: string, paymentRef: string, userId: string) {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. LOCK ONLY THE LEASE (No relations here to avoid the JOIN error)
      const lease = await manager.findOne(Lease, {
        where: { id: leaseId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lease || lease.isActive) {
        throw new BadRequestException('Lease is invalid or already active');
      }

      // 2. FETCH RELATIONS WITHOUT THE PESSIMISTIC LOCK
      // We fetch these separately so we don't try to lock the "nullable" side of joins
      const leaseData = await manager.findOne(Lease, {
        where: { id: leaseId },
        relations: [
          'property',
          'property.owner',
          'property.owner.bankDetail',
          'renter',
        ],
      });

      if (!leaseData?.property?.owner?.bankDetail) {
        throw new BadRequestException('Owner bank details missing.');
      }

      // 3. FINANCIAL CALCULATIONS
      const totalAmount = Number(lease.rent);
      const platformFee = totalAmount * 0.05;
      const ownerShare = totalAmount - platformFee;

      // 4. SAVE TRANSACTION RECORD
      const tx = await manager.save(Transaction, {
        lease_id: leaseId,
        payer_id: userId,
        amount: totalAmount,
        platform_fee: platformFee,
        payment_gateway_ref: paymentRef,
        status: 'success',
      });

      // 5. UPDATE LEDGERS
      await this.ledgerService.creditUser(
        manager,
        'd7f57c3b-0dd5-4c2b-b551-93887e60ab53',
        platformFee,
        LedgerCategory.PLATFORM_FEE,
        tx.id,
      );

      await this.ledgerService.creditUser(
        manager,
        lease.ownerId,
        ownerShare,
        LedgerCategory.RENT_INCOME,
        tx.id,
      );

      // 6. ACTIVATE LEASE & UPDATE PROPERTY
      await manager.update(Lease, leaseId, { isActive: true });

      await manager.update(Property, lease.propertyId, {
        status: PropertyStatus.RENTED,
      });

      // 7. QUEUE PAYOUT (Using the data from our second fetch)
      await this.payoutService.queueAutoPayout(
        leaseData.property.owner.bankDetail,
        ownerShare,
        tx.id,
        lease.ownerId,
      );

      return {
        success: true,
        message: 'Lease activated successfully.',
        contractUrl: lease.contractUrl,
      };
    });
  }

  async getUserLeases(userId: string) {
    return await this.leaseRepo.find({
      where: { renterId: userId },
      relations: ['property'],
      order: { startDate: 'DESC' },
    });
  }

  async declineLease(leaseId: string, userId: string) {
    const lease = await this.leaseRepo.findOne({
      where: { id: leaseId, renterId: userId },
    });

    if (!lease) throw new NotFoundException('Lease not found');

    if (lease.isActive) {
      throw new BadRequestException('Cannot decline an active lease');
    }

    // Simply delete the draft lease so the user can apply elsewhere
    // This frees up the property for other applicants
    await this.leaseRepo.remove(lease);

    return {
      success: true,
      message: 'Lease offer declined successfully',
    };
  }

  async getLeaseById(id: string): Promise<Lease> {
    const lease = await this.leaseRepo.findOne({
      where: { id },
      relations: ['property'], // Needed to verify details during payment/review
    });

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    return lease;
  }
}
