import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { Property } from './entities/property.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    // This creates the Repository for injection
    TypeOrmModule.forFeature([Property]),
    AuthModule,
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
