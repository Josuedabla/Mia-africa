// GET/POST /functions/v1/whatsapp-order?productId=...&quantity=2
//
// "Le message WhatsApp doit être accompagné du lien du produit pour que
// le vendeur ne perde pas de temps à chercher les données de l'article.
// Certains vendeurs n'auront pas l'habitude de vérifier le tableau des
// commandes, le lien devient la référence."
//
// Résout le numéro de réception effectif dans cet ordre de priorité :
//   1. products.whatsapp_order_number (override par produit - permet la
//      collaboration: produit du vendeur A, numéro du vendeur B)
//   2. shops.whatsapp_number (numéro par défaut de la boutique)
// Retourne null si whatsapp_orders_enabled est false à l'un des deux
// niveaux - dans ce cas le bouton "Commander sur WhatsApp" ne doit
// simplement pas rediriger vers WhatsApp (voir commentaire côté client
// dans whatsapp.service.ts), pour respecter le choix de vie privée du
// vendeur plutôt que d'imposer un canal.
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://mia.com';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const productId = url.searchParams.get('productId');
  const quantity = Number(url.searchParams.get('quantity') ?? '1');
  if (!productId) return json({ error: 'productId is required' }, 400);

  const admin = getSupabaseAdmin();
  const { data: product, error } = await admin
    .from('products')
    .select('id, name, slug, price, currency, whatsapp_order_number, whatsapp_orders_enabled, shop_id, shops(name, slug, whatsapp_number, whatsapp_orders_enabled)')
    .eq('id', productId)
    .single();

  if (error || !product) return json({ error: 'PRODUCT_NOT_FOUND' }, 404);

  const shop = (product as any).shops;
  const shopOrdersEnabled = shop?.whatsapp_orders_enabled ?? true;
  const productOrdersEnabled = product.whatsapp_orders_enabled ?? true;

  // Le produit ET la boutique doivent tous deux autoriser WhatsApp -
  // désactiver au niveau boutique doit bloquer même si un override
  // produit existe encore (le vendeur a priorité sur sa propre vie privée).
  if (!shopOrdersEnabled || !productOrdersEnabled) {
    return json({ available: false, reason: 'WHATSAPP_ORDERS_DISABLED' });
  }

  const phone = product.whatsapp_order_number || shop?.whatsapp_number;
  if (!phone) {
    return json({ available: false, reason: 'NO_WHATSAPP_NUMBER' });
  }

  const productUrl = `${SITE_URL}/product/${product.slug ?? product.id}`;
  const priceText = `${product.price} ${product.currency ?? 'FCFA'}`;

  // Le lien produit EN PREMIER dans le message : c'est la référence que
  // le vendeur cliquera pour retrouver l'article, avant même de lire le
  // texte - certains vendeurs ne liront que ce lien.
  const message =
    `Bonjour, je souhaite commander ce produit sur MIA :\n` +
    `${productUrl}\n\n` +
    `Produit : ${product.name}\n` +
    `Quantité : ${quantity}\n` +
    `Prix unitaire : ${priceText}`;

  const cleanPhone = String(phone).replace(/[^0-9+]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(message)}`;

  return json({ available: true, whatsappUrl, phone: cleanPhone, message });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
