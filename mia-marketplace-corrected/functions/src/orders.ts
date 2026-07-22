/**
 * Shared "an order just got paid" logic, called from three places:
 *  - functions/src/chariow.ts webhook (card/mobile money via Chariow)
 *  - functions/src/moneroo.ts webhook (card/mobile money via Moneroo)
 *  - functions/src/wallet.ts purchaseWithWallet (paid from MIA wallet balance)
 *
 * Split into a READ phase and a WRITE phase (see ledger.ts/referral.ts)
 * so callers can insert their own reads/writes around it while keeping
 * the whole thing inside one Firestore transaction correctly ordered.
 */
import { getFirestore, FieldValue, type Transaction } from 'firebase-admin/firestore';
import { readWallet, writeWalletCredit } from './ledger.js';
import { readReferralChain, readReferralWalletBalances, writeReferralCashback } from './referral.js';
import { PLATFORM_COMMISSION_RATE } from './economics.js';

export interface OrderSettlementInput {
  orderId: string;
  shopId: string;
  buyerUid: string;
  orderTotal: number;
  paymentMethod: 'chariow' | 'moneroo' | 'wallet' | 'cash_on_delivery';
}

interface SettlementReadResult {
  vendorId: string;
  vendorBalance: number;
  referralChain: Awaited<ReturnType<typeof readReferralChain>>;
  referralBalances: Awaited<ReturnType<typeof readReferralWalletBalances>>;
}

export async function readOrderSettlementData(tx: Transaction, input: OrderSettlementInput): Promise<SettlementReadResult> {
  const db = getFirestore();
  const shopSnap = await tx.get(db.collection('shops').doc(input.shopId));
  if (!shopSnap.exists) throw new Error(`Shop ${input.shopId} not found while settling order ${input.orderId}`);
  const vendorId = shopSnap.data()!.vendorId as string;

  const vendorBalance = await readWallet(tx, vendorId);
  const referralChain = await readReferralChain(tx, input.buyerUid);
  const referralBalances = await readReferralWalletBalances(tx, referralChain);
  return { vendorId, vendorBalance, referralChain, referralBalances };
}

export function writeOrderSettlement(tx: Transaction, input: OrderSettlementInput, reads: SettlementReadResult) {
  const db = getFirestore();
  const commission = Math.round(input.orderTotal * PLATFORM_COMMISSION_RATE);
  const vendorShare = input.orderTotal - commission;

  // Cash-on-delivery never touches the wallet ledger - the vendor is
  // paid in person by the delivery driver, MIA just records the order
  // as settled and (for now) trusts the driver's confirmation. A real
  // reconciliation step (driver remits collected cash to MIA/Moneroo)
  // belongs in the future driver network, not simulated here.
  if (input.paymentMethod !== 'cash_on_delivery') {
    writeWalletCredit(
      tx,
      reads.vendorId,
      reads.vendorBalance,
      vendorShare,
      'vendor_payout_received',
      `Vente commande ${input.orderId.slice(0, 8)} (commission MIA ${Math.round(PLATFORM_COMMISSION_RATE * 100)}%)`,
      input.orderId
    );

    writeReferralCashback(tx, reads.referralChain, reads.referralBalances, input.orderId, input.orderTotal);
  }

  tx.set(
    db.collection('orders').doc(input.orderId),
    {
      status: 'paid',
      paymentMethod: input.paymentMethod,
      commissionAmount: commission,
      vendorShare,
      paidAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
