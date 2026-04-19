import { Module } from '@nestjs/common';
import { Profile } from './entities/profile.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesController } from './profile.controller';
import { ProfilesService } from './profile.service';
import { BankDetail } from './entities/bank-details.entity';
import { KycVerification } from './entities/kyc-veirifcation.entity';
import { StorageService } from '../../common/storage.service';

@Module({
  imports: [
    // This creates the Repository for injection
    TypeOrmModule.forFeature([Profile, BankDetail, KycVerification]),
  ],
  controllers: [ProfilesController],
  providers: [ProfilesService, StorageService],
  exports: [ProfilesService], // Export it so PropertiesService can use it
})
export class ProfileModule {}
