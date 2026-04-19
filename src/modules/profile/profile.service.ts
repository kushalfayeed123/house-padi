import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './entities/profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { BankDetail } from './entities/bank-details.entity';
import { CompleteKycDto } from './dto/complete-kyc.dto';
import { UpdateBankDetailsDto } from './dto/update-bank-details.dto';
import { KycVerification } from './entities/kyc-veirifcation.entity';
import { KycStatus } from './enums/kyc-status.enum';
import { StorageService } from '../../common/storage.service';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(BankDetail) private bankRepo: Repository<BankDetail>,
    private readonly storageService: StorageService,
    @InjectRepository(KycVerification)
    private kycRepo: Repository<KycVerification>,
  ) {}

  async findAll(): Promise<Profile[]> {
    return await this.profileRepo.find();
  }

  async findOne(id: string): Promise<Profile> {
    const profile = await this.profileRepo.findOne({
      where: { id },
      relations: ['bankDetail', 'properties', 'kyc'],
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async update(
    id: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<Profile> {
    const profile = await this.findOne(id);

    Object.assign(profile, updateProfileDto);

    return await this.profileRepo.save(profile);
  }

  async updateBankDetails(userId: string, dto: UpdateBankDetailsDto) {
    let bank = await this.bankRepo.findOne({
      where: { userId },
    });
    if (bank) {
      Object.assign(bank, dto);
    } else {
      bank = this.bankRepo.create({ ...dto, userId });
    }

    return await this.bankRepo.save(bank);
  }

  async submitKyc(
    userId: string,
    dto: CompleteKycDto,
    file: Express.Multer.File,
  ) {
    // 1. Validate User
    const profile = await this.profileRepo.findOne({ where: { id: userId } });
    if (!profile) throw new NotFoundException('Profile not found');

    // 2. Upload file (userId ensures the path is correct: kyc-documents/{userId}/...)
    const fileUrl = await this.storageService.uploadKycDoc(userId, file);

    // 3. Find existing KYC or create new one
    let kyc = await this.kycRepo.findOne({ where: { userId } });
    if (kyc) {
      kyc.idType = dto.idType;
      kyc.idNumber = dto.idNumber;
      kyc.idImageUrl = fileUrl;
      kyc.status = KycStatus.PENDING;
      kyc.rejectionReason = ''; // Clear old reason if they are re-submitting
    } else {
      kyc = this.kycRepo.create({
        userId: userId,
        idType: dto.idType,
        idNumber: dto.idNumber,
        idImageUrl: fileUrl,
        status: KycStatus.PENDING,
      });
    }

    // 4. Save the detailed KYC record
    await this.kycRepo.save(kyc);

    // 5. Update the flag on the profile for fast UI checks
    profile.kycStatus = KycStatus.PENDING;
    await this.profileRepo.save(profile);

    return kyc;
  }
}
