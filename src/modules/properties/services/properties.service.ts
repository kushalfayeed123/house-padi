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
import { Profile } from 'src/modules/profile/entities/profile.entity';
import { KycStatus } from 'src/modules/profile/enums/kyc-status.enum';
import { Repository } from 'typeorm';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { SearchPropertyDto } from '../dto/search-property.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { Property, PropertyStatus } from '../entities/property.entity';
import { ChatBotService } from 'src/common/chat-bot.service';
import { AiService } from 'src/common/ai.service';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    private chatBotService: ChatBotService,
    private aiService: AiService,
  ) {}

  async create(dto: CreatePropertyDto, ownerId: string): Promise<Property> {
    try {
      // 1. Fetch profile using 'id' (which is the Supabase UID)
      const profile = await this.profileRepo.findOne({
        where: { id: ownerId }, // Use 'id' instead of 'userId'
        relations: ['bankDetail', 'kyc'],
      });

      if (!profile) {
        throw new NotFoundException('Owner profile not found');
      }

      // 2. Business Logic: KYC Check
      if (profile.kyc.status !== KycStatus.VERIFIED) {
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
      relations: ['applications'],
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async findByOwner(ownerId: string): Promise<Property[]> {
    return await this.propertyRepo.find({ where: { ownerId } });
  }

  async findAiRecommended(dto: SearchPropertyDto): Promise<any> {
    const { chatPrompt, lat, lng, radius = 5, maxPrice, location, tags } = dto;
    const qb = this.propertyRepo.createQueryBuilder('property');

    // 1. Mandatory Filter: Only available listings
    qb.where('property.status = :status', { status: PropertyStatus.AVAILABLE });

    let extractedLoc = location;
    let extractedPrice = maxPrice;

    // --- HYBRID AI LOGIC ---
    if (chatPrompt) {
      // A. Extract Hard Filters (Location/Price) via LLM
      const extracted =
        await this.chatBotService.extractSearchFilters(chatPrompt);
      extractedLoc = extracted.location || location;
      extractedPrice = extracted.maxPrice || maxPrice;
      if (extracted.bedrooms) {
        qb.andWhere(
          "(property.features->>'bedrooms')::int BETWEEN :min AND :max",
          {
            min: extracted.bedrooms - 1,
            max: extracted.bedrooms,
          },
        );
      }

      // B. Generate Semantic Vector (The "Vibe" check)
      const vibeVector = await this.aiService.generateEmbedding(chatPrompt);
      const vectorString = `[${vibeVector.join(',')}]`;

      // C. Apply Vector Ranking (pgvector)

      qb.addSelect(`property.embedding <=> :vector`, 'vibe_score');
      qb.setParameter('vector', vectorString);
      qb.orderBy('vibe_score', 'ASC');

      // D. Apply Extracted Hard Filters
      if (extractedLoc) {
        qb.andWhere('LOWER(property.location) LIKE LOWER(:loc)', {
          loc: `%${extractedLoc}%`,
        });
      }
      if (extractedPrice) {
        qb.andWhere('property.priceMonthly <= :maxP', { maxP: extractedPrice });
      }
    } else {
      // Default sorting if no AI prompt is provided
      qb.orderBy('property.isFeatured', 'DESC');
      qb.addOrderBy('property.createdAt', 'DESC');
    }

    // Inside findAiRecommended in properties.service.ts

    if (tags && tags.length > 0) {
      // Use '->>' to get the field as text or '->' to get it as JSON
      // Then use '@>' to check if that specific array contains your tags
      qb.andWhere("property.metadata->'search_tags' @> :tagList", {
        tagList: JSON.stringify(tags),
      });
    }

    // --- GEOSPATIAL FILTER (PostGIS) ---
    // This uses the lat/lng/radius from your DTO
    if (lat && lng) {
      qb.andWhere(
        `ST_DWithin(property.coords, ST_SetSRID(ST_Point(:lng, :lat), 4326), :dist)`,
        {
          lng: Number(lng),
          lat: Number(lat),
          dist: (radius || 5) * 1000, // Convert km to meters
        },
      );

      // If there's no AI "vibe score", sort by physical proximity
      if (!chatPrompt) {
        qb.addOrderBy(
          `ST_Distance(property.coords, ST_SetSRID(ST_Point(:lng, :lat), 4326))`,
          'ASC',
        );
      }
    }

    // Execution
    const results = await qb.take(20).getMany();

    // --- THE CONVERSATIONAL WRAPPER ---
    // Padi explains the results based on everything we found (or didn't find)
    let padiMessage = '';
    if (chatPrompt) {
      padiMessage = await this.aiService.synthesizeSearchResponse(
        chatPrompt,
        results,
      );
    } else {
      padiMessage =
        results.length > 0
          ? 'Here are the top-rated spots near you right now!'
          : "it's a bit empty around here. Want to try widening your search radius?";
    }

    return {
      padi_summary: padiMessage,
      count: results.length,
      data: results,
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

  async updateStatus(id: string, status: PropertyStatus): Promise<void> {
    const result = await this.propertyRepo.update(id, { status });
    if (result.affected === 0) {
      throw new NotFoundException('Property not found');
    }
  }
}
