/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/auth/auth.service.ts
import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from '../profile/dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }

  async register(dto: RegisterDto) {
    const { data: authData, error: authError } =
      await this.supabase.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
      });

    if (authError) {
      // Check if it's a "User already registered" error from Supabase
      if (
        authError.status === 422 ||
        authError.message.includes('already registered')
      ) {
        throw new ConflictException(
          'A user with this email address already exists.',
        );
      }
      throw new InternalServerErrorException(authError.message);
    }

    const { error: profileError } = await this.supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        first_name: dto.firstName,
        last_name: dto.lastName,
        role: dto.role,
        phone_number: dto.phoneNumber,
      });

    if (profileError) {
      // Cleanup: Delete the auth user if profile creation fails to maintain integrity
      await this.supabase.auth.admin.deleteUser(authData.user.id);
      throw new InternalServerErrorException(
        'Profile setup failed. Please try again.',
      );
    }

    return {
      message: 'User registered successfully',
      userId: authData.user.id,
    };
  }
  async login(dto: LoginDto) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error) throw new UnauthorizedException('Invalid email or password');

    return {
      access_token: data.session?.access_token,
      user: data.user,
    };
  }
}
