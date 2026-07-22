/**
 * Wallet-to-wallet transfer between two MIA users - purely internal
 * ledger movement, no Moneroo call. Cash-out to mobile money/bank is a
 * separate step (wallet.ts::requestPayout) the recipient can do
 * afterwards. MIA takes a small fee on every transfer.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { readWallet, writeWalletDebit, writeWalletCredit } from './ledger.js';
import { TRANSFER_FEE_RATE, TRANSFER_FEE_MIN_FCFA } from './economics.js';

if (!getApps().length) initializeApp();

export const transferToUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const fromUid = request.auth.uid;
  const { toUid, toPhone, amount } = (request.data ?? {}) as { toUid?: string; toPhone?: string; amount?: number };
  if (!amount || amount <= 0) throw new HttpsError('invalid-argument', 'amount (positive number) is required.');
  if (!toUid && !toPhone) throw new HttpsError('invalid-argument', 'toUid or toPhone is required.');

  const db = getFirestore();

  // Resolve recipient by phone if uid wasn't given directly.
  let recipientUid = toUid ?? null;
  if (!recipientUid && toPhone) {
    const snap = await db.collection('users').where('phone', '==', toPhone).limit(1).get();
    if (snap.empty) throw new HttpsError('not-found', 'Aucun utilisateur MIA avec ce numéro.');
    recipientUid = snap.docs[0].id;
  }
  if (!recipientUid) throw new HttpsError('not-found', 'Destinataire introuvable.');
  if (recipientUid === fromUid) throw new HttpsError('invalid-argument', 'Impossible de se transférer à soi-même.');

  const recipientSnap = await db.collection('users').doc(recipientUid).get();
  if (!recipientSnap.exists) throw new HttpsError('not-found', 'Destinataire introuvable.');

  const fee = Math.max(Math.round(amount * TRANSFER_FEE_RATE), TRANSFER_FEE_MIN_FCFA);
  const totalDebit = amount + fee;

  const transferRef = db.collection('transfers').doc();

  await db.runTransaction(async (tx) => {
    // ---- READ PHASE ----
    const senderBalance = await readWallet(tx, fromUid);
    const recipientBalance = await readWallet(tx, recipientUid!);

    // ---- WRITE PHASE ----
    writeWalletDebit(tx, fromUid, senderBalance, totalDebit, 'transfer_out', `Transfert à ${recipientUid}`, transferRef.id);
    writeWalletCredit(tx, recipientUid!, recipientBalance, amount, 'transfer_in', `Transfert reçu de ${fromUid}`, transferRef.id);
    tx.set(transferRef, {
      fromUid,
      toUid: recipientUid,
      amount,
      fee,
      status: 'completed',
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { transferId: transferRef.id, fee };
});
