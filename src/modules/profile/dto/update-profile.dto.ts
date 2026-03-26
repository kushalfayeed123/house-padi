import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Oluwasegun Michael Ajanaku', required: false })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({
    example: 'https://storage.housepadi.com/avatars/me.jpg',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @ApiProperty({ example: '+2348012345678', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;
}
