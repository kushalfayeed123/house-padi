// src/common/schemas/property-analysis.schema.ts
import { z } from 'zod';

const coerceBoolean = z.preprocess(
  (val) => (val === null ? false : val),
  z.boolean().default(false),
);

const coerceNumber = z.preprocess(
  (val) => (val === null ? 0 : val),
  z.number().default(0),
);

export const AnalysisSchema = z.object({
  search_tags: z.array(z.string()).default([]),
  features: z
    .object({
      bedrooms: coerceNumber,
      bathrooms: coerceNumber,
      has_electricity_backup: coerceBoolean,
      furnished: coerceBoolean,
      is_luxury: coerceBoolean, // New: Let AI determine if it's "Luxury"
    })
    .default({}),
  ai_summary: z.string().default(''),
});

// 💡 ADD THIS LINE: This creates the TypeScript type from the Zod schema
export type PropertyAnalysis = z.infer<typeof AnalysisSchema>;
