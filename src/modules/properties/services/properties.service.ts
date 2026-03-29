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

  async findOne(id: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async findByOwner(ownerId: string): Promise<Property[]> {
    return await this.propertyRepo.find({ where: { ownerId } });
  }

  // async findAiRecommended(dto: SearchPropertyDto): Promise<Property[]> {
  //   const { location, address, maxPrice, lat, lng, radius = 5 } = dto;

  //   // 1. Ensure tags are handled as an array (even if a single string comes from the URL)
  //   let tags: string[] = [];
  //   if (dto.tags) {
  //     tags = Array.isArray(dto.tags)
  //       ? dto.tags
  //       : dto.tags.split(',').map((t) => t.trim());
  //   }

  //   // 2. Initialize the Base Query
  //   const qb = this.propertyRepo.createQueryBuilder('property');

  //   // Only show active listings
  //   qb.andWhere('property.status = :status', { status: 'available' });

  //   // 3. Geospatial Logic (PostGIS)
  //   if (lat && lng) {
  //     qb.andWhere(
  //       `ST_DWithin(property.coords, ST_SetSRID(ST_Point(:lng, :lat), 4326), :dist)`,
  //       { lng, lat, dist: radius * 1000 },
  //     );
  //     qb.addOrderBy(
  //       `ST_Distance(property.coords, ST_SetSRID(ST_Point(:lng, :lat), 4326))`,
  //       'ASC',
  //     );
  //   }

  //   // 4. Standard Filters (Location, Address, Price)
  //   if (location?.trim()) {
  //     qb.andWhere('LOWER(property.location) = LOWER(:location)', { location });
  //   }

  //   if (address?.trim()) {
  //     qb.andWhere('property.address_full ILIKE :address', {
  //       address: `%${address}%`,
  //     });
  //   }

  //   if (maxPrice) {
  //     qb.andWhere('property.priceMonthly <= :maxPrice', { maxPrice });
  //   }

  //   // 5. Advanced Partial Tag Matching (The "AI-Recommended" Logic)
  //   if (tags.length > 0) {
  //     tags.forEach((tag, index) => {
  //       const paramName = `tag_${index}`;

  //       /**
  //        * We use EXISTS with a subquery to unnest the JSONB array.
  //        * This allows us to use ILIKE (Case-Insensitive Partial Match)
  //        * on every individual tag stored in metadata.
  //        */
  //       qb.andWhere(
  //         `EXISTS (
  //         SELECT 1
  //         FROM jsonb_array_elements_text(property.metadata->'search_tags') AS tag_element
  //         WHERE tag_element ILIKE :${paramName}
  //       )`,
  //         { [paramName]: `%${tag}%` },
  //       );
  //     });
  //   }

  //   // 6. Final Sorting
  //   qb.addOrderBy('property.isFeatured', 'DESC');
  //   qb.addOrderBy('property.createdAt', 'DESC');

  //   try {
  //     return await qb.getMany();
  //   } catch (error) {
  //     console.error('Search Query Failed:', error);
  //     throw new InternalServerErrorException(
  //       'Could not complete property search',
  //     );
  //   }
  // }

  // src/properties/services/properties.service.ts

  // src/properties/services/properties.service.ts

  async findAiRecommended(dto: SearchPropertyDto): Promise<any> {
    const { chatPrompt, lat, lng, radius = 5, maxPrice, location } = dto;
    const qb = this.propertyRepo.createQueryBuilder('property');

    // 1. Mandatory Filter: Only available listings
    qb.where('property.status = :status', { status: PropertyStatus.AVAILABLE });

    let aiSummary = 'Browsing all available properties.';

    // --- HYBRID AI LOGIC ---
    if (chatPrompt) {
      // A. Extract Logic (Groq + Llama 3)
      const extracted =
        await this.chatBotService.extractSearchFilters(chatPrompt);

      // B. Vector Logic (Xenova + MiniLM)
      const vibeVector = await this.aiService.generateEmbedding(chatPrompt);
      const vectorString = `[${vibeVector.join(',')}]`;

      // C. Apply Hard Filters (Merge AI-extracted with Manual DTO filters)
      const finalLoc = extracted.location || location;
      const finalPrice = extracted.maxPrice || maxPrice;

      if (finalLoc) {
        qb.andWhere('LOWER(property.location) LIKE LOWER(:loc)', {
          loc: `%${finalLoc}%`,
        });
      }
      if (finalPrice) {
        qb.andWhere('property.priceMonthly <= :maxPrice', {
          maxPrice: finalPrice,
        });
      }

      // D. Semantic Ranking (pgvector)
      // NOTE: Use getRawAndEntities if you need to see the actual vibe_score
      qb.addSelect(`property.embedding <=> :vector`, 'vibe_score');
      qb.setParameter('vector', vectorString);
      qb.orderBy('vibe_score', 'ASC');

      aiSummary = `Searching for ${finalLoc || 'homes'} ${finalPrice ? `under ₦${finalPrice.toLocaleString()}` : ''} matching: "${chatPrompt}"`;
    } else {
      // Default sorting for non-AI searches
      qb.orderBy('property.isFeatured', 'DESC');
      qb.addOrderBy('property.createdAt', 'DESC');
    }

    // --- GEOSPATIAL FILTER (PostGIS) ---
    if (lat && lng) {
      qb.andWhere(
        `ST_DWithin(property.coords, ST_SetSRID(ST_Point(:lng, :lat), 4326), :dist)`,
        { lng, lat, dist: radius * 1000 },
      );
      // If not using AI ranking, sort by distance
      if (!chatPrompt) {
        qb.addOrderBy(
          `ST_Distance(property.coords, ST_SetSRID(ST_Point(:lng, :lat), 4326))`,
          'ASC',
        );
      }
    }

    // Use getMany() for clean entities, or getRawAndEntities() if you want the scores
    const results = await qb.take(20).getMany();

    return {
      summary: aiSummary,
      count: results.length,
      data: results,
    };
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
