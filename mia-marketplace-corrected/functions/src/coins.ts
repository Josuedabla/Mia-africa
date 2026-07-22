/**
 * MIA Coins - virtual currency, separate ledger from the FCFA wallet.
 * Bought with real wallet balance, spent as gifts to vendors/creators or
 * to boost a product's ranking. Like TikTok Diamonds, the FCFA value
 * credited to a gift recipient is lower than what the coins cost to buy -
 * that spread (COIN_PURCHASE_RATE_FCFA vs COIN_GIFT_PAYOUT_RATE_FCFA in
 * economics.ts) is MIA's margin on the coins economy.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { readWallet, writeWalletDebit, writeWalletCredit, readCoins, writeCoinsCredit, writeCoinsDebit } from './ledger.js';
import { COIN_PURCHASE_RATE_FCFA, COIN_GIFT_PAYOUT_RATE_FCFA } from './economics.js';

if (!getApps().length) initializeApp();

/** Buys `coinAmount` coins using the caller's wallet balance. */
export const purchaseCoins = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const uid = request.auth.uid;
  const { coinAmount } = (request.data ?? {}) as { coinAmount?: number };
  if (!coinAmount || coinAmount <= 0 || !Number.isInteger(coinAmount)) {
    throw new HttpsError('invalid-argument', 'coinAmount must be a positive integer.');
  }

  const cost = coinAmount * COIN_PURCHASE_RATE_FCFA;
  const db = getFirestore();

  await db.runTransaction(async (tx) => {
    const walletBalance = await readWallet(tx, uid);
    const coinBalance = await readCoins(tx, uid);

    writeWalletDebit(tx, uid, walletBalance, cost, 'coin_purchase', `Achat de ${coinAmount} pièces MIA`);
    writeCoinsCredit(tx, uid, coinBalance, coinAmount, `Achat de ${coinAmount} pièces`);
  });

  return { coinAmount, cost };
});

/**
 * Sends coins as a gift to a shop (vendor/creator). The recipient's
 * wallet is credited at the lower payout rate - the difference is MIA's
 * margin, same mechanic as TikTok Diamonds -> cash conversion.
 */
export const sendGift = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const fromUid = request.auth.uid;
  const { shopId, coinAmount, productId } = (request.data ?? {}) as {
    shopId?: string;
    coinAmount?: number;
    productId?: string;
  };
  if (!shopId) throw new HttpsError('invalid-argument', 'shopId is required.');
  if (!coinAmount || coinAmount <= 0 || !Number.isInteger(coinAmount)) {
    throw new HttpsError('invalid-argument', 'coinAmount must be a positive integer.');
  }

  const db = getFirestore();
  const giftRef = db.collection('gifts').doc();

  await db.runTransaction(async (tx) => {
    // ---- READ PHASE ----
    const shopSnap = await tx.get(db.collection('shops').doc(shopId));
    if (!shopSnap.exists) throw new HttpsError('not-found', 'Boutique introuvable.');
    const vendorId = shopSnap.data()!.vendorId as string;

    const senderCoinBalance = await readCoins(tx, fromUid);
    const recipientWalletBalance = await readWallet(tx, vendorId);

    // ---- WRITE PHASE ----
    writeCoinsDebit(tx, fromUid, senderCoinBalance, coinAmount, `Cadeau envoyé à ${shopSnap.data()!.name}`, giftRef.id);
    const cashValue = coinAmount * COIN_GIFT_PAYOUT_RATE_FCFA;
    writeWalletCredit(tx, vendorId, recipientWalletBalance, cashValue, 'gift_received', `Cadeau reçu (${coinAmount} pièces)`, giftRef.id);

    tx.set(giftRef, {
      fromUid,
      shopId,
      vendorId,
      productId: productId ?? null,
      coinAmount,
      cashValue,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { giftId: giftRef.id };
});

/**
 * Spends coins to boost a product's visibility for a fixed duration.
 * Pure MIA revenue - the coins are simply removed from circulation, no
 * cash is credited to anyone. `boostScore` is meant to be read by the
 * ranking/search logic (Algolia sync, home page sorting, etc.) as one
 * input among others - never the sole ranking factor, so a well-funded
 * but low-quality listing can't just buy its way to the top forever
 * (pair with sellerScore/qualityScore when building the ranking formula).
 */
export const boostProduct = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const uid = request.auth.uid;
  const { productId, coinAmount, durationHours } = (request.data ?? {}) as {
    productId?: string;
    coinAmount?: number;
    durationHours?: number;
  };
  if (!productId) throw new HttpsError('invalid-argument', 'productId is required.');
  if (!coinAmount || coinAmount <= 0) throw new HttpsError('invalid-argument', 'coinAmount must be a positive integer.');
  const duration = durationHours && durationHours > 0 ? durationHours : 24;

  const db = getFirestore();
  const boostRef = db.collection('productBoosts').doc();

  await db.runTransaction(async (tx) => {
    const coinBalance = await readCoins(tx, uid);
    writeCoinsDebit(tx, uid, coinBalance, coinAmount, `Boost produit ${productId}`, boostRef.id);

    const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000);
    tx.set(boostRef, {
      productId,
      uid,
      coinAmount,
      boostScore: coinAmount, // simplest possible mapping - tune later
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection('products').doc(productId), { isBoosted: true }, { merge: true });
  });

  return { boostId: boostRef.id };
});
