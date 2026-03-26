import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';

@Entity({ name: 'profiles' })
export class Profile {
  @PrimaryColumn('uuid')
  id: string; // This matches the Supabase Auth User ID

  @Column({ unique: true })
  email: string;

  @Column({ name: 'full_name', nullable: true })
  fullName: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ default: 'user' }) // 'user', 'agent', 'admin'
  role: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Property, (property) => property.ownerId)
  properties: Property[];
}
