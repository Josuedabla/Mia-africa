/**
 * Orders Service (côté client acheteur)
 *
 * Liste et suivi des commandes du client connecté. Le code OTP de
 * livraison est lisible ici (le client le communique au livreur en main
 * propre) - il n'est jamais affiché au livreur avant que le client ne le
 * lui donne, RLS garantit que seul le client propriétaire de la commande
 * peut lire deliveries.otp_code via cette jointure.
 */
import { supabase } from '@/lib/supabase';

export async function listMyOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, shops(name, slug, logo_url), order_items(*, products(name)), deliveries(id, status, otp_code, driver_id)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getOrderDetail(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, shops(name, slug, logo_url), order_items(*, products(id, name)), deliveries(id, status, otp_code, driver_id, picked_up_at, delivered_at)')
    .eq('id', orderId)
    .single();
  if (error) throw error;
  return data;
}

export default { listMyOrders, getOrderDetail };
