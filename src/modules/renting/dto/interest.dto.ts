import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsDateString } from 'class-validator';

export class InterestDto {
  @ApiProperty({ example: 'uuid-of-property' })
  @IsUUID()
  propertyId?: string;

  @ApiProperty({ required: false, example: '2026-04-10T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  tourDate?: Date;
}
