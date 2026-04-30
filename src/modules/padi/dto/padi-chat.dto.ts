// src/modules/padi/dto/padi-chat.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class PadiChatDto {
  @ApiProperty({
    example: 'I want to list my 3 bedroom apartment in Jos for 2.5 million',
    description: 'The natural language message or command sent to Padi',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  message!: string;
}
