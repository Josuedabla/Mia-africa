/**
 * Wallet Cloud Functions: recharge (deposit), pay an order from wallet
 * balance, and request a cash-out (payout) to mobile money/bank via
 * Moneroo. The Moneroo webhook that confirms recharges/payouts lives in
 * moneroo-webhook.ts (kept separate from this file for clarity).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { MONEROO_SECRET_KEY, initializeMonerooPayment, initializeMonerooPayout } from './moneroo.js';
import { readWallet, writeWalletDebit, writeWalletCredit } from './ledger.js';
import { readOrderSettlementData, writeOrderSettlement, type OrderSettlementInput } from './orders.js';
import { MIN_PAYOUT_FCFA } from './economics.js';

if (!getApps().length) initializeApp();

/**
 * Starts a wallet recharge: creates a pending walletTransactions record
 * and asks Moneroo for a checkout URL. The wallet balance itself is only
 * credited once the moneroWebhook receives payment.success - never here,
 * so a client can't fake a recharge by just calling this function.
 */
export const initiateWalletRecharge = onCall({ secrets: [MONEROO_SECRET_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const { amount, currency, returnUrl } = (request.data ?? {}) as {
    amount?: number;
    currency?: string;
    returnUrl?: string;
  };
  if (!amount || amount <= 0) throw new HttpsError('invalid-argument', 'amount (positive number) is required.');
  if (!returnUrl) throw new HttpsError('invalid-argument', 'returnUrl is required.');

  const db = getFirestore();
  const uid = request.auth.uid;
  const userRecord = await db.collection('users').doc(uid).get();
  const email = userRecord.data()?.email ?? request.auth.token.email ?? `${uid}@mia.local`;

  const pendingRef = db.collection('walletTransactions').doc();
  await pendingRef.set({
    uid,
    type: 'recharge',
    amount,
    balanceAfter: null, // filled in by the webhook once confirmed
    status: 'pending',
    description: 'Recharge du portefeuille MIA',
    createdAt: FieldValue.serverTimestamp(),
  });

  const payment = await initializeMonerooPayment(MONEROO_SECRET_KEY.value(), {
    amount,
    currency: currency ?? 'XOF',
    description: 'Recharge portefeuille MIA',
    customer: { email },
    return_url: returnUrl,
    metadata: { mia_wallet_tx_id: pendingRef.id, mia_uid: uid, mia_type: 'wallet_recharge' },
  });

  await pendingRef.set({ monerooPaymentId: payment.id }, { merge: true });
  return { checkoutUrl: payment.checkout_url };
});

/**
 * Pays an order directly out of the buyer's MIA wallet balance - no
 * external gateway call needed, so this settles synchronously (unlike
 * card/mobile money payments, which wait on a webhook).
 */
export const purchaseWithWallet = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const buyerUid = request.auth.uid;
  const { orderId } = (request.data ?? {}) as { orderId?: string };
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required.');

  const db = getFirestore();

  return db.runTransaction(async (tx) => {
    // ---- READ PHASE ----
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError('not-found', 'Commande introuvable.');
    const order = orderSnap.data()!;
    if (order.customerId !== buyerUid) {
      throw new HttpsError('permission-denied', "Cette commande n'appartient pas à cet utilisateur.");
    }
    if (order.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Cette commande a déjà été traitée.');
    }

    const buyerBalance = await readWallet(tx, buyerUid);
    const settlementInput: OrderSettlementInput = {
      orderId,
      shopId: order.shopId,
      buyerUid,
      orderTotal: order.total,
      paymentMethod: 'wallet',
    };
    const settlementReads = await readOrderSettlementData(tx, settlementInput);

    // ---- WRITE PHASE ----
    writeWalletDebit(tx, buyerUid, buyerBalance, order.total, 'purchase', `Achat commande ${orderId.slice(0, 8)}`, orderId);
    writeOrderSettlement(tx, settlementInput, settlementReads);

    return { ok: true };
  });
});

/**
 * Requests a cash-out from the wallet to mobile money/bank via Moneroo.
 * Debits the wallet immediately (inside a transaction, so two parallel
 * requests can't both succeed against the same balance) and marks the
 * payout "processing". moneroWebhook.ts flips it to completed on
 * payout.success, or this function refunds the wallet immediately below
 * if Moneroo rejects the request outright.
 */
export const requestPayout = onCall({ secrets: [MONEROO_SECRET_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const uid = request.auth.uid;
  const { amount, method, recipient } = (request.data ?? {}) as {
    amount?: number;
    method?: string;
    recipient?: { phone?: string; account_number?: string; first_name?: string; last_name?: string };
  };
  if (!amount || amount < MIN_PAYOUT_FCFA) {
    throw new HttpsError('invalid-argument', `Le montant minimum de retrait est ${MIN_PAYOUT_FCFA} FCFA.`);
  }
  if (!method) throw new HttpsError('invalid-argument', 'method is required (e.g. mtn_momo, orange_money, bank_transfer).');

  const db = getFirestore();
  const payoutRef = db.collection('payoutRequests').doc();

  await db.runTransaction(async (tx) => {
    const balance = await readWallet(tx, uid);
    writeWalletDebit(tx, uid, balance, amount, 'payout_requested', `Demande de retrait #${payoutRef.id.slice(0, 8)}`, payoutRef.id);
    tx.set(payoutRef, {
      uid,
      amount,
      method,
      recipient: recipient ?? null,
      status: 'processing',
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  try {
    const payout = await initializeMonerooPayout(MONEROO_SECRET_KEY.value(), {
      amount,
      currency: 'XOF',
      description: `Retrait MIA #${payoutRef.id.slice(0, 8)}`,
      method,
      recipient: recipient ?? {},
      metadata: { mia_payout_id: payoutRef.id, mia_uid: uid },
    });
    await payoutRef.set({ monerooPayoutId: payout.id }, { merge: true });
    return { payoutId: payoutRef.id, status: 'processing' };
  } catch (error) {
    // Moneroo rejected the payout outright (bad recipient, etc.) -
    // refund the wallet right away instead of waiting on a webhook that
    // will never come.
    await db.runTransaction(async (tx) => {
      const balance = await readWallet(tx, uid);
      writeWalletCredit(tx, uid, balance, amount, 'payout_failed_refund', 'Échec du retrait - remboursement', payoutRef.id);
      tx.set(payoutRef, { status: 'failed', error: String((error as Error).message) }, { merge: true });
    });
    throw new HttpsError('internal', 'Le retrait a échoué et le solde a été remboursé.');
  }
});
