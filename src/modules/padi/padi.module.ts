import { forwardRef, Module } from '@nestjs/common';
import { PadiController } from './padi.controller';
import { ChatBotService } from '../../common/chat-bot.service';
import { ProfileModule } from '../profile/profile.module';
import { PropertiesModule } from '../properties/properties.module';
import { RentingModule } from '../renting/renting.module';
import { PadiOrchestrator } from './padi.orchesrator';
import { AiService } from '../../common/ai.service';
import { TourService } from '../renting/services/tour/tour.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from '../properties/entities/property.entity';
import { Application } from '../renting/entities/application.entity';
import { ChatHistoryService } from '../chat/services/chat-history.service';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { PaymentService } from '../renting/services/payment/payment.service';

@Module({
  imports: [
    ProfileModule,
    PropertiesModule,
    RentingModule,
    TypeOrmModule.forFeature([Application, Property, ChatMessage]),
    forwardRef(() => PropertiesModule),
  ],
  controllers: [PadiController],
  providers: [
    PadiOrchestrator,
    ChatBotService,
    AiService,
    TourService,
    ChatHistoryService,
    PaymentService,
  ],
})
export class PadiModule {}
