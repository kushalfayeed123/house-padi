import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  IsUUID,
  IsArray,
} from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  title: string;

  @IsNumber()
  price: number;

  @IsString()
  addressFull: string;

  @IsString()
  location: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsObject()
  @IsOptional()
  features?: Record<string, any>;

  @IsUUID()
  @IsOptional()
  ownerId?: string;
}
