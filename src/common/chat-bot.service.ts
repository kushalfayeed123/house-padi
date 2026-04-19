/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/common/chatbot.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

// 1. Define an explicit interface for the AI output
export interface ExtractedFilters {
  location: string | null;
  maxPrice: number | null;
  bedrooms: number | null;
  vibe: string | null;
}

@Injectable()
export class ChatBotService {
  // 2. Explicitly type the groq instance
  private readonly groq: Groq;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');

    if (!apiKey) {
      throw new InternalServerErrorException('GROQ_API_KEY is missing');
    }

    // 3. Initialize inside the constructor to ensure 'this' is resolved
    this.groq = new Groq({ apiKey });
  }

  async extractSearchFilters(userMessage: string): Promise<ExtractedFilters> {
    try {
      // 4. Use 'await' clearly and capture the completion
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a real estate extraction expert. 
                      Extract specific search parameters from the user message.
                      
                      Rules:
                      - "bedrooms": Extract ONLY the number. (e.g., "3 bedroom", "three bed", "3 rooms" -> 3).
                      - "maxPrice": Extract as a raw number. (e.g., "5 million", "5M" -> 5000000).
                      - "location": Extract the most specific location info provided. 
                        PRIORITIZE: Estate Names (e.g. "Chevron Estate"), Neighborhoods (e.g. "Maitama"), or Streets.
                        If the user says "3 bedroom in Lekki Phase 1", extract "Lekki Phase 1", NOT just "Lekki" or "Lagos".                      - "vibe": Extract the descriptive "feel" (e.g., "luxury", "quiet", "modern").
                      - Convert currency slang like "5M" to 5000000 and "500k" to 500000.
                      Extract search parameters from the user message.
                      - "location": ONLY extract if a specific area/city is mentioned. If the user does not mention a place, return null. DO NOT guess or default to Lekki.
                      - "bedrooms": Extract as a number.
                      - "vibe": Extract the descriptive feel (e.g., luxury).

                      Return ONLY JSON: {"location": string | null, "maxPrice": number | null, "bedrooms": number | null, "vibe": string | null}.`,
          },
          { role: 'user', content: userMessage },
        ],
        model: 'llama-3.1-8b-instant',
        response_format: { type: 'json_object' },
      });

      // 5. Safely access members with optional chaining and local variables
      const choice = completion.choices[0];
      const content = choice?.message?.content;

      if (!content) {
        return { location: null, maxPrice: null, bedrooms: null, vibe: null };
      }

      // 6. Cast JSON.parse to our interface to satisfy 'no-unsafe-assignment'
      const parsedData = JSON.parse(content) as ExtractedFilters;

      return {
        location: parsedData.location ?? null,
        maxPrice: parsedData.maxPrice ?? null,
        bedrooms: parsedData.bedrooms ?? null,
        vibe: parsedData.vibe ?? null,
      };
    } catch (error) {
      console.error('Groq AI Error:', error);
      // Return a safe default instead of throwing to keep the chat alive
      return { location: null, maxPrice: null, bedrooms: null, vibe: null };
    }
  }
}
