import { Module } from '@nestjs/common';
import { OwnerController } from './controllers/owner.controller';
import { OwnerService } from './services/owner.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from '../properties/entities/property.entity';
import { Application } from '../renting/entities/application.entity';
import { Wallet } from '../finance/entities/wallet.entity';
import { PropertiesService } from '../properties/services/properties.service';
import { LeaseService } from '../renting/services/lease/lease.service';
import { TourService } from '../renting/services/tour/tour.service';
import { Profile } from '../profile/entities/profile.entity';

import { Lease } from '../renting/entities/lease.entity';
import { ContractService } from '../renting/services/contract/contract.service';
import { LedgerService } from '../finance/services/ledger/ledger.service';
import { PayoutService } from '../finance/services/payout/payout.service';
import { BullModule } from '@nestjs/bullmq';
import { AiService } from '../../common/ai.service';
import { ChatBotService } from '../../common/chat-bot.service';
import { StorageService } from '../../common/storage.service';

@Module({
  imports: [
    // This creates the Repository for injection
    TypeOrmModule.forFeature([Property, Application, Wallet, Profile, Lease]),
    BullModule.registerQueue({
      name: 'payouts',
    }),
  ],
  controllers: [OwnerController],
  providers: [
    OwnerService,
    PropertiesService,
    TourService,
    LeaseService,
    ChatBotService,
    AiService,
    ContractService,
    LedgerService,
    PayoutService,
    StorageService,
  ],
})
export class OwnerModule {}
