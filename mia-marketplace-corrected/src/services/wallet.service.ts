/**
 * Client wrapper around every money-related Cloud Function. Nothing here
 * ever computes or trusts a balance itself - it only calls the server
 * and reflects back whatever it returns. Real balances are read via
 * useWallet (realtime Firestore listener), never computed client-side.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export interface RechargeResult {
  checkoutUrl: string;
}

export interface PayoutRecipient {
  phone?: string;
  account_number?: string;
  first_name?: string;
  last_name?: string;
}

class WalletService {
  async initiateRecharge(amount: number, returnUrl: string, currency = 'XOF'): Promise<RechargeResult> {
    const call = httpsCallable<{ amount: number; currency: string; returnUrl: string }, RechargeResult>(
      functions,
      'initiateWalletRecharge'
    );
    const { data } = await call({ amount, currency, returnUrl });
    return data;
  }

  async purchaseWithWallet(orderId: string): Promise<{ ok: true }> {
    const call = httpsCallable<{ orderId: string }, { ok: true }>(functions, 'purchaseWithWallet');
    const { data } = await call({ orderId });
    return data;
  }

  async requestPayout(amount: number, method: string, recipient: PayoutRecipient) {
    const call = httpsCallable<
      { amount: number; method: string; recipient: PayoutRecipient },
      { payoutId: string; status: string }
    >(functions, 'requestPayout');
    const { data } = await call({ amount, method, recipient });
    return data;
  }

  async transferToUser(params: { toUid?: string; toPhone?: string; amount: number }) {
    const call = httpsCallable<typeof params, { transferId: string; fee: number }>(functions, 'transferToUser');
    const { data } = await call(params);
    return data;
  }

  async purchaseCoins(coinAmount: number) {
    const call = httpsCallable<{ coinAmount: number }, { coinAmount: number; cost: number }>(functions, 'purchaseCoins');
    const { data } = await call({ coinAmount });
    return data;
  }

  async sendGift(params: { shopId: string; coinAmount: number; productId?: string }) {
    const call = httpsCallable<typeof params, { giftId: string }>(functions, 'sendGift');
    const { data } = await call(params);
    return data;
  }

  async boostProduct(params: { productId: string; coinAmount: number; durationHours?: number }) {
    const call = httpsCallable<typeof params, { boostId: string }>(functions, 'boostProduct');
    const { data } = await call(params);
    return data;
  }

  async applyReferralCode(referrerCode: string) {
    const call = httpsCallable<{ referrerCode: string }, { ok: true }>(functions, 'applyReferralCode');
    const { data } = await call({ referrerCode });
    return data;
  }
}

export const walletService = new WalletService();
export default WalletService;
