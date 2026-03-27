// src/modules/renting/dto/update-status.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({
    example: 'approved',
    enum: ['submitted', 'screening', 'approved', 'rejected'],
    description: 'The new status for the tour/rental application',
  })
  @IsNotEmpty()
  @IsEnum(['submitted', 'screening', 'approved', 'rejected'])
  status: string;
}
