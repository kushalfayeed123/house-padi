// src/modules/renting/services/lease.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Property,
  PropertyStatus,
} from 'src/modules/properties/entities/property.entity';
import { Repository, DataSource } from 'typeorm';
import { Lease } from '../../entities/lease.entity';
import { Application } from '../../entities/application.entity';
import {
  Transaction,
  TransactionType,
} from '../../entities/transaction.entity';

@Injectable()
export class LeaseService {
  constructor(
    private dataSource: DataSource, // Used for atomic transactions
    @InjectRepository(Lease) private leaseRepo: Repository<Lease>,
    @InjectRepository(Property) private propertyRepo: Repository<Property>,
    @InjectRepository(Application) private appRepo: Repository<Application>,
  ) {}

  async prepareLease(applicationId: string, userId: string) {
    const app = await this.appRepo.findOne({
      where: { id: applicationId, renter_id: userId },
      relations: ['property'],
    });

    if (!app || (app.status !== 'approved' && app.status !== 'screening')) {
      throw new BadRequestException(
        'Application not eligible for lease generation.',
      );
    }

    return this.leaseRepo.save({
      propertyId: app.property_id,
      ownerId: app.property.ownerId,
      renterId: userId,
      monthlyRent: app.property.priceMonthly,
      startDate: new Date(),
      contractUrl: `https://housepadi.com/contracts/lease-${app.id}.pdf`,
    });
  }

  async completeRental(leaseId: string, paymentRef: string, userId: string) {
    // Start a managed transaction
    return await this.dataSource.transaction(async (manager) => {
      const lease = await manager.findOne(Lease, { where: { id: leaseId } });

      if (!lease) throw new BadRequestException('Lease record not found');

      // 1. Create the payment record
      await manager.insert(Transaction, {
        lease_id: leaseId,
        payer_id: userId,
        amount: lease.monthlyRent,
        platform_fee: Number(lease.monthlyRent) * 0.05,
        status: 'success',
        payment_gateway_ref: paymentRef,
        type: TransactionType.RENT_PAYMENT,
      });

      // 2. Activate the lease
      await manager.update(Lease, leaseId, { isActive: true });

      // 3. Mark property as RENTED
      await manager.update(Property, lease.propertyId, {
        status: PropertyStatus.RENTED,
      });

      return {
        status: 'success',
        message: 'Congratulations! Your home is secured.',
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
}
