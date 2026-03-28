import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Profile } from './profile.entity';
import { KycStatus } from '../enums/kyc-status.enum';

@Entity({ name: 'kyc_verifications' })
export class KycVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @OneToOne(() => Profile, (profile) => profile.kyc)
  @JoinColumn({ name: 'user_id' })
  profile: Profile;

  @Column({
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
  })
  status: KycStatus;

  @Column({ name: 'id_type' })
  idType: string; // NIN, BVN, Passport

  @Column({ name: 'id_number' })
  idNumber: string;

  @Column({ name: 'id_image_url' })
  idImageUrl: string;

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
