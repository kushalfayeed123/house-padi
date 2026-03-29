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

export class CreatePropertyDto {
  @ApiProperty({ example: 'Luxury 2-Bedroom Apartment' })
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  addressFull: string;

  @IsString()
  location: string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsObject()
  @ApiProperty({ example: { bedrooms: 2, bathrooms: 2, parking: true } })
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
  leaseDurationMonths: number;

  @ApiProperty({ example: 'Standard Tenancy Agreement text...' })
  agreementContent: string;
}
