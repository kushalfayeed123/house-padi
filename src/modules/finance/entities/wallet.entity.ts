import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

// src/modules/finance/entities/wallet.entity.ts
@Entity('wallets')
export class Wallet {
  @PrimaryColumn('uuid')
  userId: string; // Maps to Profile.id

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number;

  @UpdateDateColumn()
  updatedAt: Date;
}

// src/modules/finance/entities/ledger.entity.ts
export enum LedgerEntryType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum LedgerCategory {
  RENT_INCOME = 'rent_income', // For Owners
  PLATFORM_FEE = 'platform_fee', // For House Padi
  WITHDRAWAL = 'withdrawal', // For Payouts to Bank
}
