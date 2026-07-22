/**
 * Every wallet/coin balance change in the app goes through the read/write
 * helpers below, always used inside a single Firestore transaction.
 *
 * Firestore transactions require ALL reads to happen before ANY writes.
 * To make that hard to get wrong, this file is split into:
 *   - read*(tx, uid)   -> read-only, returns current balance
 *   - write*Credit/Debit(tx, uid, currentBalance, ...) -> write-only,
 *     takes the balance you already read as a parameter instead of
 *     re-reading it.
 *
 * Callers must call every read*() they need FIRST, then every write*()
 * after. See orders.ts::settleOrderPayment for the canonical example
 * (reads buyer/seller/referrer balances, then writes all deltas).
 */
import { getFirestore, FieldValue, type Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export type WalletTxType =
  | 'recharge'
  | 'purchase'
  | 'vendor_payout_received'
  | 'payout_requested'
  | 'payout_failed_refund'
  | 'transfer_out'
  | 'transfer_in'
  | 'transfer_fee'
  | 'referral_cashback'
  | 'coin_purchase'
  | 'gift_received';

// ---------------------------------------------------------------------
// Wallet (real FCFA balance)
// ---------------------------------------------------------------------

export async function readWallet(tx: Transaction, uid: string): Promise<number> {
  const db = getFirestore();
  const snap = await tx.get(db.collection('wallets').doc(uid));
  return snap.exists ? (snap.data()?.balance ?? 0) : 0;
}

function writeLedgerEntry(
  tx: Transaction,
  uid: string,
  type: WalletTxType,
  amount: number,
  balanceAfter: number,
  description: string,
  relatedId?: string
) {
  const db = getFirestore();
  tx.set(db.collection('walletTransactions').doc(), {
    uid,
    type,
    amount,
    balanceAfter,
    description,
    relatedId: relatedId ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** Write-only: adds `amount` to uid's wallet. Pass in the balance you already read. */
export function writeWalletCredit(
  tx: Transaction,
  uid: string,
  currentBalance: number,
  amount: number,
  type: WalletTxType,
  description: string,
  relatedId?: string
): number {
  if (amount <= 0) throw new HttpsError('invalid-argument', 'Credit amount must be positive.');
  const db = getFirestore();
  const newBalance = currentBalance + amount;
  tx.set(
    db.collection('wallets').doc(uid),
    { balance: newBalance, currency: 'FCFA', updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  writeLedgerEntry(tx, uid, type, amount, newBalance, description, relatedId);
  return newBalance;
}

/** Write-only: removes `amount` from uid's wallet. Throws if currentBalance is insufficient. */
export function writeWalletDebit(
  tx: Transaction,
  uid: string,
  currentBalance: number,
  amount: number,
  type: WalletTxType,
  description: string,
  relatedId?: string
): number {
  if (amount <= 0) throw new HttpsError('invalid-argument', 'Debit amount must be positive.');
  if (currentBalance < amount) throw new HttpsError('failed-precondition', 'Solde insuffisant.');
  const db = getFirestore();
  const newBalance = currentBalance - amount;
  tx.set(
    db.collection('wallets').doc(uid),
    { balance: newBalance, currency: 'FCFA', updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  writeLedgerEntry(tx, uid, type, amount, newBalance, description, relatedId);
  return newBalance;
}

// ---------------------------------------------------------------------
// Coins (virtual currency, separate from the FCFA wallet)
// ---------------------------------------------------------------------

export async function readCoins(tx: Transaction, uid: string): Promise<number> {
  const db = getFirestore();
  const snap = await tx.get(db.collection('coinBalances').doc(uid));
  return snap.exists ? (snap.data()?.coins ?? 0) : 0;
}

function writeCoinLedgerEntry(
  tx: Transaction,
  uid: string,
  type: 'credit' | 'debit',
  amount: number,
  balanceAfter: number,
  description: string,
  relatedId?: string
) {
  const db = getFirestore();
  tx.set(db.collection('coinTransactions').doc(), {
    uid,
    type,
    amount,
    balanceAfter,
    description,
    relatedId: relatedId ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export function writeCoinsCredit(
  tx: Transaction,
  uid: string,
  currentBalance: number,
  amount: number,
  description: string,
  relatedId?: string
): number {
  if (amount <= 0) throw new HttpsError('invalid-argument', 'Coin credit must be positive.');
  const db = getFirestore();
  const newBalance = currentBalance + amount;
  tx.set(db.collection('coinBalances').doc(uid), { coins: newBalance, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  writeCoinLedgerEntry(tx, uid, 'credit', amount, newBalance, description, relatedId);
  return newBalance;
}

export function writeCoinsDebit(
  tx: Transaction,
  uid: string,
  currentBalance: number,
  amount: number,
  description: string,
  relatedId?: string
): number {
  if (amount <= 0) throw new HttpsError('invalid-argument', 'Coin debit must be positive.');
  if (currentBalance < amount) throw new HttpsError('failed-precondition', 'Pas assez de pièces.');
  const db = getFirestore();
  const newBalance = currentBalance - amount;
  tx.set(db.collection('coinBalances').doc(uid), { coins: newBalance, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  writeCoinLedgerEntry(tx, uid, 'debit', amount, newBalance, description, relatedId);
  return newBalance;
}
