/**
 * Notifications Service
 *
 * Les notifications elles-mêmes sont créées côté serveur par des triggers
 * SQL (migration 20260719000012, notify_new_order / notify_order_status_change
 * / notify_delivery_assigned / notify_similar_product_published) - ce
 * fichier ne fait que lire/marquer comme lu, et s'abonner en temps réel via
 * Supabase Realtime pour un affichage instantané ("badge" de notification)
 * sans polling.
 */
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export async function listNotifications(userId: string, onlyUnread = false) {
  let query = supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (onlyUnread) query = query.eq('read', false);
  const { data, error } = await query.limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  if (error) throw error;
}

/** S'abonne aux nouvelles notifications en temps réel. Retourne le channel à unsubscribe au démontage du composant. */
export function subscribeToNotifications(userId: string, onNotification: (payload: any) => void): RealtimeChannel {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      onNotification
    )
    .subscribe();
}

export default { listNotifications, markNotificationRead, markAllNotificationsRead, subscribeToNotifications };
