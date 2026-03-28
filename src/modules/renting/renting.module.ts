// src/modules/renting/renting.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentingController } from './renting.controller';

// Entities
import { Property } from '../properties/entities/property.entity';
import { Application } from './entities/application.entity';
import { Lease } from './entities/lease.entity';
import { Transaction } from './entities/transaction.entity';
import { LeaseService } from './services/lease/lease.service';
import { TourService } from './services/tour/tour.service';
import { Profile } from '../profile/entities/profile.entity';
import { ContractService } from './services/contract/contract.service';
import { LedgerService } from '../finance/services/ledger/ledger.service';
import { PayoutService } from '../finance/services/payout/payout.service';
import { StorageService } from 'src/common/storage.service';
import { FinanceModule } from '../finance/finance.module';
import { AiService } from 'src/common/ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Property,
      Application,
      Lease,
      Transaction,
      Profile,
    ]),
    FinanceModule,
  ],
  controllers: [RentingController],
  providers: [
    TourService,
    LeaseService,
    ContractService,
    LedgerService,
    PayoutService,
    StorageService,
    AiService,
  ],
  exports: [LeaseService], // Export if other modules need to check lease status
})
export class RentingModule {}
