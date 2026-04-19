/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/properties/dto/update-property.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreatePropertyDto } from './create-property.dto';
import { IsOptional, IsBoolean, IsArray, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    // If no images are sent, return an empty array
    if (!value) return [];
    // If only one image is sent, it comes as a string; wrap it in an array
    if (typeof value === 'string') return [value];
    // If multiple images are sent, it's already an array
    return value;
  })
  images?: string[];
}
