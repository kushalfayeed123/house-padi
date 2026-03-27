import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CompleteKycDto {
  @ApiProperty({ example: 'NIN', description: 'NIN, BVN, or PASSPORT' })
  @IsString()
  @IsNotEmpty()
  idType: string;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  @IsNotEmpty()
  idNumber: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The ID card image file',
  })
  idImage: any;
}
