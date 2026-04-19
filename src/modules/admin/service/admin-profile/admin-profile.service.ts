// src/modules/admin/admin-profile.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { KycVerification } from '../../../profile/entities/kyc-veirifcation.entity';
import { Profile } from '../../../profile/entities/profile.entity';
import { KycStatus } from '../../../profile/enums/kyc-status.enum';

@Injectable()
export class AdminProfileService {
  constructor(
    @InjectRepository(KycVerification)
    private readonly kycRepo: Repository<KycVerification>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
  ) {}

  async getPendingVerifications() {
    return await this.kycRepo.find({
      where: { status: KycStatus.PENDING },
      relations: ['profile'],
      order: { createdAt: 'ASC' },
    });
  }

  async verifyUserKyc(userId: string, status: KycStatus, reason: string) {
    const kyc = await this.kycRepo.findOne({ where: { userId } });
    if (!kyc) throw new NotFoundException('KYC record not found for this user');

    const profile = await this.profileRepo.findOne({ where: { id: userId } });
    if (!profile) throw new NotFoundException('Profile not found');

    if (status === KycStatus.REJECTED && !reason) {
      throw new BadRequestException('A rejection reason is required');
    }

    // Update the detailed KYC record
    kyc.status = status;
    kyc.rejectionReason = status === KycStatus.REJECTED ? reason : '';
    await this.kycRepo.save(kyc);

    // Sync the status to the Profile for quick access
    profile.kycStatus = status;
    await this.profileRepo.save(profile);

    return { message: `User KYC ${status} successfully`, userId };
  }
}
