/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// src/properties/ai.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { env, pipeline } from '@xenova/transformers';
import {
  AnalysisSchema,
  PropertyAnalysis,
} from './schemas/property-analysis.schema';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    // Update your system prompt to this:
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
    } catch (e) {
      this.logger.error(`AI Analysis final failure: ${e.message}`);
      return fallback;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  }

  async synthesizeSearchResponse(
    query: string,
    results: any[],
  ): Promise<string> {
    const systemPrompt = `You are 'Padi', the AI heartbeat of HousePadi. 
    Your goal is to explain search results to a user in a helpful, conversational professional tone.
    
    CRITICAL RULES:
    1. If results are empty, apologize warmly and suggest looking in a nearby area (e.g., if Lekki is empty, suggest Ikate or Ajah).
    2. If there's a mismatch (e.g., they asked for 3 beds, you found 2), explain the benefit of the current result (e.g., 'It's detached', 'Better security', 'Cheaper').
    3. Use relatable terms: 'Clean spot', 'Standard security'.
    4. Keep it to 3 sentences max. Do NOT list data in a table.
    `;

    const summaryData = results.slice(0, 2).map((r) => ({
      title: r.title,
      location: r.location,
      price: r.price,
      bedrooms: r.features?.bedrooms,
    }));

    try {
      const response = await this.fetchWithRetry(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.configService.get('OPENROUTER_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openrouter/free',
            messages: [
              {
                role: 'user', // Using 'user' role for instructions + data to avoid 400 errors
                content: `${systemPrompt}\n\nUser Search: "${query}"\nFound Data: ${JSON.stringify(summaryData)}`,
              },
            ],
            temperature: 0.7, // Higher temp for natural speech
          }),
        },
      );

      const data = await response.json();
      return (
        data.choices?.[0]?.message?.content ||
        "I found some spots you'll like! Check them out below."
      );
    } catch (error) {
      return 'I found some great options for you. Take a look!';
    }
  }
}
