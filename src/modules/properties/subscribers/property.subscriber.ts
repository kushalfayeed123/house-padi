/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  DataSource,
} from 'typeorm';
import { AiService } from '../ai.service';
import { Property } from '../entities/property.entity';
import { PropertiesService } from '../properties.service';

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
    const { title, description } = event.entity;
    if (!description) return;

    // This is the magic part: it takes the AI call OUT of the database transaction
    setImmediate(async () => {
      try {
        const aiResult = await this.aiService.analyzeProperty(
          title,
          description,
        );

        if (aiResult) {
          // We use the ID here to get a fresh reference since the transaction is over
          await this.propertiesService.updateAiMetadata(
            event?.entity,
            aiResult.tags,
          );

          await this.propertiesService.updatePropertyFeatures(event.entity, {
            ...aiResult.features,
            summary: aiResult.ai_summary,
          });

          console.log(
            `✅ AI Optimization complete for Property: ${event.entity.id}`,
          );
        }
      } catch (error) {
        console.error('❌ Background AI Analysis failed:', error.message);
      }
    });
  }
}
