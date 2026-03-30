/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  DataSource,
} from 'typeorm';
import { AiService } from '../../../common/ai.service';
import { Property, PropertyStatus } from '../entities/property.entity';
import { PropertiesService } from '../services/properties.service';

@EventSubscriber()
export class PropertySubscriber implements EntitySubscriberInterface<Property> {
  constructor(
    dataSource: DataSource, // Inject DataSource
    private aiService: AiService,
    private propertiesService: PropertiesService,
  ) {
    dataSource.subscribers.push(this); // Manually register
  }

  listenTo() {
    return Property;
  }

  afterInsert(event: InsertEvent<Property>) {
    const { id, title, description, location, addressFull, metadata } =
      event.entity;
    if (!description) return;

    // We use the connection from the event to get a NEW manager
    const dataSource = event.connection;

    setImmediate(async () => {
      try {
        // 1. Existing Analysis (Gemini)
        const aiResult = await this.aiService.analyzeProperty(
          title,
          description,
          location,
        );

        // 2. Generate Vector Embedding (Xenova)
        const textToEmbed = `Title: ${title}. Location: ${location}. Address: ${addressFull}. Description: ${description}`;
        const embedding = await this.aiService.generateEmbedding(textToEmbed);

        // 3. FIX: Use the DataSource to get a fresh repository
        // This avoids the "Query runner already released" error
        const propertyRepo = dataSource.getRepository(Property);

        console.log(aiResult);
        await propertyRepo.update(id, {
          metadata: {
            ...(metadata || {}),
            search_tags: aiResult?.search_tags ?? [],
          },
          features: aiResult?.features ?? {},
          embedding: embedding, // Save the numerical vector
          status: PropertyStatus.AVAILABLE,
          aiSummary: aiResult.ai_summary, // This matches your DB column
        });

        console.log(`✅ Property ${id} enriched with AI data.`);
      } catch (error) {
        // This will now catch the Gemini 'fetch failed' without crashing the app
        console.error('❌ AI Background Enrichment failed:', error.message);
      }
    });
  }
}
