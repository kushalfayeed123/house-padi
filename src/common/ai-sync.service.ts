/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/common/ai-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Property } from '../modules/properties/entities/property.entity';
import { AiService } from './ai.service';

@Injectable()
export class AiSyncService {
  private readonly logger = new Logger(AiSyncService.name);

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    private readonly aiService: AiService,
  ) {}

  // Runs every hour. You can use EVERY_30_SECONDS for testing.
  @Cron(CronExpression.EVERY_HOUR)
  async handleSync() {
    this.logger.log('🔄 Checking for properties needing AI enrichment...');

    // Find properties where embedding is missing OR tags are empty
    // Note: Adjust the 'metadata' check based on your specific JSONB structure
    const pendingProperties = await this.propertyRepo.find({
      where: [
        {
          metadata: Raw(
            (alias) => `${alias} -> 'search_tags' = '["Property"]'::jsonb`,
          ),
        },
        {
          features: Raw(
            (alias) =>
              `(${alias} ->> 'bedrooms')::int = 0 OR (${alias} ->> 'bathrooms')::int = 0`,
          ),
        },
      ],
      take: 10,
    });
    if (pendingProperties.length === 0) {
      return this.logger.log('✅ All properties are up to date.');
    }

    this.logger.log(`Found ${pendingProperties.length} properties to process.`);

    for (const prop of pendingProperties) {
      try {
        // 1. Re-run Gemini Analysis
        const aiResult = await this.aiService.analyzeProperty(
          prop.title,
          prop.description,
          prop.location,
        );

        // 2. Re-run Xenova Embedding
        const textToEmbed = `Title: ${prop.title}. Location: ${prop.location}. Description: ${prop.description}`;
        const embedding = await this.aiService.generateEmbedding(textToEmbed);

        // 3. Update the record
        await this.propertyRepo.update(prop.id, {
          embedding,
          features: aiResult?.features ?? prop.features,
          aiSummary: aiResult?.ai_summary ?? prop.title,
          metadata: {
            ...prop.metadata,
            search_tags: aiResult?.search_tags ?? [],
          },
        });

        this.logger.log(` Successfully synced Property ID: ${prop.id}`);
      } catch (err: any) {
        this.logger.error(`Failed to sync Property ${prop.id}: ${err.message}`);
      }
    }
  }
}
