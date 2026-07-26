// Deno port of the previous functions/src/moneroo.ts (Firebase Cloud
// Functions version). Same field-name caveat as before: the Moneroo docs
// pasted into this project cover auth/errors/webhooks but not the exact
// /payments/initialize and /payouts/initialize field names - verify
// against https://docs.moneroo.io before the first real payment.
const MONEROO_API_URL = Deno.env.get('MONEROO_API_URL') ?? 'https://api.moneroo.io/v1';

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

export interface MonerooCustomer {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export async function initializeMonerooPayment(apiKey: string, params: {
  amount: number;
  currency: string;
  description: string;
  customer: MonerooCustomer;
  return_url: string;
  metadata?: Record<string, unknown>;
}) {
  const res = await fetch(`${MONEROO_API_URL}/payments/initialize`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message ?? `Moneroo payment init failed (${res.status})`);
  }
  return json.data as { id: string; checkout_url: string };
}

export async function getMonerooPayment(apiKey: string, paymentId: string) {
  const res = await fetch(`${MONEROO_API_URL}/payments/${paymentId}`, { headers: headers(apiKey) });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? `Moneroo payment fetch failed (${res.status})`);
  return json.data;
}

export async function initializeMonerooPayout(apiKey: string, params: {
  amount: number;
  currency: string;
  description: string;
  method: string;
  recipient: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const res = await fetch(`${MONEROO_API_URL}/payouts/initialize`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message ?? `Moneroo payout init failed (${res.status})`);
  }
  return json.data as { id: string; status: string };
}

/** Verifies X-Moneroo-Signature (HMAC-SHA256 of the raw body) using Web Crypto (Deno has no Node `crypto` module by default). */
export async function verifyMonerooSignature(rawBody: string, signatureHeader: string, webhookSecret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expectedHex = Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (expectedHex.length !== signatureHeader.length) return false;
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) diff |= expectedHex.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  return diff === 0;
}
