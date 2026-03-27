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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Property,
      Application,
      Lease,
      Transaction,
      Profile,
    ]),
  ],
  controllers: [RentingController],
  providers: [TourService, LeaseService],
  exports: [LeaseService], // Export if other modules need to check lease status
})
export class RentingModule {}
