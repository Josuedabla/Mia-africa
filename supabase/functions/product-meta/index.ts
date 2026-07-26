// GET /functions/v1/product-meta/:productId (ou ?productId=...)
//
// Sert une page HTML minimale avec les balises Open Graph pointant vers
// l'image de partage filigranée (product-share-image), destinée
// UNIQUEMENT aux crawlers de réseaux sociaux (WhatsApp, Facebook,
// Telegram, Twitter) - jamais aux vrais visiteurs humains.
//
// Pourquoi une fonction séparée : MIA est une SPA React pure (Vite, pas
// de SSR) - les crawlers de réseaux sociaux n'exécutent pas JavaScript,
// ils lisent uniquement le HTML brut retourné par le premier GET. Sans
// ce détour, aucune balise og:image ne serait jamais visible pour
// WhatsApp/Facebook, quel que soit ce qu'affiche l'app une fois montée.
//
// Configuration nécessaire côté proxy/CDN du domaine principal (Cloudflare,
// Nginx, etc.) : rediriger les requêtes dont le User-Agent contient
// "WhatsApp", "facebookexternalhit", "TelegramBot", "Twitterbot" sur
// /product/:slug vers cette fonction, AVANT de servir le fichier
// index.html statique de la SPA. Les navigateurs réels ne sont jamais
// concernés par cette redirection - c'est le pattern standard documenté
// par Meta lui-même pour les SPA ("customize the content accordingly").
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://mia.com';
const FUNCTIONS_BASE_URL = Deno.env.get('SUPABASE_URL')! + '/functions/v1';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const productId = url.searchParams.get('productId') ?? url.pathname.split('/').pop();

  if (!productId) {
    return new Response('productId is required', { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: product } = await admin
    .from('products')
    .select('name, price, currency, slug, shops(name)')
    .eq('id', productId)
    .maybeSingle();

  if (!product) {
    return new Response('Product not found', { status: 404 });
  }

  const shopName = (product as any).shops?.name ?? 'MIA';
  const priceText = `${product.price?.toLocaleString('fr-FR')} ${product.currency ?? 'FCFA'}`;
  const productUrl = `${SITE_URL}/product/${product.slug ?? productId}`;
  const shareImageUrl = `${FUNCTIONS_BASE_URL}/product-share-image?productId=${productId}`;
  const title = `${product.name} - ${priceText} | ${shopName} sur MIA`;
  const description = `Découvrez ${product.name} chez ${shopName} sur MIA, à ${priceText}.`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />

  <meta property="og:type" content="product" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${shareImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${productUrl}" />
  <meta property="og:site_name" content="MIA" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${shareImageUrl}" />

  <!-- Redirige les vrais visiteurs humains vers l'app React normale -
       les crawlers de réseaux sociaux ne suivent jamais ce redirect
       JS/meta refresh, ils ne lisent que les balises og: ci-dessus. -->
  <meta http-equiv="refresh" content="0; url=${productUrl}" />
</head>
<body>
  <p>Redirection vers <a href="${productUrl}">${escapeHtml(product.name)}</a>...</p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
});
