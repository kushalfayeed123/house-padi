// src/modules/renting/entities/application.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Profile } from '../../profile/entities/profile.entity';
import { Property } from '../../properties/entities/property.entity';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'property_id', type: 'uuid' })
  property_id!: string;

  @Column({ name: 'renter_id', type: 'uuid' })
  renter_id!: string;

  @Column({
    type: 'text',
    default: 'submitted',
    // Options: 'submitted', 'screening', 'approved', 'rejected'
  })
  status!: string;

  @Column({ name: 'ai_match_score', type: 'integer', nullable: true })
  ai_match_score!: number;

  @Column({ name: 'screening_summary', type: 'text', nullable: true })
  screening_summary!: string;

  @CreateDateColumn({ name: 'applied_at' })
  applied_at!: Date;

  @ManyToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property!: Property;

  @ManyToOne(() => Profile)
  @JoinColumn({ name: 'renter_id' })
  renter!: Profile;

  @Column({ nullable: true })
  lease_id!: string;

  @Column({ nullable: true })
  contract_url!: string;
}
