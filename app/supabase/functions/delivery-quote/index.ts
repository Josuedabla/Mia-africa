// POST /functions/v1/delivery-quote
// Body: { orderId: string }
//
// Calcule et enregistre orders.delivery_fee pour UNE commande (= une
// boutique) à partir de delivery_pricing (base_fee + per_km_fee * distance)
// et de la distance réelle boutique <-> adresse de livraison (PostGIS).
// "Si plusieurs produits chez le même vendeur, prix de livraison identique"
// est déjà garanti par construction : le frais est calculé UNE FOIS par
// commande (donc par boutique), jamais par article - voir order_items qui
// n'a pas de colonne delivery_fee.
//
// Appelé automatiquement juste après checkout_cart() côté client (une
// fois par commande retournée), avant d'afficher le récapitulatif de prix
// au client.
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { orderId } = await req.json();
    if (!orderId) return json({ error: 'orderId is required' }, 400);

    const admin = getSupabaseAdmin();

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, shop_id, delivery_location, shops(location, country_code)')
      .eq('id', orderId)
      .single();
    if (orderError || !order) return json({ error: 'ORDER_NOT_FOUND' }, 404);

    const shop = (order as any).shops;
    const countryCode = shop?.country_code;

    const { data: pricing } = await admin
      .from('delivery_pricing')
      .select('base_fee, per_km_fee, free_above_amount')
      .eq('country_code', countryCode)
      .maybeSingle();

    // Pas de tarif configuré pour ce pays -> livraison gratuite par
    // défaut plutôt que de bloquer la commande (mieux vaut sous-facturer
    // au lancement dans un nouveau pays que casser le checkout).
    if (!pricing) {
      await admin.from('orders').update({ delivery_fee: 0 }).eq('id', orderId);
      return json({ deliveryFee: 0, note: 'No pricing configured for this country, defaulted to free.' });
    }

    // Distance réelle via PostGIS si les deux points sont connus, sinon
    // seulement le tarif de base (adresse texte sans géoloc précise).
    let distanceKm = 0;
    if (order.delivery_location && shop.location) {
      const { data: distanceResult } = await admin.rpc('st_distance_geography_km', {
        p_point_a: shop.location,
        p_point_b: order.delivery_location,
      });
      distanceKm = distanceResult ?? 0;
    }

    let fee = pricing.base_fee + pricing.per_km_fee * distanceKm;

    const { data: orderTotal } = await admin.from('orders').select('total').eq('id', orderId).single();
    if (pricing.free_above_amount && orderTotal && orderTotal.total >= pricing.free_above_amount) {
      fee = 0;
    }

    await admin.from('orders').update({ delivery_fee: Math.round(fee) }).eq('id', orderId);

    return json({ deliveryFee: Math.round(fee), distanceKm });
  } catch (error) {
    console.error('[delivery-quote] error', error);
    return json({ error: (error as Error).message ?? 'Internal error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
