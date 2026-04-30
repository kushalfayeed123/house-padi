// src/properties/dto/search-property.dto.ts
import {
  IsOptional,
  IsString,
  IsNumber,
  IsPositive,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PadiContext } from '../../padi/interfaces/padi-logic.interface';

export class SearchPropertyDto {
  @IsOptional()
  tags?: string | string[];

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  // --- NEW: Geospatial Parameters ---

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Max(50) // Limit search to 50km to keep queries performant
  radius?: number;

  @IsOptional()
  @IsString()
  chatPrompt?: string; // <--- The "Vibe" search input

  context!: PadiContext; // Required to satisfy strictly typed service calls
}
