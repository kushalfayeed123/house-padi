// src/modules/renting/renting.module.ts
import { forwardRef, Module } from '@nestjs/common';
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
import { FinanceModule } from '../finance/finance.module';
import { PropertiesService } from '../properties/services/properties.service';
import { StorageService } from '../../common/storage.service';
import { AiService } from '../../common/ai.service';
import { ChatBotService } from '../../common/chat-bot.service';
import { PropertiesModule } from '../properties/properties.module';
import {
  MockPaymentProvider,
  PaymentService,
} from './services/payment/payment.service';

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
    forwardRef(() => PropertiesModule),
  ],
  controllers: [RentingController],
  providers: [
    TourService,
    LeaseService,
    PaymentService,
    ContractService,
    LedgerService,
    PayoutService,
    StorageService,
    AiService,
    PropertiesService,
    ChatBotService,
    {
      provide: 'PAYMENT_PROVIDER', // This must match the @Inject() token above
      useClass: MockPaymentProvider, // Provide your mock or real implementation
    },
  ],
  exports: [LeaseService, PaymentService, 'PAYMENT_PROVIDER'],
})
export class RentingModule {}
