/**
 * Chariow Service (client-side)
 *
 * This used to wrap the full Chariow REST API with the secret API key
 * (sk_...) sent as a Bearer token directly from the browser - anyone
 * reading the JS bundle could then read every sale/customer record. The
 * secret key now lives only in Cloud Functions (functions/src/chariow.ts).
 *
 * The client only needs two things, neither of which requires the secret:
 *  1. The public checkout URL, to redirect the buyer to Chariow's hosted
 *     checkout page.
 *  2. getSale(), which calls the getChariowSale Cloud Function (requires
 *     the user to be authenticated) instead of the Chariow API directly.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface ChariowSale {
  id: string;
  status: 'awaiting_payment' | 'completed' | 'failed' | 'refunded';
  payment: {
    status: 'awaiting_payment' | 'success' | 'failed';
    amount: { value: number; formatted: string; currency: string };
  };
  product: { id: string; name: string };
  customer: { id: string; email: string; first_name: string; last_name: string };
  amount: { value: number; formatted: string; currency: string };
  created_at: string;
}

class ChariowService {
  private checkoutUrl: string;
  private minAmount: number;

  constructor(config: { checkoutUrl: string; minAmount: number }) {
    this.checkoutUrl = config.checkoutUrl;
    this.minAmount = config.minAmount;
  }

  /**
   * Build the redirect URL to Chariow's hosted checkout for a given order.
   * No secret key needed - this is a public, prebuilt checkout link.
   */
  buildCheckoutRedirectUrl(params: {
    orderId: string;
    amount: number;
    redirectUrl: string;
  }): string {
    if (params.amount < this.minAmount) {
      throw new Error(`Order amount must be at least ${this.minAmount}.`);
    }
    const url = new URL(this.checkoutUrl);
    url.searchParams.set('mia_order_id', params.orderId);
    url.searchParams.set('redirect_url', params.redirectUrl);
    return url.toString();
  }

  /**
   * Look up a sale by id via the getChariowSale Cloud Function
   * (used by vendors/admins to confirm payment status).
   */
  async getSale(saleId: string): Promise<ChariowSale> {
    const call = httpsCallable<{ saleId: string }, ChariowSale>(functions, 'getChariowSale');
    const { data } = await call({ saleId });
    return data;
  }

  /**
   * Client-side helper only - the source of truth for "is this sale paid"
   * is always the chariowWebhook Cloud Function, which verifies directly
   * against the Chariow API before marking an order as paid.
   */
  isValidSale(sale: ChariowSale): boolean {
    return sale.status === 'completed' && sale.payment.status === 'success';
  }
}

export const chariowService = new ChariowService({
  checkoutUrl: import.meta.env.VITE_CHARIOW_CHECKOUT_URL,
  minAmount: Number(import.meta.env.VITE_CHARIOW_MIN_AMOUNT ?? 0),
});
export default ChariowService;
