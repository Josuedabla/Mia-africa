/**
 * Referral program - deliberately NOT the "pyramidal" design originally
 * described (infinite generations, earnings locked until redeemed for
 * merchandise, unlock gated behind paying a fee or recruiting a paying
 * member - that structure has the hallmarks of an illegal pyramid
 * scheme). This is a standard, legal 2-level affiliate model instead:
 *
 *  - Capped at 2 levels (your direct referrals, and their referrals).
 *  - Reward only ever triggered by a REAL completed purchase
 *    (see orders.ts -> settleOrderPayment), never by signing up or
 *    recruiting alone.
 *  - Cashback lands as real, immediately spendable/withdrawable wallet
 *    balance - never a locked "points" balance unlocked by paying more
 *    or recruiting more people.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, type Transaction } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { readWallet, writeWalletCredit } from './ledger.js';
import { REFERRAL_LEVEL_1_RATE, REFERRAL_LEVEL_2_RATE } from './economics.js';

if (!getApps().length) initializeApp();

/**
 * Called once, right after signup, if the user arrived via a referral
 * link (?ref=CODE). A referral "code" is simply the referrer's own uid
 * here - short display codes can be layered on top later without
 * changing this data model.
 */
export const applyReferralCode = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const uid = request.auth.uid;
  const { referrerCode } = (request.data ?? {}) as { referrerCode?: string };

  if (!referrerCode || typeof referrerCode !== 'string') {
    throw new HttpsError('invalid-argument', 'referrerCode is required.');
  }
  if (referrerCode === uid) {
    throw new HttpsError('invalid-argument', 'Vous ne pouvez pas être votre propre parrain.');
  }

  const db = getFirestore();
  const referrerUserSnap = await db.collection('users').doc(referrerCode).get();
  if (!referrerUserSnap.exists) {
    throw new HttpsError('not-found', 'Code de parrainage invalide.');
  }

  const referralRef = db.collection('referrals').doc(uid);
  const existing = await referralRef.get();
  if (existing.exists) {
    throw new HttpsError('already-exists', 'Un code de parrainage a déjà été appliqué à ce compte.');
  }

  await referralRef.set({
    uid,
    referrerUid: referrerCode,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

interface ReferralChain {
  level1ReferrerUid: string | null;
  level2ReferrerUid: string | null;
}

/**
 * READ PHASE ONLY - fetches the buyer's referral chain. Call this before
 * any writes in the enclosing transaction (see orders.ts).
 */
export async function readReferralChain(tx: Transaction, buyerUid: string): Promise<ReferralChain> {
  const db = getFirestore();
  const level1Snap = await tx.get(db.collection('referrals').doc(buyerUid));
  if (!level1Snap.exists) return { level1ReferrerUid: null, level2ReferrerUid: null };

  const level1ReferrerUid = (level1Snap.data()?.referrerUid as string) ?? null;
  if (!level1ReferrerUid || level1ReferrerUid === buyerUid) {
    return { level1ReferrerUid: null, level2ReferrerUid: null };
  }

  const level2Snap = await tx.get(db.collection('referrals').doc(level1ReferrerUid));
  const rawLevel2 = level2Snap.exists ? (level2Snap.data()?.referrerUid as string) : null;
  const level2ReferrerUid = rawLevel2 && rawLevel2 !== buyerUid && rawLevel2 !== level1ReferrerUid ? rawLevel2 : null;

  return { level1ReferrerUid, level2ReferrerUid };
}

/**
 * READ PHASE ONLY - reads the current wallet balances of whichever
 * referrers exist in the chain, so the WRITE PHASE never has to read again.
 */
export async function readReferralWalletBalances(
  tx: Transaction,
  chain: ReferralChain
): Promise<{ level1Balance: number; level2Balance: number }> {
  const level1Balance = chain.level1ReferrerUid ? await readWallet(tx, chain.level1ReferrerUid) : 0;
  const level2Balance = chain.level2ReferrerUid ? await readWallet(tx, chain.level2ReferrerUid) : 0;
  return { level1Balance, level2Balance };
}

/**
 * WRITE PHASE ONLY - credits level-1/level-2 referrers their cashback.
 * Funded out of MIA's own commission, never out of the vendor's share
 * (see economics.ts, which asserts cashback rates <= commission rate).
 */
export function writeReferralCashback(
  tx: Transaction,
  chain: ReferralChain,
  balances: { level1Balance: number; level2Balance: number },
  orderId: string,
  orderTotal: number
) {
  if (chain.level1ReferrerUid) {
    const amount = Math.round(orderTotal * REFERRAL_LEVEL_1_RATE);
    if (amount > 0) {
      writeWalletCredit(
        tx,
        chain.level1ReferrerUid,
        balances.level1Balance,
        amount,
        'referral_cashback',
        `Cashback parrainage niveau 1 (commande ${orderId.slice(0, 8)})`,
        orderId
      );
    }
  }
  if (chain.level2ReferrerUid) {
    const amount2 = Math.round(orderTotal * REFERRAL_LEVEL_2_RATE);
    if (amount2 > 0) {
      writeWalletCredit(
        tx,
        chain.level2ReferrerUid,
        balances.level2Balance,
        amount2,
        'referral_cashback',
        `Cashback parrainage niveau 2 (commande ${orderId.slice(0, 8)})`,
        orderId
      );
    }
  }
}
