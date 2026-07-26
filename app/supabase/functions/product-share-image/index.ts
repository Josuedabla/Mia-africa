// GET /functions/v1/product-share-image?productId=...
//
// "Si le partage d'articles peut prendre la photo + filigrane MIA
// ajouté au lien" - génère une image de partage (utilisée par les
// balises Open Graph og:image et pour le lien natif) qui superpose un
// filigrane MIA (logo + nom du produit + prix) sur la photo principale
// du produit, plutôt que de partager la photo brute. Renforce
// l'identité de marque à chaque partage viral, sur WhatsApp/Facebook/
// Telegram - où que le lien atterrisse, l'image porte visiblement MIA.
//
// Approche technique : composition SVG superposée à l'image source, puis
// rendue en PNG. Deno n'a pas de Canvas natif fiable en edge runtime -
// le SVG-overlay est l'approche la plus légère et déterministe pour ce
// besoin (bandeau de marque, pas une retouche photo complexe).
// @deno-types="npm:@resvg/resvg-wasm@2"
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

// initWasm doit être appelé une seule fois par instance de la fonction
// (cold start) - contrairement à resvg-js (binding natif Rust non fiable
// en edge runtime, voir doc Supabase: "libraries that depend heavily on
// Node.js native modules" ne sont pas supportées), resvg-wasm est du
// WebAssembly pur, éprouvé sur des edge runtimes équivalents (Cloudflare
// Workers) - c'est le choix sûr ici.
let wasmReady: Promise<void> | null = null;
function ensureWasmInitialized(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(fetch('https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm'));
  }
  return wasmReady;
}

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h - l'image ne doit pas être régénérée à chaque clic de partage

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get('content-type') ?? 'image/jpeg';
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { base64: btoa(binary), mime };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const productId = url.searchParams.get('productId');
  if (!productId) return new Response('productId is required', { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: product } = await admin
    .from('products')
    .select('name, price, currency, shops(name)')
    .eq('id', productId)
    .single();

  if (!product) return new Response('Product not found', { status: 404 });

  const { data: media } = await admin
    .from('product_media')
    .select('url')
    .eq('product_id', productId)
    .eq('media_type', 'image')
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();

  const primaryImageUrl = media?.url;
  const shopName = (product as any).shops?.name ?? 'MIA';
  const priceText = `${product.price?.toLocaleString('fr-FR')} ${product.currency ?? 'FCFA'}`;

  const WIDTH = 1200;
  const HEIGHT = 630; // format standard Open Graph

  const imageData = primaryImageUrl ? await fetchImageAsBase64(primaryImageUrl) : null;

  // Le SVG superpose : l'image produit en fond (ou un dégradé de repli si
  // aucune image), un bandeau semi-transparent en bas avec le logo MIA
  // (texte stylisé, pas de dépendance à un fichier logo externe pour
  // rester autonome), le nom du produit, le prix, et la boutique.
  const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0" />
      <stop offset="100%" stop-color="black" stop-opacity="0.75" />
    </linearGradient>
    <clipPath id="rounded"><rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" rx="0" /></clipPath>
  </defs>

  <g clip-path="url(#rounded)">
    ${
      imageData
        ? `<image href="data:${imageData.mime};base64,${imageData.base64}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice" />`
        : `<rect width="${WIDTH}" height="${HEIGHT}" fill="#0f766e" />`
    }

    <!-- Bandeau de marque en bas, toujours visible quelle que soit l'image source -->
    <rect x="0" y="${HEIGHT - 220}" width="${WIDTH}" height="220" fill="url(#bandGradient)" />

    <!-- Filigrane logo MIA, coin supérieur droit, visible sur toute la surface -->
    <g transform="translate(${WIDTH - 170}, 30)" opacity="0.92">
      <rect x="0" y="0" width="140" height="48" rx="24" fill="white" fill-opacity="0.15" />
      <text x="70" y="32" font-family="Arial, sans-serif" font-size="26" font-weight="800" fill="white" text-anchor="middle">MIA</text>
    </g>

    <!-- Informations produit, bandeau bas -->
    <text x="40" y="${HEIGHT - 130}" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="#7ee9c9">${escapeXml(shopName)}</text>
    <text x="40" y="${HEIGHT - 90}" font-family="Arial, sans-serif" font-size="40" font-weight="800" fill="white">${escapeXml(product.name.slice(0, 42))}</text>
    <text x="40" y="${HEIGHT - 45}" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#7ee9c9">${escapeXml(priceText)}</text>
    <text x="${WIDTH - 40}" y="${HEIGHT - 45}" font-family="Arial, sans-serif" font-size="18" fill="white" text-anchor="end" opacity="0.7">mia.com</text>
  </g>
</svg>`;

  await ensureWasmInitialized();
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  return new Response(pngBuffer, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/png',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  });
});
