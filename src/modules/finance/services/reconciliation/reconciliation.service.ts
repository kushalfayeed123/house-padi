// src/modules/finance/services/reconciliation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { LedgerEntryType, Wallet } from '../../entities/wallet.entity';
import { LedgerEntry } from '../../entities/ledger-entry.entity';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDailyAudit() {
    this.logger.log('Starting Daily Financial Reconciliation Audit...');

    const wallets = await this.dataSource.getRepository(Wallet).find();
    let discrepancyCount = 0;

    for (const wallet of wallets) {
      const isAccurate = await this.verifyWalletIntegrity(
        wallet.userId,
        Number(wallet.balance),
      );

      if (!isAccurate) {
        discrepancyCount++;
        // Logic: Send an alert to your Slack/Email or flag the user
        this.logger.error(
          `CRITICAL: Integrity failure for User ${wallet.userId}. Balance does not match Ledger.`,
        );
      }
    }

    this.logger.log(`Audit complete. Found ${discrepancyCount} discrepancies.`);
  }

  private async verifyWalletIntegrity(
    userId: string,
    currentBalance: number,
  ): Promise<boolean> {
    const ledgerRepo = this.dataSource.getRepository(LedgerEntry);

    // Sum all Credits and Debits for this user
    const result = await ledgerRepo
      .createQueryBuilder('ledger')
      .select(
        'SUM(CASE WHEN ledger.type = :credit THEN ledger.amount ELSE 0 END)',
        'totalCredits',
      )
      .addSelect(
        'SUM(CASE WHEN ledger.type = :debit THEN ledger.amount ELSE 0 END)',
        'totalDebits',
      )
      .where('ledger.walletId = :userId', {
        userId,
        credit: LedgerEntryType.CREDIT,
        debit: LedgerEntryType.DEBIT,
      })
      .getRawOne<{ totalCredits: string; totalDebits: string }>();

    const totalCredits = parseFloat(result?.totalCredits || '0');
    const totalDebits = parseFloat(result?.totalDebits || '0');
    const calculatedBalance = totalCredits - totalDebits;

    // Use a small epsilon for decimal comparison to avoid floating point issues
    const isMatch = Math.abs(calculatedBalance - currentBalance) < 0.01;

    return isMatch;
  }
}
