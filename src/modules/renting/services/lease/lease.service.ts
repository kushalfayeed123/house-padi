// src/modules/renting/services/lease.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Property,
  PropertyStatus,
} from 'src/modules/properties/entities/property.entity';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Lease } from '../../entities/lease.entity';
import { Application } from '../../entities/application.entity';

import { ContractService } from '../contract/contract.service';
import { LedgerService } from 'src/modules/finance/services/ledger/ledger.service';
import { LedgerCategory } from 'src/modules/finance/entities/wallet.entity';
import { Transaction } from '../../entities/transaction.entity';
import { PayoutService } from 'src/modules/finance/services/payout/payout.service';

@Injectable()
export class LeaseService {
  constructor(
    private dataSource: DataSource, // Used for atomic transactions
    @InjectRepository(Lease) private leaseRepo: Repository<Lease>,
    @InjectRepository(Application) private appRepo: Repository<Application>,
    private contractService: ContractService,
    private ledgerService: LedgerService,
    private payoutService: PayoutService,
  ) {}

  async prepareLease(applicationId: string, renterId: string) {
    // 1. Fetch application with full relations for the PDF content
    const app = await this.appRepo.findOne({
      where: { id: applicationId, renter_id: renterId },
      relations: ['property', 'property.owner', 'renter'],
    });

    if (!app) throw new NotFoundException('Application not found.');

    // 2. Validate Application Status
    const allowedStatuses = ['approved', 'screening'];
    if (!allowedStatuses.includes(app.status)) {
      throw new BadRequestException(
        `Application status is '${app.status}'. Must be approved.`,
      );
    }

    // 3. Prevent Multiple Active Tenancies
    const existingActiveLease = await this.leaseRepo.findOne({
      where: { renterId: app.renter_id, isActive: true },
    });
    if (existingActiveLease) {
      throw new BadRequestException('You already have an active lease.');
    }

    // 4. Idempotency Check (Existing Draft)
    const existingDraft = await this.leaseRepo.findOne({
      where: {
        propertyId: app.property_id,
        renterId: app.renter_id,
        isActive: false,
      },
    });
    if (existingDraft) return existingDraft;

    // 5. Property Availability Check
    if (app.property.status === PropertyStatus.RENTED) {
      throw new BadRequestException('This property has already been taken.');
    }

    // 6. Generate the Database Record first
    const lease = this.leaseRepo.create({
      propertyId: app.property_id,
      ownerId: app.property.ownerId,
      renterId: app.renter_id,
      rent: app.property.price,
      startDate: new Date(),
      isActive: false,
    });

    const savedLease = await this.leaseRepo.save(lease);

    // 7. Generate the actual PDF Document
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

      // 8. Update the lease with the real URL
      savedLease.contractUrl = contractUrl;
      return await this.leaseRepo.save(savedLease);
    } catch (error) {
      // If PDF fails, we should probably delete the lease draft or log it
      console.error('PDF Generation failed:', error);
      throw new InternalServerErrorException(
        'Could not generate lease document.',
      );
    }
  }

  async completeRental(leaseId: string, paymentRef: string, userId: string) {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. LOCK THE RECORD
      const leaseLock = await manager.findOne(Lease, {
        where: { id: leaseId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!leaseLock || leaseLock.isActive) {
        throw new BadRequestException(
          'Lease is either invalid or already active',
        );
      }

      // 2. FETCH FULL DATA (Lease, Property, Owner, and Renter)
      const lease = await manager.findOne(Lease, {
        where: { id: leaseId },
        relations: [
          'property',
          'property.owner',
          'property.owner.bankDetail',
          'renter',
        ],
      });

      if (!lease?.property?.owner?.bankDetail) {
        throw new BadRequestException(
          'Owner bank details are missing. Cannot process payout.',
        );
      }

      // 3. FINANCIAL CALCULATIONS
      const totalAmount = Number(lease.rent);
      const platformFee = totalAmount * 0.05;
      const ownerShare = totalAmount - platformFee;

      // 4. GENERATE COMPACT LEGAL PDF

      const contractUrl = await this.contractService.generateLeasePDF({
        leaseId: lease.id,
        ownerName: `${lease.property?.owner?.firstName ?? 'Owner'} ${lease.property?.owner?.lastName ?? ''}`,
        renterName: `${lease.renter?.firstName ?? 'Tenant'} ${lease.renter?.lastName ?? ''}`,
        propertyTitle: lease.property?.title ?? 'Residential Property',
        address: lease.property?.addressFull ?? 'Address not specified',
        amount: totalAmount,
        currency: lease.property?.currency || '₦',
        agreementContent: lease.property?.agreementContent || '',
      });

      // 5. SAVE TRANSACTION RECORD
      const tx = await manager.save(Transaction, {
        lease_id: leaseId,
        payer_id: userId,
        amount: totalAmount,
        platform_fee: platformFee,
        payment_gateway_ref: paymentRef,
        status: 'success',
      });

      // 6. UPDATE LEDGERS
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

      // 7. ACTIVATE LEASE AND UPDATE PROPERTY STATUS
      await manager.update(Lease, leaseId, {
        isActive: true,
        contractUrl: contractUrl, // Ensure property name matches your Entity (contractUrl vs contract_url)
      });
      await manager.update(Property, lease.propertyId, {
        status: PropertyStatus.RENTED,
      });

      // 8. QUEUE PAYOUT
      await this.payoutService.queueAutoPayout(
        lease.property.owner.bankDetail,
        ownerShare,
        tx.id,
        lease.ownerId,
      );

      return {
        success: true,
        message: 'Lease activated and contract generated.',
        contractUrl,
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
    if (lease.isActive)
      throw new BadRequestException('Cannot decline an active lease');

    // Simply delete the draft lease so the user can apply elsewhere
    await this.leaseRepo.remove(lease);
    return { success: true, message: 'Lease offer declined' };
  }

  async getLeaseById(id: string): Promise<Lease> {
    const lease = await this.leaseRepo.findOne({
      where: { id },
      relations: ['property'], // We need the property to check the rent price
    });

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    return lease;
  }
}
