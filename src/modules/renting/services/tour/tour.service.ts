/* eslint-disable @typescript-eslint/restrict-template-expressions */

import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from '../../entities/application.entity';

import { LeaseService } from '../lease/lease.service';
import {
  Property,
  PropertyStatus,
} from '../../../properties/entities/property.entity';
import { PropertiesService } from '../../../properties/services/properties.service';

// src/modules/renting/services/tour.service.ts
@Injectable()
export class TourService {
  constructor(
    @Inject(forwardRef(() => PropertiesService)) // <--- Add this
    private readonly propertiesService: PropertiesService,
    private readonly leaseService: LeaseService,
    @InjectRepository(Application) private appRepo: Repository<Application>,
    @InjectRepository(Property) private propertyRepo: Repository<Property>,
  ) {}

  async createApplication(
    propertyId: string,
    renterId: string,
    tourDate?: Date,
  ) {
    // If no tourDate, status is 'approved' (Direct Rent), otherwise 'submitted'
    const status = 'submitted';
    const property = await this.propertiesService.findOne(propertyId);
    if (property.status !== PropertyStatus.AVAILABLE) {
      throw new BadRequestException(
        'This property is currently under review or already rented and is not accepting new applications.',
      );
    }
    const app = this.appRepo.create({
      property_id: propertyId,
      renter_id: renterId,
      status,
      screening_summary: tourDate
        ? `Tour: ${tourDate}`
        : 'Instant Rent interest',
    });
    return this.appRepo.save(app);
  }

  async updateApplicationStatus(id: string, status: string, ownerId: string) {
    // 1. Authorization Check (Keep the logic we wrote before)
    const application = await this.appRepo.findOne({
      where: { id },
      relations: ['property'],
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.property.ownerId !== ownerId) {
      throw new ForbiddenException('Unauthorized to update this application');
    }

    if (!status) {
      throw new BadRequestException('Status value is required for update');
    }

    await this.appRepo.update(id, { status: status });

    const app = await this.appRepo.findOne({ where: { id: id } });

    if (status === 'approved') {
      await this.leaseService.prepareLease(id, app?.renter_id ?? '');

      await this.propertiesService.updateStatus(
        application.property.id,
        PropertyStatus.PENDING,
      );
    }

    return { success: true, newStatus: status };
  }

  async getUserApplications(userId: string) {
    return await this.appRepo.find({
      where: { renter_id: userId },
      relations: ['property'],
      order: { applied_at: 'DESC' },
    });
  }

  async getOwnerDashboardApplications(ownerId: string) {
    return await this.appRepo.find({
      where: {
        property: {
          ownerId: ownerId, // TypeORM allows filtering by nested relation properties
        },
      },
      relations: ['property', 'renter'], // Include property info and the applicant profile
      order: {
        applied_at: 'DESC',
      },
    });
  }

  async getPropertyApplications(propertyId: string, ownerId: string) {
    // Verify ownership before showing applicant data
    const property = await this.propertyRepo.findOne({
      where: { id: propertyId },
    });
    if (!property || property.ownerId !== ownerId) {
      throw new ForbiddenException('Unauthorized access to these applications');
    }

    return await this.appRepo.find({
      where: { property_id: propertyId },
      relations: ['renter'], // Show the profile of the person who applied
      order: { applied_at: 'DESC' },
    });
  }
}
