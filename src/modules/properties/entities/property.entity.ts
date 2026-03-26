import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'properties' })
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'price_monthly', type: 'numeric' })
  price: number;

  @Column({ name: 'address_full' })
  addressFull: string;

  // Changed to plain text
  @Column({ type: 'text' })
  location: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'text', array: true, default: '{}' })
  images: string[];

  @Column({ type: 'jsonb', default: '{}' })
  features: Record<string, any>;

  @Column({
    type: 'enum',
    enum: ['draft', 'active', 'rented', 'archived'], // Match your property_status enum
    default: 'draft',
  })
  status: string;
}
