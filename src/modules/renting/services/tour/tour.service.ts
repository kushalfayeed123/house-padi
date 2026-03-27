/* eslint-disable @typescript-eslint/restrict-template-expressions */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from '../../entities/application.entity';
import { Property } from 'src/modules/properties/entities/property.entity';

// src/modules/renting/services/tour.service.ts
@Injectable()
export class TourService {
  constructor(
    @InjectRepository(Application) private appRepo: Repository<Application>,
    @InjectRepository(Property) private propertyRepo: Repository<Property>,
  ) {}

  async createApplication(
    propertyId: string,
    renterId: string,
    tourDate?: Date,
  ) {
    // If no tourDate, status is 'approved' (Direct Rent), otherwise 'submitted'
    const status = tourDate ? 'submitted' : 'approved';
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

    // 2. The Fix: Explicitly check that status exists
    if (!status) {
      throw new BadRequestException('Status value is required for update');
    }

    // 3. Perform the update
    // Ensure 'status' matches the column name in your Application entity
    await this.appRepo.update(id, { status: status });

    return { success: true, newStatus: status };
  }

  async getUserApplications(userId: string) {
    return await this.appRepo.find({
      where: { renter_id: userId },
      relations: ['property'],
      order: { applied_at: 'DESC' },
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
