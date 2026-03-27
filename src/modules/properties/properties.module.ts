import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { Property } from './entities/property.entity';
import { AuthModule } from '../auth/auth.module';
import { PropertySubscriber } from './subscribers/property.subscriber';
import { AiService } from './ai.service';
import { Profile } from '../profile/entities/profile.entity';

@Module({
  imports: [
    // This creates the Repository for injection
    TypeOrmModule.forFeature([Property, Profile]),
    AuthModule,
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService, PropertySubscriber, AiService],
})
export class PropertiesModule {}
