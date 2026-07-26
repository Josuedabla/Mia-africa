/**
 * WhatsApp Order Service
 *
 * "Possibilité que le vendeur désactive la réception de commande sur
 * WhatsApp. Si désactivé, le bouton Commander n'envoie pas vers
 * WhatsApp." -> ce service appelle l'Edge Function whatsapp-order, qui
 * résout le numéro effectif (override produit ou numéro boutique) et
 * renvoie available:false si le vendeur (ou le produit collaboratif) a
 * désactivé ce canal. Le composant appelant doit alors proposer UNIQUEMENT
 * le flux de commande interne à MIA (checkoutCart), jamais un lien
 * WhatsApp de secours - respecter le choix de vie privée du vendeur.
 */
import { supabase } from '@/lib/supabase';

export interface WhatsAppOrderLink {
  available: boolean;
  reason?: 'WHATSAPP_ORDERS_DISABLED' | 'NO_WHATSAPP_NUMBER';
  whatsappUrl?: string;
  phone?: string;
  message?: string;
}

export async function getWhatsAppOrderLink(productId: string, quantity = 1): Promise<WhatsAppOrderLink> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-order`;
  const url = `${baseUrl}?productId=${encodeURIComponent(productId)}&quantity=${quantity}`;

  const response = await fetch(url, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });
  if (!response.ok) throw new Error(`WhatsApp order link failed: ${response.status}`);
  return response.json();
}

/** Le vendeur bascule la réception de commandes WhatsApp pour SA boutique. */
export async function setShopWhatsAppOrdersEnabled(shopId: string, enabled: boolean) {
  const { error } = await supabase.from('shops').update({ whatsapp_orders_enabled: enabled }).eq('id', shopId);
  if (error) throw error;
}

/** Le vendeur change le numéro de réception de sa boutique. */
export async function setShopWhatsAppNumber(shopId: string, whatsappNumber: string) {
  const { error } = await supabase.from('shops').update({ whatsapp_number: whatsappNumber }).eq('id', shopId);
  if (error) throw error;
}

/**
 * Override par produit : permet la collaboration décrite dans le brief
 * ("un utilisateur populaire met le produit du nouveau vendeur avec le
 * numéro d'un autre vendeur"). Laisser whatsappNumber vide retire l'override
 * et retombe sur le numéro de la boutique.
 */
export async function setProductWhatsAppOverride(productId: string, whatsappNumber: string | null, enabled = true) {
  const { error } = await supabase
    .from('products')
    .update({ whatsapp_order_number: whatsappNumber, whatsapp_orders_enabled: enabled })
    .eq('id', productId);
  if (error) throw error;
}

export default { getWhatsAppOrderLink, setShopWhatsAppOrdersEnabled, setShopWhatsAppNumber, setProductWhatsAppOverride };
