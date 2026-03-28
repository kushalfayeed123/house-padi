import { Module } from '@nestjs/common';
import { LedgerService } from './services/ledger/ledger.service';
import { PayoutProcessor } from './processors/payout.processor';
import { PayoutService } from './services/payout/payout.service';
import { BullModule } from '@nestjs/bullmq';
import { ReconciliationService } from './services/reconciliation/reconciliation.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Wallet } from './entities/wallet.entity';

@Module({
  imports: [
    ConfigModule.forRoot(), // Loads your .env file
    BullModule.forRootAsync({
      imports: [
        ConfigModule,
        TypeOrmModule.forFeature([
          LedgerEntry, // <-- MUST BE HERE
          Wallet,
          // ... other entities
        ]),
      ],
      useFactory: (configService: ConfigService) => ({
        connection: {
          // In production, this will be provided by your hosting provider
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          username: 'default', // Add this line
          // Standard for production Redis (TLS/SSL)
          tls: configService.get('REDIS_TLS') === 'true' ? {} : undefined,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'payouts',
    }),
  ],
  providers: [
    PayoutService,
    PayoutProcessor,
    LedgerService,
    ReconciliationService,
  ],
  exports: [PayoutService, BullModule],
})
export class FinanceModule {}
