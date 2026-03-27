import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class UpdateBankDetailsDto {
  @ApiProperty({ example: '058' })
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @ApiProperty({ example: 'GTBank' })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({ example: '0123456789' })
  @IsString()
  @Length(10, 10)
  accountNumber: string;

  @ApiProperty({ example: 'Oluwasegun Michael Ajanaku' })
  @IsString()
  @IsNotEmpty()
  accountName: string;
}
