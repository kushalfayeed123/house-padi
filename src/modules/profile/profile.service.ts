import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycStatus, Profile } from './entities/profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { BankDetail } from './entities/bank-details.entity';
import { CompleteKycDto } from './dto/complete-kyc.dto';
import { UpdateBankDetailsDto } from './dto/update-bank-details.dto';
import { StorageService } from 'src/common/storage.service';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(BankDetail) private bankRepo: Repository<BankDetail>,
    private readonly storageService: StorageService,
  ) {}

  async findAll(): Promise<Profile[]> {
    return await this.profileRepo.find();
  }

  async findOne(id: string): Promise<Profile> {
    console.log(id);

    const profile = await this.profileRepo.findOne({
      where: { id },
      relations: ['properties'],
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
    const profile = await this.profileRepo.findOne({ where: { id: userId } });
    if (!profile) throw new NotFoundException('Profile not found');

    // 1. Upload the file to your Storage Bucket
    // path: kyc-documents/{userId}/{filename}
    const fileUrl = await this.storageService.uploadKycDoc(userId, file);

    // 2. Update Profile with ID info and the document link
    profile.idType = dto.idType;
    profile.idNumber = dto.idNumber;
    profile.idImageUrl = fileUrl; // Add this column to your Profile Entity if missing
    profile.kycStatus = KycStatus.PENDING; // Needs manual admin review now!

    return await this.profileRepo.save(profile);
  }
}
