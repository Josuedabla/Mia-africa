const CHARIOW_API_URL = Deno.env.get('CHARIOW_API_URL') ?? 'https://api.chariow.com/v1';

export function buildChariowCheckoutUrl(params: {
  checkoutBaseUrl: string;
  intentId: string;
  returnUrl: string;
}): string {
  const url = new URL(params.checkoutBaseUrl);
  url.searchParams.set('mia_order_id', params.intentId);
  url.searchParams.set('redirect_url', params.returnUrl);
  return url.toString();
}

export async function getChariowSale(apiKey: string, saleId: string) {
  const res = await fetch(`${CHARIOW_API_URL}/sales/${saleId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Chariow sale fetch failed (${res.status})`);
  const json = await res.json();
  return json.data;
}

export function isChariowSalePaid(sale: any): boolean {
  return sale?.status === 'completed' && sale?.payment?.status === 'success';
}

export function chariowSaleOrderId(sale: any): string | undefined {
  return sale?.custom_metadata?.mia_order_id ?? sale?.metadata?.mia_order_id;
}

export function chariowSaleProductId(sale: any): string | undefined {
  return sale?.product?.id ?? sale?.product_id;
}

export function isSuccessfulSalePulse(payload: any): boolean {
  return payload?.event === 'successful.sale';
}

export function pulseSaleId(payload: any): string | undefined {
  return payload?.sale?.id;
}
