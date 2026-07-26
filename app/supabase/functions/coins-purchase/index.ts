// POST /functions/v1/coins-purchase
// Body: { coinAmount: number, currency?: string, returnUrl: string }
//
// Remplace wallet-recharge (obsolète, migration 20260720000019 - plus de
// wallet en argent réel). C'est désormais le SEUL flux financier réel
// que MIA gère : l'achat de pièces MIA contre de l'argent réel entrant
// (12 FCFA/pièce, voir platform_settings.coin_purchase_rate_fcfa). Les
// pièces ne sont créditées que par le webhook Moneroo une fois le
// paiement confirmé et signé - jamais ici directement.
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { initializeMonerooPayment } from '../_shared/moneroo.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'UNAUTHENTICATED' }, 401);

    const admin = getSupabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !userData.user) return json({ error: 'UNAUTHENTICATED' }, 401);
    const uid = userData.user.id;

    const { coinAmount, currency, returnUrl } = await req.json();
    if (!coinAmount || coinAmount <= 0 || !Number.isInteger(coinAmount)) {
      return json({ error: 'coinAmount (positive integer) is required' }, 400);
    }
    if (!returnUrl) return json({ error: 'returnUrl is required' }, 400);

    const { data: rateRow } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', 'coin_purchase_rate_fcfa')
      .single();
    const rate = rateRow?.value ?? 12; // repli défensif si la ligne de config manquait
    const cost = coinAmount * rate;

    const { data: profile } = await admin.from('profiles').select('email').eq('id', uid).single();
    const email = profile?.email ?? userData.user.email ?? `${uid}@mia.local`;

    const monerooKey = Deno.env.get('MONEROO_SECRET_KEY')!;
    const payment = await initializeMonerooPayment(monerooKey, {
      amount: cost,
      currency: currency ?? 'XOF',
      description: `Achat de ${coinAmount} pièces MIA`,
      customer: { email },
      return_url: returnUrl,
      metadata: { mia_uid: uid, mia_type: 'coin_purchase', mia_coin_amount: coinAmount },
    });

    return json({ checkoutUrl: payment.checkout_url, paymentId: payment.id, cost });
  } catch (error) {
    console.error('[coins-purchase] error', error);
    return json({ error: (error as Error).message ?? 'Internal error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
