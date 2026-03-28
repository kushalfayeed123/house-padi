// src/modules/finance/services/payout.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq'; // Fixed: Import from @nestjs/bullmq
import { Queue } from 'bullmq'; // Fixed: Import from bullmq
import { BankDetail } from 'src/modules/profile/entities/bank-details.entity';

@Injectable()
export class PayoutService {
  constructor(
    @InjectQueue('payouts') private readonly payoutQueue: Queue, // Correctly typed
  ) {}

  async queueAutoPayout(
    bankDetail: BankDetail,
    amount: number,
    transactionId: string,
    ownerId: string,
  ) {
    if (!bankDetail) return;

    // The 'add' method is now safely typed
    await this.payoutQueue.add('process-payout', {
      bankDetail,
      amount,
      transactionId,
      ownerId,
    });
  }
}
