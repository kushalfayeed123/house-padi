import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesModule } from './modules/properties/properties.module';
import { ProfileModule } from './modules/profile/profile.module';
import { AuthModule } from './modules/auth/auth.module';
import { RentingModule } from './modules/renting/renting.module';
import { ScheduleModule } from '@nestjs/schedule';
import { FinanceModule } from './modules/finance/finance.module';
import { AdminModule } from './modules/admin/admin.module';
import { OwnerModule } from './modules/owner/owner.module';
import { HttpModule } from '@nestjs/axios'; // Correct import
import { NewsController } from './common/news.controller';
import { NewsService } from './common/news.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    AuthModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
        ssl: {
          rejectUnauthorized: false,
        },
        // Professional pooling settings for Supavisor
        extra: {
          max: 20,
        },
      }),
    }),
    PropertiesModule,
    ProfileModule,
    RentingModule,
    FinanceModule,
    AdminModule,
    OwnerModule,
    HttpModule,
  ],
  controllers: [NewsController],
  providers: [NewsService],
})
export class AppModule {}
