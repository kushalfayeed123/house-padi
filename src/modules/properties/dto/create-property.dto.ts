/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/properties/dto/create-property.dto.ts
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsObject,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PropertyStatus } from '../entities/property.entity';
import { Transform, Type } from 'class-transformer';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Luxury 2-Bedroom Apartment' })
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsString()
  addressFull!: string;

  @IsString()
  location!: string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsObject()
  @ApiProperty({ example: { bedrooms: 2, bathrooms: 2, parking: true } })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    return value;
  })
  features?: Record<string, any>;

  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiProperty({ example: 12 })
  @Type(() => Number) // <--- CRITICAL
  leaseDurationMonths!: number;

  @ApiProperty({ example: 'Standard Tenancy Agreement text...' })
  agreementContent!: string;
}
