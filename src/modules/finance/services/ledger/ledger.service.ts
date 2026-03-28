import { Injectable } from '@nestjs/common';
import { EntityManager, DataSource } from 'typeorm';
import { LedgerEntry } from '../../entities/ledger-entry.entity';
import {
  Wallet,
  LedgerCategory,
  LedgerEntryType,
} from '../../entities/wallet.entity';

// src/modules/finance/services/ledger.service.ts
@Injectable()
export class LedgerService {
  constructor(private readonly dataSource: DataSource) {}

  async creditUser(
    manager: EntityManager,
    userId: string,
    amount: number,
    category: LedgerCategory,
    referenceId: string,
  ) {
    // 1. Record the Ledger Entry
    // Using manager.create + manager.save is safer in transactions than manager.insert
    const entry = manager.create(LedgerEntry, {
      walletId: userId,
      amount,
      type: LedgerEntryType.CREDIT,
      category,
      referenceId,
    });
    await manager.save(entry);

    // 2. Increment the Wallet Balance
    await manager.increment(Wallet, { userId }, 'balance', amount);
  }

  async recordDebit(
    userId: string,
    amount: number,
    category: LedgerCategory,
    referenceId: string,
  ) {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Create the Debit entry using save() to avoid the subQuery error
      const entry = manager.create(LedgerEntry, {
        walletId: userId,
        amount: amount,
        type: LedgerEntryType.DEBIT,
        category,
        referenceId,
      });
      await manager.save(entry);

      // 2. Decrement the Wallet balance
      await manager.decrement(Wallet, { userId }, 'balance', amount);
    });
  }
}
