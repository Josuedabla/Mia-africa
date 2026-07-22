/**
 * Chariow payment proxy.
 *
 * chariow.service.ts on the client used to send the CHARIOW_API_KEY
 * (a payment platform *secret* key, "sk_...") as a Bearer token straight
 * from the browser. Anyone reading the JS bundle could then read every
 * sale/customer record or call the Chariow API as the store owner. All
 * calls that need the secret key now happen here; the client only ever
 * redirects the user to the public, prebuilt Chariow checkout URL
 * (VITE_CHARIOW_CHECKOUT_URL), which requires no secret.
 */
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { readOrderSettlementData, writeOrderSettlement, type OrderSettlementInput } from './orders.js';

if (!getApps().length) initializeApp();

// Same key value as VITE_CHARIOW_API_KEY previously in the client .env.
// Set it with: firebase functions:secrets:set CHARIOW_API_KEY
export const CHARIOW_API_KEY = defineSecret('CHARIOW_API_KEY');
const CHARIOW_API_URL = process.env.CHARIOW_API_URL ?? 'https://api.chariow.com/v1';

function chariowHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
}

/**
 * Callable used by admins/vendors to look up a sale by id (e.g. to confirm
 * payment status before marking an order as paid).
 */
export const getChariowSale = onCall({ secrets: [CHARIOW_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const { saleId } = request.data ?? {};
  if (!saleId || typeof saleId !== 'string') {
    throw new HttpsError('invalid-argument', 'saleId (string) is required.');
  }

  const response = await fetch(`${CHARIOW_API_URL}/sales/${saleId}`, {
    method: 'GET',
    headers: chariowHeaders(CHARIOW_API_KEY.value()),
  });
  if (!response.ok) {
    throw new HttpsError('internal', `Chariow API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
});

/**
 * HTTPS webhook endpoint to register in the Chariow dashboard.
 * Verifies the sale server-side (never trusting client-submitted totals,
 * closing the gap flagged in the audit for orders.total) and writes/updates
 * the matching Firestore order as paid.
 *
 * Configure this URL in Chariow: https://<region>-<project>.cloudfunctions.net/chariowWebhook
 */
export const chariowWebhook = onRequest({ secrets: [CHARIOW_API_KEY] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const saleId = req.body?.id ?? req.body?.data?.id;
  if (!saleId) {
    res.status(400).send('Missing sale id in webhook payload');
    return;
  }

  try {
    // Re-fetch the sale from Chariow directly instead of trusting the
    // webhook body, to guard against a spoofed webhook call.
    const verifyResponse = await fetch(`${CHARIOW_API_URL}/sales/${saleId}`, {
      method: 'GET',
      headers: chariowHeaders(CHARIOW_API_KEY.value()),
    });
    if (!verifyResponse.ok) {
      res.status(502).send('Could not verify sale with Chariow');
      return;
    }
    const sale = await verifyResponse.json();
    const isPaid = sale?.status === 'completed' && sale?.payment?.status === 'success';
    const orderId = sale?.custom_metadata?.mia_order_id ?? sale?.metadata?.mia_order_id;

    if (isPaid && orderId) {
      const db = getFirestore();
      const orderSnap = await db.collection('orders').doc(orderId).get();
      if (!orderSnap.exists) {
        res.status(200).send('order not found, ignoring'); // ack anyway - Chariow shouldn't retry forever
        return;
      }
      const order = orderSnap.data()!;
      const settlement: OrderSettlementInput = {
        orderId,
        shopId: order.shopId,
        buyerUid: order.customerId,
        orderTotal: order.total,
        paymentMethod: 'chariow',
      };
      await db.runTransaction(async (tx) => {
        const reads = await readOrderSettlementData(tx, settlement);
        writeOrderSettlement(tx, settlement, reads);
        tx.set(db.collection('orders').doc(orderId), { chariowSaleId: sale.id }, { merge: true });
      });
    }

    res.status(200).send('ok');
  } catch (error) {
    console.error('[chariowWebhook] error', error);
    res.status(500).send('Internal error');
  }
});
