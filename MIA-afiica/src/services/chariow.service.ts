/**
 * Chariow Service (client-side) - unchanged in spirit from the Firebase
 * version: the secret API key never touches the client, only the public
 * checkout URL and a server-verified sale lookup (now via the
 * chariow-webhook Edge Function's underlying settle_order_payment RPC,
 * not a direct client call).
 */
const CHARIOW_CHECKOUT_URL = import.meta.env.VITE_CHARIOW_CHECKOUT_URL;
const CHARIOW_MIN_AMOUNT = Number(import.meta.env.VITE_CHARIOW_MIN_AMOUNT ?? 0);

class ChariowService {
  buildCheckoutRedirectUrl(params: { orderId: string; amount: number; redirectUrl: string }): string {
    if (params.amount < CHARIOW_MIN_AMOUNT) {
      throw new Error(`Order amount must be at least ${CHARIOW_MIN_AMOUNT}.`);
    }
    const url = new URL(CHARIOW_CHECKOUT_URL);
    url.searchParams.set('mia_order_id', params.orderId);
    url.searchParams.set('redirect_url', params.redirectUrl);
    return url.toString();
  }
}

export const chariowService = new ChariowService();
export default ChariowService;
