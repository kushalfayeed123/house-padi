/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/auth/auth.service.ts
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from '../profile/dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Profile } from '../profile/entities/profile.entity';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from '../finance/entities/wallet.entity';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private dataSource: DataSource,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }

  async register(dto: RegisterDto) {
    // 1. Create the Auth Identity in Supabase
    const { data: authData, error: authError } =
      await this.supabase.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      if (authError?.status === 422)
        throw new ConflictException('Email already exists.');
      throw new InternalServerErrorException(authError?.message);
    }

    const userId = authData.user.id;

    // 2. Start a Database Transaction for our internal tables
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // A. Initialize the Profile
      const profile = queryRunner.manager.create(Profile, {
        id: userId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        role: dto.role || 'user',
      });
      await queryRunner.manager.save(profile);

      // B. Initialize the Ledger/Wallet (The Fintech Core)
      // We create this now so they have a 0.00 balance ready for transactions
      const wallet = queryRunner.manager.create(Wallet, {
        userId: userId,
        balance: 0,
        currency: 'NGN',
        // If your ledger requires a specific 'Account Number' or 'Ref', generate it here
      });
      await queryRunner.manager.save(wallet);

      // Commit the internal database changes
      await queryRunner.commitTransaction();

      return {
        message: 'Registration successful. Profile and Ledger initialized.',
        userId: userId,
      };
    } catch (error) {
      // If ANY internal step fails, rollback the DB and delete the Supabase Auth user
      await queryRunner.rollbackTransaction();
      await this.supabase.auth.admin.deleteUser(userId);

      throw new InternalServerErrorException(
        'Account setup failed. Please try again.',
      );
    } finally {
      await queryRunner.release();
    }
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
