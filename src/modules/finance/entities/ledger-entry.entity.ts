import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { LedgerEntryType, LedgerCategory } from './wallet.entity';

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  walletId: string;

  @Column({ type: 'enum', enum: LedgerEntryType })
  type: LedgerEntryType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: LedgerCategory })
  category: LedgerCategory;

  @Column({ nullable: true })
  referenceId: string; // The Lease ID or Transaction ID

  @CreateDateColumn()
  createdAt: Date;
}
