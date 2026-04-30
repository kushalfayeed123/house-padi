// src/modules/padi/interfaces/padi-logic.interface.ts

import { Property } from '../../properties/entities/property.entity';

export interface ExtractedFilters {
  location: string | null;
  maxPrice: number | null;
  bedrooms: number | null;
  vibe: string | null;
}

export interface PadiToolCall {
  name: string;
  arguments: {
    query?: string;
    [key: string]: unknown;
  };
}

export interface PadiExecutionPlan {
  toolCalls: PadiToolCall[];
}

export interface PadiServiceResponse {
  padi_summary: string;
  count: number;
  data: Property[];
  suggestions: Property[];
}

export interface PadiContext {
  isLoggedIn: boolean;
  userName: string;
  kycStatus: string;
}

export interface PropertySummary {
  title: string;
  location: string;
  price: number | string;
  bedrooms?: number;
}
