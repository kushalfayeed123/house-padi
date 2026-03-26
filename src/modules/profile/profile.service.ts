import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './entities/profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
  ) {}

  async findOne(id: string): Promise<Profile> {
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
    const profile = await this.profileRepo.preload({
      id: id,
      ...updateProfileDto,
    });

    if (!profile) throw new NotFoundException('Profile not found');
    return this.profileRepo.save(profile);
  }
}
