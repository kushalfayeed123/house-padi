import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserRole {
  RENTER = 'renter',
  OWNER = 'owner',
  ADMIN = 'admin',
}
export class RegisterDto {
  @ApiProperty({
    example: 'segun.ajanaku@example.com',
    description: 'The unique email address for the user',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'PadiSecure123!',
    minLength: 8,
    description: 'User password (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Oluwasegun', description: 'User first name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Ajanaku', description: 'User last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.RENTER,
    description: 'The role of the user within the platform',
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    example: '+2348012345678',
    description: 'Optional contact phone number',
  })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;
}
