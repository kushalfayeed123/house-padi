import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesController } from './properties.controller';
import { Property } from './entities/property.entity';
import { AuthModule } from '../auth/auth.module';
import { PropertySubscriber } from './subscribers/property.subscriber';
import { AiService } from '../../common/ai.service';
import { Profile } from '../profile/entities/profile.entity';
import { PropertiesService } from './services/properties.service';
import { AiSyncService } from '../../common/ai-sync.service';
import { ChatBotService } from '../../common/chat-bot.service';
import { StorageService } from '../../common/storage.service';
import { TourService } from '../renting/services/tour/tour.service';
import { LeaseService } from '../renting/services/lease/lease.service';
import { Application } from '../renting/entities/application.entity';
import { Lease } from '../renting/entities/lease.entity';
import { ContractService } from '../renting/services/contract/contract.service';
import { LedgerService } from '../finance/services/ledger/ledger.service';
import { PayoutService } from '../finance/services/payout/payout.service';
import { BullModule } from '@nestjs/bullmq';
import { RentingModule } from '../renting/renting.module';

@Module({
  imports: [
    // This creates the Repository for injection
    TypeOrmModule.forFeature([Property, Profile, Application, Lease]),
    BullModule.registerQueue({
      name: 'payouts',
    }),
    AuthModule,
    forwardRef(() => RentingModule),
  ],
  controllers: [PropertiesController],
  providers: [
    PropertiesService,
    PropertySubscriber,
    AiService,
    ChatBotService,
    ContractService,
    AiSyncService,
    StorageService,
    TourService,
    LeaseService,
    LedgerService,
    PayoutService,
  ],
})
export class PropertiesModule {}
