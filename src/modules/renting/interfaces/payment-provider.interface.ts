export interface IPaymentVerificationResult {
  success: boolean;
  amountPaid: number;
  currency: string;
  metadata?: any;
}

export interface IPaymentProvider {
  verifyTransaction(
    reference: string,
    amount: number,
  ): Promise<IPaymentVerificationResult>;
}
