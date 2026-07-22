/**
 * Vendor onboarding.
 *
 * Firestore rules deliberately prevent a client from writing its own
 * `role` field (see users.update rule - anti self-promotion), and shop
 * creation requires isVendor() to already be true, which is a chicken/egg
 * problem for someone who is not a vendor yet. This callable is the one
 * legitimate, server-controlled path that flips `role: 'vendor'` and
 * creates the matching `shops/{shopId}` document atomically, using the
 * Admin SDK (which bypasses security rules by design, but only inside
 * this reviewed function - never from client code directly).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';

if (!getApps().length) initializeApp();

interface BecomeVendorRequest {
  shopName: string;
  category: string;
  country: string;
  phone: string;
}

export const becomeVendor = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const uid = request.auth.uid;
  const { shopName, category, country, phone } = (request.data ?? {}) as Partial<BecomeVendorRequest>;

  if (!shopName || shopName.trim().length < 3) {
    throw new HttpsError('invalid-argument', 'shopName must be at least 3 characters.');
  }
  if (!category) throw new HttpsError('invalid-argument', 'category is required.');
  if (!country) throw new HttpsError('invalid-argument', 'country is required.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);
  const shopRef = db.collection('shops').doc();

  const userSnap = await userRef.get();
  if (userSnap.exists && userSnap.data()?.role === 'vendor') {
    throw new HttpsError('already-exists', 'This account is already a vendor.');
  }

  const slugBase = shopName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const slug = `${slugBase}-${shopRef.id.slice(0, 6)}`;

  await db.runTransaction(async (tx) => {
    tx.set(
      userRef,
      { role: 'vendor', updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    tx.set(shopRef, {
      vendorId: uid,
      name: shopName.trim(),
      slug,
      category,
      country,
      phone: phone ?? null,
      status: 'active',
      rating: 0,
      reviewCount: 0,
      productCount: 0,
      totalSales: 0,
      sellerScore: 50, // starting neutral score out of 100, evolves with orders/reviews later
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { shopId: shopRef.id, slug };
});
