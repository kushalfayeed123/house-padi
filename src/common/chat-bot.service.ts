// src/common/chat-bot.service.ts

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import {
  PadiExecutionPlan,
  ExtractedFilters,
  PadiContext,
} from '../modules/padi/interfaces/padi-logic.interface';

@Injectable()
export class ChatBotService {
  private readonly groq: Groq;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'The GROQ_API_KEY environment variable is not defined.',
      );
    }
    this.groq = new Groq({ apiKey });
  }

  /**
   * Generates a strictly typed execution plan based on user intent and session context.
   * This determines which tool (Search, List, etc.) the orchestrator should trigger.
   */
  async generateExecutionPlan(
    message: string,
    context: PadiContext,
    history: { role: 'user' | 'assistant'; content: string }[] = [], // Added history parameter
  ): Promise<PadiExecutionPlan> {
    const completion = await this.groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are the HousePadi System Brain. Your goal is to map user intent to the correct tool while strictly returning a valid **json** object.

SCENARIO REGISTRY:

1. **Discovery & Search**: User is browsing, looking for apartments, or asking about availability.
   - Tool: SEARCH_PROPERTIES
   - Logic: Default action for any query describing a home requirement (e.g., "2 bedrooms in Jos").

2. **Tours & Applications**: User says "I want to visit," "Book a tour," or "Apply for [Property Name]."
   - Tool: CREATE_APPLICATION
   - Requirements: Needs a property ID or Name. If missing, ask the user to select a property first[cite: 1, 7].

3. **Lease Management**: User says "Send the contract," "Prepare the agreement," or "I don't want this lease anymore."
   - Tools: PREPARE_LEASE (to create) or DECLINE_LEASE (to reject)[cite: 2].

4. **Payments & Closing**: User says "I have paid," "Finalize my move-in," or provides a reference like "REF-123."
   - Tool: COMPLETE_RENTAL
   - Args: Requires "leaseId" and "paymentRef"[cite: 2, 4].

5. **Landlord/Owner Actions**: User says "Show my properties," "Approve this tenant," or "Who applied?"
   - Tools: GET_OWNER_DASHBOARD or UPDATE_APPLICATION_STATUS[cite: 1].

6. **Status Checks**: User asks "Where is my application?" or "What is my current rent status?"
   - Tools: GET_USER_APPLICATIONS or GET_RENTAL_STATUS[cite: 1, 2].

STRICT JSON OUTPUT FORMAT:
{
  "toolCalls": [
    {
      "name": "PadiToolName",
      "arguments": { "key": "value" }
    }
  ],
  "reasoning": "Brief explanation of why this tool was chosen."
}

CRITICAL RULES:
- If the user provides a payment reference, ALWAYS prioritize COMPLETE_RENTAL[cite: 4, 6].
- If the user hasn't specified a property yet, NEVER use CREATE_APPLICATION; use SEARCH_PROPERTIES instead.
- If the user is just chatting (e.g., "Hello"), return an empty toolCalls array.
  `,
        },
        ...history, // Inject history turns before the current user message
        { role: 'user', content: message },
      ],
      model: 'llama-3.1-8b-instant',
      response_format: { type: 'json_object' },
    });

    const content =
      completion.choices[0]?.message?.content || '{"toolCalls": []}';
    return JSON.parse(content) as PadiExecutionPlan;
  }

  /**
   * Extracts specific real estate filters (Location, Price, Bedrooms) from natural language.
   * Used by PropertiesService to refine database queries.
   */
  async extractSearchFilters(userMessage: string): Promise<ExtractedFilters> {
    const completion = await this.groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Extract real estate parameters from the query into a JSON object.
          Include: location (string), maxPrice (number), bedrooms (number), vibe (string).
          If a value is missing, return null for that key.`,
        },
        { role: 'user', content: userMessage },
      ],
      model: 'llama-3.1-8b-instant',
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as Partial<ExtractedFilters>;

    return {
      location: parsed.location ?? null,
      maxPrice: parsed.maxPrice ?? null,
      bedrooms: parsed.bedrooms ?? null,
      vibe: parsed.vibe ?? null,
    };
  }

  /**
   * Synthesizes the final conversational response for the user.
   * It takes the primary and secondary results and frames them in a human-like, professional tone.
   */
  async synthesizeResponse(
    userMessage: string,
    toolResults: Array<{
      tool: string;
      primary: string[];
      secondary: string[];
    }>,
    userName: string,
  ): Promise<string> {
    const completion = await this.groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are 'Padi', a sophisticated and empathetic real estate advisor for HousePadi.
          
          RULES:
          1. Use formal, professional, and human-like English. Never use slang.
          2. Acknowledge the user's specific request for "${userMessage}".
          3. Emphasize Primary results as perfect matches.
          4. Introduce Secondary results as "refined alternatives for your consideration."
          5. Maximum of 4 sentences. Be concise but warm.`,
        },
        {
          role: 'user',
          content: `User Name: ${userName} | Data: ${JSON.stringify(toolResults)}`,
        },
      ],
      model: 'llama-3.1-8b-instant',
    });

    return (
      completion.choices[0]?.message?.content ||
      'I have curated several exceptional options for your review.'
    );
  }
}
