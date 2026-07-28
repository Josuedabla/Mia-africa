// POST /functions/v1/coins-purchase
// Body: { coinAmount: number, returnUrl: string }
//
// Système de tranches à prix fixe (8 tranches, chacune liée à un produit
// Chariow distinct - voir migration coin_purchase_tiers). Remplace
// l'ancien système de "prix libre calculé" (coinAmount * taux). Les
// pièces ne sont créditées que par le webhook Chariow une fois le
// paiement confirmé et re-vérifié - jamais ici directement.
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { buildChariowCheckoutUrl } from '../_shared/chariow.ts';

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

    const { coinAmount, returnUrl } = await req.json();
    if (!coinAmount || coinAmount <= 0 || !Number.isInteger(coinAmount)) {
      return json({ error: 'coinAmount (positive integer) is required' }, 400);
    }
    if (!returnUrl) return json({ error: 'returnUrl is required' }, 400);

    const { data: tier, error: tierError } = await admin
      .from('coin_purchase_tiers')
      .select('id, coin_amount, price_fcfa, chariow_product_id, chariow_checkout_url')
      .eq('coin_amount', coinAmount)
      .eq('is_active', true)
      .maybeSingle();

    if (tierError) {
      console.error('[coins-purchase] tier lookup error', tierError);
      return json({ error: 'Impossible de vérifier la tranche.' }, 500);
    }
    if (!tier) {
      return json({ error: 'INVALID_TIER' }, 400);
    }

    const { data: intent, error: intentError } = await admin
      .from('coin_purchase_intents')
      .insert({
        user_id: uid,
        coin_amount: tier.coin_amount,
        cost_fcfa: tier.price_fcfa,
        tier_id: tier.id,
        status: 'pending',
      })
      .select('id')
      .single();
    if (intentError || !intent) {
      console.error('[coins-purchase] intent insert error', intentError);
      return json({ error: "Impossible de préparer l'achat." }, 500);
    }

    const checkoutUrl = buildChariowCheckoutUrl({
      checkoutBaseUrl: tier.chariow_checkout_url,
      intentId: intent.id,
      returnUrl,
    });

    return json({ checkoutUrl, paymentId: intent.id, cost: tier.price_fcfa });
  } catch (error) {
    console.error('[coins-purchase] error', error);
    return json({ error: (error as Error).message ?? 'Internal error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
