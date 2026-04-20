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
            content: `You are a global real estate extraction expert with deep knowledge of Nigerian geography. 
Extract specific search parameters from the user message into the required JSON format.

LOCATION HIERARCHY RULES:
1. Identify the Scope: Determine if the user is mentioned a place in Nigeria or another country.
2. Nigerian Logic: 
   - Check if the mentioned "location" is one of the 36 States (or FCT).
   - If a State is mentioned (e.g., "Lagos"), check for a more specific "Full Address" or neighborhood within it (e.g., "Ikate", "Chevron Estate").
   - PRIORITY: Always extract the most granular point. If the user says "Apartment in Ikeja, Lagos", return "Ikeja". If they say "Maitama", return "Maitama".
3. International Logic: 
   - If the user specifies a location outside Nigeria (e.g., "London", "Accra", "Houston"), extract the City and Country clearly.
4. Default: If no specific area/city/state is mentioned, return null. DO NOT guess or default to "Lekki".

PARAMETER EXTRACTION RULES:
- "bedrooms": Extract ONLY the number (e.g., "3 bedroom", "three bed", "3 rooms" -> 3).
- "maxPrice": Convert currency slang to raw numbers (e.g., "5 million" or "5M" -> 5000000, "500k" -> 500000).
- "location": The specific neighborhood, estate, city, or state. (e.g., "Banana Island", "Enugu", or "New York").
- "vibe": Extract the descriptive "feel" (e.g., "luxury", "quiet", "modern", "gated").

Return ONLY JSON: 
{
  "location": string | null, 
  "maxPrice": number | null, 
  "bedrooms": number | null, 
  "vibe": string | null
}`,
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
