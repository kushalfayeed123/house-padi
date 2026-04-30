/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// src/properties/ai.service.ts
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { env, pipeline } from '@xenova/transformers';
import {
  AnalysisSchema,
  PropertyAnalysis,
} from './schemas/property-analysis.schema';
import {
  PadiContext,
  PropertySummary,
} from '../modules/padi/interfaces/padi-logic.interface';
import { Property } from '../modules/properties/entities/property.entity';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private extractor: any;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Disable remote checking of the model once it is downloaded
    env.allowRemoteModels = true;
    env.localModelPath = './models'; // Save models locally in your project

    try {
      this.extractor = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
          // You can pass progress callbacks to see if it's actually moving
          progress_callback: (data: any) => {
            if (data.status === 'progress') {
              console.log(
                `Downloading AI Model: ${data.file} - ${data.progress.toFixed(2)}%`,
              );
            }
          },
        },
      );
      console.log('AI Embedding Model loaded successfully.');
    } catch (error) {
      console.error(
        'Failed to load AI model. Check your internet connection.',
        error,
      );
      // In production, you might want to throw a specific error here
    }
  }

  async fetchWithRetry(url: string, options: any, retries = 3, backoff = 1000) {
    for (let i = 0; i < retries; i++) {
      const response = await fetch(url, options);

      // If it's a 429 (Rate Limit) or 5xx (Server Error), wait and retry
      if (response.status === 429 || response.status >= 500) {
        const delay = backoff * Math.pow(2, i); // 1s, 2s, 4s...
        this.logger.warn(`AI Rate limited. Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      return response;
    }
    return fetch(url, options); // Final attempt
  }

  async analyzeProperty(
    title: string,
    description: string,
    location: string,
  ): Promise<PropertyAnalysis> {
    const systemPrompt = `You are a Real Estate Marketing Expert. 
          Return ONLY a JSON object with this exact structure:
          {
            "ai_summary": "A 2-sentence captivating sales pitch.",
            search_tags: 8-10 keywords for search indexing (e.g. "Lekki Phase 1", "Serviced", "Near University").
            "features": {
              "bedrooms": number,
              "bathrooms": number,
              "is_luxury": boolean,
              "has_electricity_backup": boolean,
              "furnished": boolean
            }
          }

          CRITICAL: 
          - If title says '2 bedroom', set features.bedrooms to 2.
          - If title says 'en suite', set features.bathrooms to match bedrooms.
          - Location: ${location || 'Lekki'}`;

    const fallback: PropertyAnalysis = {
      search_tags: ['Property'],
      features: {
        bedrooms: 0,
        bathrooms: 0,
        has_electricity_backup: false,
        furnished: false,
        is_luxury: true,
      },
      ai_summary: title,
    };

    try {
      const response = await this.fetchWithRetry(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.configService.get<string>('OPENROUTER_API_KEY')}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://housepadi.com',
            'X-Title': 'HousePadi NestJS',
          },
          body: JSON.stringify({
            model: 'openrouter/free', // Automatically picks the best available free model
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: `Title: ${title}\nDescription: ${description}\nLocation: ${location || 'Not specified'}`,
              },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 1000,
            temperature: 0.1, // Keep it precise
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenRouter HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) throw new Error('AI returned an empty response');

      const parsed = JSON.parse(content);
      const validated = AnalysisSchema.parse(parsed);

      return {
        ...validated,
        ai_summary: validated.ai_summary || validated.ai_summary,
        search_tags: validated.search_tags,
      };
    } catch (e: any) {
      this.logger.error(`AI Analysis final failure: ${e.message}`);
      return fallback;
    }
  }

  async synthesizeSearchResponse(
    query: string,
    primaryResults: Property[],
    secondaryResults: Property[],
    context: PadiContext,
    action: string,
    payload: any,
    isFirstMessage: boolean = false,
  ): Promise<string> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!apiKey)
      throw new InternalServerErrorException(
        'OPENROUTER_API_KEY is not defined.',
      );

    // Prepare a mapping of the property results for the LLM to read easily
    const mapSummary = (r: Property) => ({
      title: r.title,
      location: r.location,
      price: r.price,
      id: r.id,
      bedrooms: r.features?.bedrooms,
    });

    const primaryData = primaryResults.slice(0, 2).map(mapSummary);
    const secondaryData = secondaryResults.slice(0, 2).map(mapSummary);

    const systemPrompt = `
    You are the Senior Real Estate Advisor at HousePadi. 
    Acknowledge the Action Taken: ${action}.

    STRICT LOGIC SWITCH:
    
    SWITCH (Action) {
      CASE 'PROPERTY_CREATED':
        - Logic: Success. Confirm draft creation for "${payload?.title}" (ID: ${payload?.id}).
        - Goal: Ask for photos or more features to finish the listing.
        
      CASE 'LISTING_ERROR':
        - Logic: Failure. Check payload.message: "${payload?.message}".
        - IF message contains "Missing:":
            Extract the missing fields and tell the user exactly what they are. 
            Example: "I need your Property Title and Lease Duration to save this."
        - IF actionRequired is "KYC_VERIFICATION":
            Tell them to complete KYC in their profile.
        - IF actionRequired is "BANK_SETUP":
            Tell them to add bank details.
            
      CASE 'GET_RENTAL_STATUS':
        - Logic: Summarize user data: ${JSON.stringify(payload)}.
        - Update them on active leases or application counts.
        
      CASE 'SEARCH_PROPERTIES':
       - IF Primary Data has items:
            Summarize the exact matches. Keep it concise.
        - IF Primary Data is EMPTY but Secondary Data has items:
            DO NOT say "No results found." 
            Instead, say: "I couldn't find an exact match for [User Query], but I found a great alternative in [Location]: [Title]."
            Mention why it's a good alternative (e.g., similar area or better features).
        - IF BOTH are empty:
            Apologize and ask the user to refine their location, price, or bedroom count.
    }

    STYLE RULES:
    - ${isFirstMessage ? `Start with "Hello ${context.userName},"` : 'Do not use a greeting.'}
    - If user asks a general question about HousePadi, answer accurately.
    - If info is missing for a listing, be specific. Don't say "details are missing," say "I need the lease duration in months."
    - No technical jargon (payload, JSON, etc).
  `;

    try {
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openrouter/free',
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: `User asked: "${query}"\nTool Results: ${JSON.stringify(payload)}\nPrimary Data: ${JSON.stringify(primaryData)}\nSecondary Data: ${JSON.stringify(secondaryData)}`,
              },
            ],
            temperature: 0.5, // Lower temperature for more factual responses
          }),
        },
      );

      if (!response.ok) throw new Error('AI Provider Error');

      const result = await response.json();
      const aiContent = result.choices[0]?.message?.content;

      return typeof aiContent === 'string'
        ? aiContent
        : "I've processed your request. How else can I assist you with your property needs?";
    } catch (error) {
      // Graceful fallback if the AI service fails
      if (action === 'LISTING_ERROR') {
        return `I encountered an issue while trying to save your listing: ${payload?.message || 'Missing required information'}. Please provide the full details so I can try again.`;
      }
      return `Hello ${context.userName}, how can I help you further?`;
    }
  }

  // Implementation for vector embeddings
  async generateEmbedding(text: string): Promise<number[]> {
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  }
}
