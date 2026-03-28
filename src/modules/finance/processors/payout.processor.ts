/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/modules/finance/processors/payout.processor.ts
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { InternalServerErrorException } from '@nestjs/common';
import { LedgerCategory } from '../entities/wallet.entity';
import { LedgerService } from '../services/ledger/ledger.service';
import { BankDetail } from 'src/modules/profile/entities/bank-details.entity';

interface PayoutJobData {
  bankDetail: BankDetail;
  amount: number;
  transactionId: string;
  ownerId: string;
}

@Processor('payouts')
export class PayoutProcessor extends WorkerHost {
  constructor(private readonly ledgerService: LedgerService) {
    super();
  }

  // This is the core method called by BullMQ
  async process(job: Job<PayoutJobData, any, string>): Promise<any> {
    const { bankDetail, amount, transactionId, ownerId } = job.data;

    try {
      // 1. Logic for External Payout (e.g., Paystack/Flutterwave)
      // This is where you'd call your payment provider's 'Initiate Transfer' API.
      console.log(
        `[Payout] Processing ${amount} for owner ${ownerId} via ${bankDetail.bankName}`,
      );

      // 2. Record the DEBIT in the ledger
      // Using 'transaction' inside recordDebit is safer to ensure consistency
      await this.ledgerService.recordDebit(
        ownerId,
        amount,
        LedgerCategory.WITHDRAWAL,
        transactionId,
      );

      return { status: 'disbursed', at: new Date().toISOString() };
    } catch (error) {
      // If we throw here, BullMQ marks the job as 'failed' and retries based on your config
      throw new InternalServerErrorException(
        `Payout failed for transaction ${transactionId}: ${error.message}`,
      );
    }
  }

  // 3. LISTENERS: These are great for logging without affecting the logic
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    console.log(`[Payout] Successfully disbursed funds for Job ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    console.error(
      `[Payout] Job ${job.id} failed after attempts: ${error.message}`,
    );
    // Here you could trigger a Slack notification or Email to the House Padi Admin
  }
}
