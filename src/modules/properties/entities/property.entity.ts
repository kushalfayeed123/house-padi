// src/properties/entities/property.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { PropertyAnalysis } from 'src/common/schemas/property-analysis.schema';
import { Profile } from 'src/modules/profile/entities/profile.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';

export enum PropertyStatus {
  DRAFT = 'draft',
  AVAILABLE = 'available',
  PENDING = 'pending',
  RENTED = 'rented',
  ARCHIVED = 'archived',
}

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 1. Explicitly define ownerId as a column so you can save it directly
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  // 2. Add the relationship back to the Profile
  @ManyToOne(() => Profile, (profile) => profile.properties)
  @JoinColumn({ name: 'owner_id' })
  owner: Profile;

  // 3. Add the Lease Duration (e.g., 12 months)
  @Column({ name: 'lease_duration_months', type: 'int', default: 12 })
  leaseDurationMonths: number;

  // 4. Add the Agreement Content (The legal text)
  @Column({ name: 'agreement_content', type: 'text', nullable: true })
  agreementContent: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'price', type: 'numeric', precision: 12, scale: 2 })
  price: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ name: 'address_full' })
  addressFull: string;

  @Column()
  location: string;

  @Column('text', { array: true, default: '{}' })
  images: string[];

  @Column({ type: 'jsonb', default: {} })
  features: PropertyAnalysis['features'];

  @Column({ type: 'enum', enum: PropertyStatus, default: PropertyStatus.DRAFT })
  status: PropertyStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({
    type: 'object',
    properties: {
      type: { type: 'string', example: 'Point' },
      coordinates: {
        type: 'array',
        items: { type: 'number' },
        example: [7.3986, 9.0765],
      },
    },
  })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  coords: { type: 'Point'; coordinates: [number, number] };

  @Column({
    type: 'vector',
    nullable: true,
    length: 384,
  })
  embedding: number[];
  @Column({ type: 'text', nullable: true })
  aiSummary: string; // Ensure this matches exactly what you use in the .find()
}
