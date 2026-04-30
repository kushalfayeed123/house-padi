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

import { Brackets, Repository } from 'typeorm';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { SearchPropertyDto } from '../dto/search-property.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { Property, PropertyStatus } from '../entities/property.entity';
import { AiService } from '../../../common/ai.service';
import { ChatBotService } from '../../../common/chat-bot.service';
import { StorageService } from '../../../common/storage.service';
import { Profile } from '../../profile/entities/profile.entity';
import { KycStatus } from '../../profile/enums/kyc-status.enum';
import { TourService } from '../../renting/services/tour/tour.service';
import {
  ExtractedFilters,
  PadiServiceResponse,
} from '../../padi/interfaces/padi-logic.interface';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    private chatBotService: ChatBotService,
    private aiService: AiService,
    private storageService: StorageService,
    private tourService: TourService,
  ) {}

  async create(
    dto: CreatePropertyDto,
    ownerId: string,
    files: Express.Multer.File[],
  ): Promise<Property> {
    // 1. Validation Logic
    const profile = await this.profileRepo.findOne({
      where: { id: ownerId },
      relations: ['bankDetail', 'kyc'],
    });

    if (!profile) throw new NotFoundException('Owner profile not found');

    if (profile.kyc?.status !== KycStatus.VERIFIED) {
      throw new ForbiddenException(
        'KYC verification required to list properties.',
      );
    }

    if (!profile.bankDetail) {
      throw new BadRequestException(
        'Please set up your payout bank account first.',
      );
    }

    try {
      // 2. Concurrent Uploads to Supabase
      // We map files to public URLs to store in the DB
      const imageUrls = await Promise.all(
        files.map((file, index) => {
          const fileExt = file.originalname.split('.').pop();
          // Path: properties/{ownerId}/{timestamp}-{index}.ext
          const path = `properties/${ownerId}/${Date.now()}-${index}.${fileExt}`;
          return this.storageService.uploadFile(
            path,
            file.buffer,
            file.mimetype,
          );
        }),
      );

      // 3. Geospatial Logic (PostGIS Point)
      const coords =
        dto.lat !== undefined && dto.lng !== undefined
          ? {
              type: 'Point' as const,
              coordinates: [dto.lng, dto.lat] as [number, number],
            }
          : undefined;

      // 4. Create Entity
      // Note: We save it as DRAFT. The Subscriber will update it to AVAILABLE after AI enrichment.
      const property = this.propertyRepo.create({
        ...dto,
        ownerId,
        images: imageUrls,
        coords,
        status: PropertyStatus.DRAFT,
        // Handle features if sent as stringified JSON from FormData
        features:
          typeof dto.features === 'string'
            ? JSON.parse(dto.features)
            : dto.features || {},
        metadata: {}, // Initial empty metadata for subscriber to fill
      });

      // 5. Save to Database
      // This call triggers PropertySubscriber.afterInsert
      const savedProperty = await this.propertyRepo.save(property);

      return savedProperty;
    } catch (error) {
      console.error('Property Creation Failure:', error);
      // Clean up uploaded files if DB save fails (Optional but recommended)
      throw new InternalServerErrorException(
        'Failed to process property listing.',
      );
    }
  }

  async findAll(limit = 10, offset = 0): Promise<Property[]> {
    return await this.propertyRepo.find({
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });
  }

  async findFeaured(limit = 10, offset = 0): Promise<Property[]> {
    return await this.propertyRepo.find({
      where: {
        isFeatured: true,
        status: PropertyStatus.AVAILABLE,
      },
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({
      where: { id },
      relations: ['applications', 'owner'],
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async findByOwner(ownerId: string): Promise<Property[]> {
    return await this.propertyRepo.find({ where: { ownerId } });
  }

  async findAiRecommended(
    dto: SearchPropertyDto,
  ): Promise<Omit<PadiServiceResponse, 'padi_summary'>> {
    const { chatPrompt, location } = dto;
    // 1. Extract Intent
    const extracted: ExtractedFilters = chatPrompt
      ? await this.chatBotService.extractSearchFilters(chatPrompt)
      : { location: null, maxPrice: null, bedrooms: null, vibe: null };

    const searchLocation = extracted.location || location;

    // 2. Primary Query: Strict Geography + All Filters
    const primaryQb = this.propertyRepo
      .createQueryBuilder('property')
      .where('property.status = :status', { status: PropertyStatus.AVAILABLE });

    if (searchLocation) {
      primaryQb.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(property.location) LIKE LOWER(:loc)', {
            loc: `%${searchLocation}%`,
          }).orWhere('LOWER(property.address_full) LIKE LOWER(:loc)', {
            loc: `%${searchLocation}%`,
          });
        }),
      );
    }

    if (extracted.maxPrice) {
      primaryQb.andWhere('property.price <= :price', {
        price: extracted.maxPrice,
      });
    }

    if (extracted.bedrooms) {
      primaryQb.andWhere("(property.features->>'bedrooms')::int = :beds", {
        beds: extracted.bedrooms,
      });
    }

    const primaryResults = await primaryQb
      .orderBy('property.createdAt', 'DESC')
      .take(5)
      .getMany();

    // 3. Secondary Query: Strict Geography but "Soft" on Price/Features
    const secondaryResults: Property[] = [];
    if (searchLocation) {
      const secondaryQb = this.propertyRepo
        .createQueryBuilder('property')
        .where('property.status = :status', {
          status: PropertyStatus.AVAILABLE,
        })
        .andWhere(
          new Brackets((qb) => {
            qb.where('LOWER(property.location) LIKE LOWER(:loc)', {
              loc: `%${searchLocation}%`,
            }).orWhere('LOWER(property.address_full) LIKE LOWER(:loc)', {
              loc: `%${searchLocation}%`,
            });
          }),
        );

      const primaryIds = primaryResults.map((p) => p.id);
      if (primaryIds.length > 0) {
        secondaryQb.andWhere('property.id NOT IN (:...ids)', {
          ids: primaryIds,
        });
      }

      const results = await secondaryQb
        .orderBy('property.createdAt', 'DESC')
        .take(3)
        .getMany();
      secondaryResults.push(...results);
    }

    return {
      count: primaryResults.length,
      data: primaryResults,
      suggestions: secondaryResults,
    };
  }

  async updateAiMetadata(property: Property, aiTags: string[]): Promise<void> {
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
    dto: UpdatePropertyDto, // dto.images contains the URLs we want to keep
    files?: Express.Multer.File[],
  ): Promise<Property> {
    const property = await this.propertyRepo.findOne({
      where: { id, ownerId },
    });

    if (!property) throw new NotFoundException('Property not found');

    // 1. Start with the images the user decided to KEEP from the frontend
    let updatedImages = dto.images || property.images;

    // 2. Upload and Append NEW images if any
    if (files && files.length > 0) {
      const newUrls = await this.uploadMultipleImages(ownerId, files);
      updatedImages = [...updatedImages, ...newUrls];
    }

    // 3. Update the entity
    Object.assign(property, dto);
    property.images = updatedImages; // Set the final combined list

    return await this.propertyRepo.save(property);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const result = await this.propertyRepo.softDelete({ id, ownerId });
    if (result.affected === 0) {
      throw new NotFoundException('Property not found or unauthorized');
    }
    const property = await this.findOne(id);
    await this.tourService.updateApplicationStatus(
      property.id,
      PropertyStatus.ARCHIVED,
      ownerId,
    );
  }

  private async uploadMultipleImages(
    ownerId: string,
    files: Express.Multer.File[],
  ): Promise<string[]> {
    const uploadPromises = files.map((file, index) => {
      const fileExt = file.originalname.split('.').pop();
      // Path structure: properties/{ownerId}/{timestamp}-{index}.{ext}
      const path = `properties/${ownerId}/${Date.now()}-${index}.${fileExt}`;

      return this.storageService.uploadFile(path, file.buffer, file.mimetype);
    });

    return Promise.all(uploadPromises);
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

  async updateStatus(id: string, status: PropertyStatus): Promise<void> {
    const result = await this.propertyRepo.update(id, { status });
    if (result.affected === 0) {
      throw new NotFoundException('Property not found');
    }
  }
}
