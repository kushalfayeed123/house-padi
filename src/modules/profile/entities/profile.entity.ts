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
import { KycVerification } from './kyc-veirifcation.entity';
import { KycStatus } from '../enums/kyc-status.enum';
import { Lease } from '../../renting/entities/lease.entity';

@Entity({ name: 'profiles' })
export class Profile {
  @PrimaryColumn('uuid')
  id!: string; // This matches the Supabase Auth User ID

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'first_name', nullable: true })
  firstName!: string;

  @Column({ name: 'last_name', nullable: true })
  lastName!: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl!: string;

  @Column({ default: 'user' }) // 'user', 'agent', 'admin'
  role!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber!: string;

  @OneToMany(() => Property, (property) => property.owner)
  properties!: Property[];

  @OneToMany(() => Lease, (lease) => lease.renter)
  // Note: Ensure the 'Lease' entity has a 'renter' ManyToOne relation
  leases!: any[];

  @Column({
    name: 'kyc_status',
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
  })
  kycStatus!: KycStatus;
  @OneToOne(() => KycVerification, (kyc) => kyc.profile)
  kyc!: KycVerification; // This links to the detailed KYC record

  @OneToOne(() => BankDetail, (bank) => bank.profile)
  bankDetail!: BankDetail;
}
