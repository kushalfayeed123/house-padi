import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';

@Entity('leases')
export class Lease {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Column({ name: 'renter_id', type: 'uuid' })
  renterId: string;

  @Column({
    name: 'start_date', // This MUST match the actual DB column name
    type: 'date',
  })
  startDate: Date;

  @Column({
    name: 'monthly_rent', // Match the DB name
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  monthlyRent: number;

  @Column({
    name: 'contract_url', // Match the DB name
    nullable: true,
  })
  contractUrl: string;

  @Column({
    name: 'is_active', // Match the DB name
    default: false,
  })
  isActive: boolean;

  @ManyToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
