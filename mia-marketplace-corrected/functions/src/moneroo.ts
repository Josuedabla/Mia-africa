/**
 * Low-level Moneroo API client - server-side only.
 *
 * IMPORTANT: the exact field names for /payments/initialize and
 * /payouts/initialize below follow Moneroo's standard PSP conventions,
 * but the documentation pasted into this project only covered Welcome /
 * Authentication / Response format / Errors / Test / Webhooks - not the
 * payment/payout creation endpoints themselves. Verify field names
 * against https://docs.moneroo.io before going live; if a field differs,
 * this is the one file to patch.
 *
 * The sandbox key shared in chat should be treated as already exposed -
 * rotate it from the Moneroo dashboard before this goes anywhere near
 * production, the same way we did for Chariow/Gemini/Algolia.
 */
import { defineSecret } from 'firebase-functions/params';
import * as crypto from 'crypto';

export const MONEROO_SECRET_KEY = defineSecret('MONEROO_SECRET_KEY');
export const MONEROO_WEBHOOK_SECRET = defineSecret('MONEROO_WEBHOOK_SECRET');

const MONEROO_API_URL = process.env.MONEROO_API_URL ?? 'https://api.moneroo.io/v1';

function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export interface MonerooCustomer {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface InitializePaymentParams {
  amount: number; // smallest currency unit is safer, but Moneroo generally takes major units - verify
  currency: string; // e.g. 'XOF', 'GHS', 'NGN'
  description: string;
  customer: MonerooCustomer;
  return_url: string;
  metadata?: Record<string, unknown>;
}

export async function initializeMonerooPayment(apiKey: string, params: InitializePaymentParams) {
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
  const res = await fetch(`${MONEROO_API_URL}/payments/${paymentId}`, {
    method: 'GET',
    headers: headers(apiKey),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? `Moneroo payment fetch failed (${res.status})`);
  return json.data;
}

export interface InitializePayoutParams {
  amount: number;
  currency: string;
  description: string;
  method: string; // e.g. 'mtn_momo', 'orange_money', 'bank_transfer' - see Moneroo payout methods docs
  recipient: {
    phone?: string;
    account_number?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  metadata?: Record<string, unknown>;
}

export async function initializeMonerooPayout(apiKey: string, params: InitializePayoutParams) {
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

/**
 * Verifies the X-Moneroo-Signature header (HMAC-SHA256 of the raw body
 * using the webhook signing secret), per the Webhooks section of the docs.
 */
export function verifyMonerooSignature(rawBody: string, signatureHeader: string, webhookSecret: string): boolean {
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // length mismatch etc.
  }
}
