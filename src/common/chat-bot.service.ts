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
            content: `You are a real estate assistant. Extract search parameters. 
            Return ONLY JSON: {"location": string, "maxPrice": number, "bedrooms": number, "vibe": string}.
            Use null for missing values.`,
          },
          { role: 'user', content: userMessage },
        ],
        model: 'llama3-8b-8192',
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
