import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { BankDetail } from './bank-details.entity';

export enum KycStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Entity({ name: 'profiles' })
export class Profile {
  @PrimaryColumn('uuid')
  id: string; // This matches the Supabase Auth User ID

  @Column({ unique: true })
  email: string;

  @Column({ name: 'first_name', nullable: true })
  firstName: string;

  @Column({ name: 'last_name', nullable: true })
  lastName: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ default: 'user' }) // 'user', 'agent', 'admin'
  role: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Property, (property) => property.owner)
  properties: Property[];

  @Column({
    name: 'kyc_status',
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
  })
  kycStatus: KycStatus;

  @Column({ name: 'id_type', nullable: true })
  idType: string; // NIN, BVN, Passport

  @Column({ name: 'id_number', nullable: true })
  idNumber: string;

  @OneToOne(() => BankDetail, (bank) => bank.profile)
  bankDetail: BankDetail;

  @Column({ name: 'id_image_url', nullable: true })
  idImageUrl: string;
}
