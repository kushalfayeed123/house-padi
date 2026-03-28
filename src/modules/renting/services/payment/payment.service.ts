/* eslint-disable @typescript-eslint/require-await */
// src/modules/renting/services/payment.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import type {
  IPaymentProvider,
  IPaymentVerificationResult,
} from '../../interfaces/payment-provider.interface';
import { LeaseService } from '../lease/lease.service';

@Injectable()
export class PaymentService {
  constructor(
    private leaseService: LeaseService,
    private paymentProvider: IPaymentProvider, // Injected via a Provider Token
  ) {}

  async handlePaymentWebhook(
    reference: string,
    leaseId: string,
    userId: string,
    amount: number,
  ) {
    // 1. External Verification (Future Paystack/Flutterwave call)
    const verification = await this.paymentProvider.verifyTransaction(
      reference,
      amount,
    );

    if (!verification.success) {
      throw new BadRequestException(
        'Payment verification failed at the gateway.',
      );
    }

    // 2. Business Logic Verification (Does amount match Lease?)
    const lease = await this.leaseService.getLeaseById(leaseId);
    if (verification.amountPaid < lease.rent) {
      throw new BadRequestException(
        'Underpayment detected. Flagging for manual review.',
      );
    }

    // 3. Finalize the Rental (The Locked Transaction we wrote earlier)
    return await this.leaseService.completeRental(leaseId, reference, userId);
  }
}

// src/modules/renting/providers/mock-payment.provider.ts
@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  async verifyTransaction(
    reference: string,
    amount: number,
  ): Promise<IPaymentVerificationResult> {
    console.log(`Simulating external API call for ref: ${reference}`);

    // Simulate a successful verification
    return {
      success: true,
      amountPaid: amount, // Match this to your test house price
      currency: 'NGN',
    };
  }
}
