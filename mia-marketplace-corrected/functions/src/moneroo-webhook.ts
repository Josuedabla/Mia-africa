/**
 * Moneroo webhook endpoint. Register this URL in the Moneroo dashboard:
 * https://<region>-<project>.cloudfunctions.net/monerooWebhook
 *
 * Handles:
 *  - payment.success on a wallet recharge -> credits the wallet
 *  - payment.success on a direct order payment -> settles the order
 *    (vendor credit + referral cashback), via orders.ts, same as Chariow
 *  - payout.success / payout.failed on a cash-out -> marks the payout
 *    request done, or refunds the wallet on failure
 *
 * Every event is verified with HMAC-SHA256 against X-Moneroo-Signature
 * before touching any data - an unsigned/forged POST cannot credit a
 * wallet no matter what amount it claims.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { MONEROO_WEBHOOK_SECRET, verifyMonerooSignature } from './moneroo.js';
import { readWallet, writeWalletCredit } from './ledger.js';
import { readOrderSettlementData, writeOrderSettlement, type OrderSettlementInput } from './orders.js';

if (!getApps().length) initializeApp();

export const monerooWebhook = onRequest({ secrets: [MONEROO_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const signature = req.get('X-Moneroo-Signature');
  const rawBody = (req as any).rawBody?.toString('utf8') ?? JSON.stringify(req.body);
  if (!signature || !verifyMonerooSignature(rawBody, signature, MONEROO_WEBHOOK_SECRET.value())) {
    res.status(403).send('Invalid signature');
    return;
  }

  const { event, data } = req.body ?? {};
  const db = getFirestore();

  try {
    switch (event) {
      case 'payment.success': {
        const metadata = data?.metadata ?? {};
        if (metadata.mia_type === 'wallet_recharge' && metadata.mia_wallet_tx_id && metadata.mia_uid) {
          const txRef = db.collection('walletTransactions').doc(metadata.mia_wallet_tx_id);
          const txSnap = await txRef.get();
          if (txSnap.exists && txSnap.data()?.status === 'pending') {
            await db.runTransaction(async (tx) => {
              const balance = await readWallet(tx, metadata.mia_uid);
              const newBalance = writeWalletCredit(
                tx,
                metadata.mia_uid,
                balance,
                data.amount,
                'recharge',
                'Recharge du portefeuille MIA confirmée'
              );
              tx.set(txRef, { status: 'completed', balanceAfter: newBalance }, { merge: true });
            });
          }
        } else if (metadata.mia_type === 'order_payment' && metadata.mia_order_id) {
          const orderId = metadata.mia_order_id;
          const orderSnap = await db.collection('orders').doc(orderId).get();
          if (orderSnap.exists && orderSnap.data()?.status === 'pending') {
            const order = orderSnap.data()!;
            const settlement: OrderSettlementInput = {
              orderId,
              shopId: order.shopId,
              buyerUid: order.customerId,
              orderTotal: order.total,
              paymentMethod: 'moneroo',
            };
            await db.runTransaction(async (tx) => {
              const reads = await readOrderSettlementData(tx, settlement);
              writeOrderSettlement(tx, settlement, reads);
            });
          }
        }
        break;
      }

      case 'payout.success': {
        const metadata = data?.metadata ?? {};
        if (metadata.mia_payout_id) {
          await db.collection('payoutRequests').doc(metadata.mia_payout_id).set(
            { status: 'completed' },
            { merge: true }
          );
        }
        break;
      }

      case 'payout.failed': {
        const metadata = data?.metadata ?? {};
        if (metadata.mia_payout_id && metadata.mia_uid) {
          const payoutRef = db.collection('payoutRequests').doc(metadata.mia_payout_id);
          const payoutSnap = await payoutRef.get();
          if (payoutSnap.exists && payoutSnap.data()?.status === 'processing') {
            await db.runTransaction(async (tx) => {
              const balance = await readWallet(tx, metadata.mia_uid);
              writeWalletCredit(
                tx,
                metadata.mia_uid,
                balance,
                payoutSnap.data()!.amount,
                'payout_failed_refund',
                'Échec du retrait - remboursement',
                metadata.mia_payout_id
              );
              tx.set(payoutRef, { status: 'failed' }, { merge: true });
            });
          }
        }
        break;
      }

      default:
        break; // payment.initiated / payment.failed / payment.cancelled / payout.initiated: nothing to do yet
    }

    res.status(200).send('ok');
  } catch (error) {
    console.error('[monerooWebhook] error', error);
    res.status(500).send('Internal error');
  }
});
