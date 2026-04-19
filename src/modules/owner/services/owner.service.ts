import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { Wallet } from '../../finance/entities/wallet.entity';
import {
  Property,
  PropertyStatus,
} from '../../properties/entities/property.entity';
import { PropertiesService } from '../../properties/services/properties.service';
import { Application } from '../../renting/entities/application.entity';
import { LeaseService } from '../../renting/services/lease/lease.service';
import { TourService } from '../../renting/services/tour/tour.service';

@Injectable()
export class OwnerService {
  constructor(
    @InjectRepository(Property) private readonly propRepo: Repository<Property>,
    @InjectRepository(Application)
    private readonly appRepo: Repository<Application>,
    @InjectRepository(Wallet) private readonly walletRepo: Repository<Wallet>,
    private readonly propertiesService: PropertiesService,
    private readonly tourService: TourService,
    private readonly leaseService: LeaseService,
  ) {}

  /**
   * AGGREGATED DASHBOARD
   * Uses existing repos to build a high-level view for the Owner UI.
   */
  async getOwnerDashboard(ownerId: string) {
    const [properties, applications, wallet] = await Promise.all([
      this.propRepo.find({ where: { ownerId }, order: { createdAt: 'DESC' } }),
      this.tourService.getOwnerDashboardApplications(ownerId), // Using your existing TourService method
      this.walletRepo.findOne({ where: { userId: ownerId } }),
    ]);

    const activeLeases = properties.filter(
      (p) => p.status === PropertyStatus.RENTED,
    ).length;

    return {
      stats: {
        balance: wallet?.balance || 0,
        totalProperties: properties.length,
        activeTenants: activeLeases,
        pendingApplications: applications.filter(
          (a) => a.status === 'submitted',
        ).length,
      },
      properties: properties, // Recent listings
      applications: applications, // Recent interest
    };
  }
}
