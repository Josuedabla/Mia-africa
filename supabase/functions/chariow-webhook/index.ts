// POST /functions/v1/chariow-webhook
// Reçoit les "pulses" Chariow (event: 'successful.sale'), re-vérifie
// systématiquement la vente directement auprès de l'API Chariow (ne
// fait jamais confiance au seul corps du webhook), s'assure que le
// produit payé correspond bien au produit attendu pour la tranche liée
// à l'intention d'achat, puis crédite les pièces via credit_coins.
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  getChariowSale,
  isChariowSalePaid,
  chariowSaleOrderId,
  chariowSaleProductId,
  isSuccessfulSalePulse,
  pulseSaleId,
} from '../_shared/chariow.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const payload = await req.json();

    if (!isSuccessfulSalePulse(payload)) {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const saleId = pulseSaleId(payload);
    if (!saleId) return new Response('Missing sale.id in pulse payload', { status: 400 });

    const intentId = chariowSaleOrderId(payload?.sale);
    if (!intentId) return new Response('Missing mia_order_id in pulse custom_metadata', { status: 400 });

    const admin = getSupabaseAdmin();

    const { data: intent, error: intentError } = await admin
      .from('coin_purchase_intents')
      .select('id, user_id, coin_amount, cost_fcfa, status, tier_id, coin_purchase_tiers(chariow_product_id)')
      .eq('id', intentId)
      .maybeSingle();
    if (intentError || !intent) return new Response('Unknown purchase intent', { status: 404 });

    const expectedProductId = (intent as any).coin_purchase_tiers?.chariow_product_id;
    if (!expectedProductId) {
      console.error('[chariow-webhook] intent has no linked tier/product_id', { intentId });
      return new Response('Intent missing tier', { status: 409 });
    }

    const chariowKey = Deno.env.get('CHARIOW_API_KEY')!;
    const sale = await getChariowSale(chariowKey, saleId);

    if (!isChariowSalePaid(sale)) {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const paidProductId = chariowSaleProductId(sale);
    if (!paidProductId || paidProductId !== expectedProductId) {
      console.error('[chariow-webhook] product mismatch', {
        saleId,
        intentId,
        paidProductId,
        expectedProductId,
      });
      return new Response('Product mismatch', { status: 409 });
    }

    const { data: existingTx } = await admin
      .from('coin_transactions')
      .select('id')
      .eq('related_id', String(saleId))
      .maybeSingle();

    if (intent.status !== 'completed' && !existingTx) {
      await admin.rpc('credit_coins', {
        p_user_id: intent.user_id,
        p_amount: intent.coin_amount,
        p_description: `Achat de ${intent.coin_amount} pièces MIA confirmé`,
        p_related_id: String(saleId),
      });
      await admin
        .from('coin_purchase_intents')
        .update({ status: 'completed', chariow_sale_id: String(saleId), completed_at: new Date().toISOString() })
        .eq('id', intentId);
    }

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('[chariow-webhook] error', error);
    return new Response('Internal error', { status: 500 });
  }
});
