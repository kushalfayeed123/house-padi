// src/modules/renting/dto/payment-complete.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsNotEmpty } from 'class-validator';

export class PaymentCompleteDto {
  @ApiProperty({ example: 'uuid-of-the-lease' })
  @IsUUID()
  leaseId: string;

  @ApiProperty({ example: 'paystack_ref_12345' })
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiProperty({ example: 'uuid-of-the-renter' })
  @IsUUID()
  userId: string;
}
