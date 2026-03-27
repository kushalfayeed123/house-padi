// src/modules/renting/entities/application.entity.ts
import { Profile } from 'src/modules/profile/entities/profile.entity';
import { Property } from 'src/modules/properties/entities/property.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'property_id', type: 'uuid' })
  property_id: string;

  @Column({ name: 'renter_id', type: 'uuid' })
  renter_id: string;

  @Column({
    type: 'text',
    default: 'submitted',
    // Options: 'submitted', 'screening', 'approved', 'rejected'
  })
  status: string;

  @Column({ name: 'ai_match_score', type: 'integer', nullable: true })
  ai_match_score: number;

  @Column({ name: 'screening_summary', type: 'text', nullable: true })
  screening_summary: string;

  @CreateDateColumn({ name: 'applied_at' })
  applied_at: Date;

  @ManyToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => Profile)
  @JoinColumn({ name: 'renter_id' })
  renter: Profile;
}
