import { Module } from '@nestjs/common';
import { AdminProfileService } from './service/admin-profile/admin-profile.service';
import { AdminProfileController } from './controller/admin-profile/admin-profile.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycVerification } from '../profile/entities/kyc-veirifcation.entity';
import { Profile } from '../profile/entities/profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Profile, KycVerification])],
  controllers: [AdminProfileController],
  providers: [AdminProfileService],
})
export class AdminModule {}
