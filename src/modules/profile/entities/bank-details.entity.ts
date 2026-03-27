// src/modules/profile/entities/bank-detail.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  JoinColumn,
  Column,
  OneToOne,
} from 'typeorm';
import { Profile } from './profile.entity';

@Entity('bank_details')
export class BankDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 1. You MUST add this property for your 'where: { userId }' query to work
  @Column({ name: 'user_id' })
  userId: string;

  // 2. This is the relationship for joins
  @OneToOne(() => Profile, (profile) => profile.bankDetail)
  @JoinColumn({ name: 'user_id' })
  profile: Profile;

  @Column({ name: 'bank_name' }) // Maps 'bankName' to 'bank_name'
  bankName: string;

  @Column({ name: 'bank_code' }) // Fixes the error you just saw
  bankCode: string;

  @Column({ name: 'account_number' }) // Maps 'accountNumber' to 'account_number'
  accountNumber: string;

  @Column({ name: 'account_name' }) // Maps 'accountName' to 'account_name'
  accountName: string;

  @Column({ name: 'recipient_code', nullable: true })
  recipientCode: string;
}
