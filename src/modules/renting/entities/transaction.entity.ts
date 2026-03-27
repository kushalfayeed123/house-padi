// src/modules/transactions/entities/transaction.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Lease } from './lease.entity';

export enum TransactionType {
  RENT_PAYMENT = 'rent_payment',
  LISTING_FEE = 'listing_fee',
  SCREENING_FEE = 'screening_fee',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lease_id', type: 'uuid' })
  lease_id: string;

  @Column({ name: 'payer_id', type: 'uuid' })
  payer_id: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'platform_fee', type: 'numeric', precision: 12, scale: 2 })
  platform_fee: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ name: 'payment_gateway_ref', unique: true })
  payment_gateway_ref: string;

  @Column()
  status: string; // 'pending', 'success', 'failed'

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => Lease)
  @JoinColumn({ name: 'lease_id' })
  lease: Lease;

  @Column({
    type: 'enum',
    enum: TransactionType,
    default: TransactionType.RENT_PAYMENT,
  })
  type: TransactionType;
}
