/* eslint-disable @typescript-eslint/no-unsafe-assignment */

// src/properties/properties.service.ts
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property, PropertyStatus } from './entities/property.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { SearchPropertyDto } from './dto/search-property.dto';
import { KycStatus, Profile } from '../profile/entities/profile.entity';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
  ) {}

  async create(dto: CreatePropertyDto, ownerId: string): Promise<Property> {
    try {
      // 1. Fetch profile using 'id' (which is the Supabase UID)
      const profile = await this.profileRepo.findOne({
        where: { id: ownerId }, // Use 'id' instead of 'userId'
        relations: ['bankDetail'],
      });

      if (!profile) {
        throw new NotFoundException('Owner profile not found');
      }

      // 2. Business Logic: KYC Check
      if (profile.kycStatus !== KycStatus.VERIFIED) {
        throw new ForbiddenException(
          'KYC verification required to list properties.',
        );
      }

      // 3. Business Logic: Bank Check
      if (!profile.bankDetail) {
        throw new BadRequestException(
          'Please set up your payout bank account first.',
        );
      }

      // 4. Geospatial Logic
      const { lat, lng, ...rest } = dto;
      const coords =
        lat !== undefined && lng !== undefined
          ? {
              type: 'Point' as const,
              coordinates: [lng, lat] as [number, number],
            }
          : undefined;

      // 5. Build and Save the Entity
      const property = this.propertyRepo.create({
        ...rest,
        ownerId,
        status: PropertyStatus.DRAFT,
        coords,
        // Ensure these from your updated DTO are mapped
        leaseDurationMonths: dto.leaseDurationMonths,
        agreementContent: dto.agreementContent,
      });

      return await this.propertyRepo.save(property);
    } catch (error) {
      // Pass through NestJS built-in exceptions (403, 400, etc.)
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Property Creation Error:', error);
      throw new InternalServerErrorException('Error creating property listing');
    }
  }

  async findAll(limit = 10, offset = 0): Promise<Property[]> {
    return await this.propertyRepo.find({
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async findByOwner(ownerId: string): Promise<Property[]> {
    return await this.propertyRepo.find({ where: { ownerId } });
  }

  async findAiRecommended(dto: SearchPropertyDto): Promise<Property[]> {
    // Destructure for easier use inside the method
    const { location, address, maxPrice, lat, lng, radius = 5 } = dto;

    // Important: Use the tags we processed in the controller
    const tags = dto.tags as unknown as string[];

    const getBaseQuery = () => {
      const qb = this.propertyRepo.createQueryBuilder('property');
      qb.andWhere('property.status = :status', { status: 'available' });

      // Geospatial Logic
      if (lat && lng) {
        qb.andWhere(
          `ST_DWithin(property.coords, ST_SetSRID(ST_Point(:lng, :lat), 4326), :dist)`,
          { lng, lat, dist: radius * 1000 },
        );
        qb.addOrderBy(
          `ST_Distance(property.coords, ST_SetSRID(ST_Point(:lng, :lat), 4326))`,
          'ASC',
        );
      }

      // Standard Filters
      if (location?.trim()) {
        qb.andWhere('LOWER(property.location) = LOWER(:location)', {
          location,
        });
      }
      if (address?.trim()) {
        qb.andWhere('property.address_full ILIKE :address', {
          address: `%${address}%`,
        });
      }
      if (maxPrice) {
        qb.andWhere('property.priceMonthly <= :maxPrice', { maxPrice });
      }

      qb.orderBy('property.isFeatured', 'DESC').addOrderBy(
        'property.createdAt',
        'DESC',
      );
      return qb;
    };

    // Logic for Discovery vs AI Search
    if (!tags || tags.length === 0) {
      return await getBaseQuery().getMany();
    }

    // 2. If tags EXIST, perform the AI-Matching logic
    const exactQuery = getBaseQuery();
    exactQuery.andWhere(`property.metadata->'search_tags' @> :tags`, {
      tags: JSON.stringify(tags),
    });

    const results = await exactQuery.getMany();

    // 3. Fallback to Partial Match if exact tags fail
    if (results.length === 0) {
      const partialQuery = getBaseQuery();
      partialQuery.andWhere(
        `jsonb_exists_any(property.metadata->'search_tags', :tags::text[])`,
        { tags },
      );
      return await partialQuery.getMany();
    }

    return results;
  }

  async updateAiMetadata(property: Property, aiTags: string[]): Promise<void> {
    // No need to "findOne" here anymore!
    property.metadata = {
      ...property.metadata,
      ai_optimized: true,
      search_tags: aiTags,
    };

    await this.propertyRepo.save(property);
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdatePropertyDto,
  ): Promise<Property> {
    // 1. Ensure the property exists AND belongs to the requester
    const property = await this.propertyRepo.findOne({
      where: { id, ownerId },
    });

    if (!property) {
      throw new NotFoundException(
        'Property not found or you do not have permission to edit it',
      );
    }

    // 2. Merge the new data into the existing entity
    // This handles the primitive types (title, price) and the JSONB objects
    Object.assign(property, dto);

    // 3. Mark as needing AI re-optimization if the description changed
    if (dto.description || dto.features) {
      property.metadata = {
        ...property.metadata,
        ai_optimized: false, // This triggers your AI worker to re-scan the listing
        last_manual_update: new Date().toISOString(),
      };
    }

    return await this.propertyRepo.save(property);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const result = await this.propertyRepo.delete({ id, ownerId });
    if (result.affected === 0) {
      throw new NotFoundException('Property not found or unauthorized');
    }
  }

  async updatePropertyFeatures(
    property: Property, // Accept the Entity directly
    newFeatures: Record<string, any>,
  ): Promise<void> {
    // 1. Deep merge the existing features with the new AI-discovered features
    property.features = {
      ...property.features,
      ...newFeatures,
    };

    // 2. Update metadata with AI summary and processing timestamp
    if (newFeatures.summary) {
      property.metadata = {
        ...property.metadata,
        ai_summary: newFeatures.summary,
        ai_processed_at: new Date().toISOString(),
      };
    }

    // 3. Save the modified entity
    await this.propertyRepo.save(property);
  }
}
