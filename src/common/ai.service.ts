/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/properties/ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey!);
  }

  async analyzeProperty(title: string, description: string) {
    // 1. Define the exact shape of data we want back
    const schema: Schema = {
      description: 'Property features and search tags extraction',
      type: SchemaType.OBJECT,
      properties: {
        tags: {
          type: SchemaType.ARRAY,
          description:
            "List of 5-10 SEO and 'vibe' tags (e.g., quiet, luxury, student-friendly)",
          items: { type: SchemaType.STRING },
        },
        features: {
          type: SchemaType.OBJECT,
          description:
            'Key-value pairs of physical features discovered in text',
          properties: {
            bedrooms: { type: SchemaType.NUMBER },
            bathrooms: { type: SchemaType.NUMBER },
            has_electricity_backup: { type: SchemaType.BOOLEAN },
            furnished: { type: SchemaType.BOOLEAN },
          },
        },
        ai_summary: {
          type: SchemaType.STRING,
          description:
            'A 1-sentence catchy summary for the search results page',
        },
      },
      required: ['tags', 'features', 'ai_summary'],
    };

    const model = this.genAI.getGenerativeModel({
      // CHANGE THIS: 'gemini-1.5-flash' -> 'gemini-3-flash-preview' (or 'gemini-2.5-flash')
      model: 'gemini-3.1-pro-preview',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    const prompt = `
      Analyze this property listing and extract structured data.
      Title: ${title}
      Description: ${description}

      CRITICAL INSTRUCTIONS FOR TAGS:
      1. Always include the bedroom and bathroom count as tags (e.g., "3 bedrooms", "2 bathrooms").
      2. Include the property type if found (e.g., "apartment", "duplex").
      3. Include the location mentioned in the text.
      4. Add 3-5 "vibe" tags (e.g., "luxury", "student-friendly").
    `;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      return JSON.parse(responseText);
    } catch (error) {
      this.logger.error('Gemini Analysis failed:', error.message);
      return null;
    }
  }
}
