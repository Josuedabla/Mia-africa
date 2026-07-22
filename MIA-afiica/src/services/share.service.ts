/**
 * Share Service
 *
 * "Cliquer sur Partage montre les différents réseaux sociaux + le lien.
 * On privilégie WhatsApp car le plus utilisé." Reprend l'esprit de la
 * PARTIE 10 du brief d'origine (partage viral optimisé, liens propres
 * mia.com/nom-produit, Open Graph) mais retourne une liste ordonnée de
 * canaux pour que l'UI affiche WhatsApp en premier/mis en avant, plutôt
 * qu'un seul lien générique.
 *
 * "Si le partage d'articles peut prendre la photo + filigrane MIA
 * ajouté au lien" : buildProductShareUrl() ne pointe pas directement
 * vers /product/:slug (l'app React ne peut pas servir de balises
 * og:image dynamiques, c'est une SPA sans SSR), mais vers l'Edge
 * Function product-meta, qui sert une image de partage filigranée MIA
 * (logo + nom + prix incrustés sur la photo produit, voir
 * supabase/functions/product-share-image) aux crawlers WhatsApp/
 * Facebook/Telegram, tout en redirigeant les vrais visiteurs vers la
 * page produit normale.
 */

const FUNCTIONS_BASE_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';

/** URL à utiliser pour TOUT partage externe (jamais l'URL directe /product/:slug) - c'est elle qui porte l'image filigranée MIA dans l'aperçu du lien. */
export function buildProductShareUrl(productId: string): string {
  return `${FUNCTIONS_BASE_URL}/product-meta?productId=${productId}`;
}

export interface ShareChannel {
  id: 'whatsapp' | 'facebook' | 'telegram' | 'messenger' | 'twitter' | 'email' | 'copy_link' | 'native';
  label: string;
  url?: string;       // absent pour 'copy_link' et 'native' (gérés côté UI)
  isPrimary?: boolean;
}

export function buildProductShareChannels(params: {
  productId: string;
  productName: string;
  price?: string;
}): ShareChannel[] {
  const productUrl = buildProductShareUrl(params.productId);
  const text = `Découvrez ${params.productName} sur MIA${params.price ? ` - ${params.price}` : ''}`;
  const encodedUrl = encodeURIComponent(productUrl);
  const encodedText = encodeURIComponent(text);

  const channels: ShareChannel[] = [
    // WhatsApp en premier et marqué isPrimary : c'est le canal le plus
    // utilisé en Afrique de l'Ouest/Centrale, l'UI doit le mettre en avant
    // (bouton plus grand / couleur dédiée) plutôt que de l'aligner avec les autres.
    { id: 'whatsapp', label: 'WhatsApp', url: `https://wa.me/?text=${encodedText}%20${encodedUrl}`, isPrimary: true },
    { id: 'facebook', label: 'Facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { id: 'telegram', label: 'Telegram', url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}` },
    { id: 'messenger', label: 'Messenger', url: `fb-messenger://share/?link=${encodedUrl}` },
    { id: 'twitter', label: 'X (Twitter)', url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}` },
    { id: 'email', label: 'Email', url: `mailto:?subject=${encodeURIComponent(params.productName)}&body=${encodedText}%20${encodedUrl}` },
    { id: 'copy_link', label: 'Copier le lien' },
    { id: 'native', label: 'Plus...' }, // déclenche navigator.share() sur mobile si disponible
  ];

  return channels;
}

/** Utilise le partage natif du téléphone quand disponible (PARTIE 10 du brief d'origine). */
export async function shareNative(params: { title: string; text: string; url: string }): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share(params);
      return true;
    } catch {
      return false; // annulé par l'utilisateur, pas une erreur à remonter
    }
  }
  return false;
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export default { buildProductShareUrl, buildProductShareChannels, shareNative, copyToClipboard };
