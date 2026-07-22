// POST /functions/v1/moneroo-webhook
// Register this URL in the Moneroo dashboard (Développeurs > Webhooks):
// https://<project-ref>.supabase.co/functions/v1/moneroo-webhook
//
// Depuis le passage au modèle "Money-In Only" (migration
// 20260720000019), MIA n'a plus qu'un seul flux financier réel : l'achat
// de pièces MIA (coins-purchase). Plus de wallet, plus de règlement de
// commande en ligne, plus de retrait - tous les autres cas gérés
// précédemment (wallet_recharge, order_payment, payout) ont disparu.
//
// Chaque évènement reste vérifié par HMAC-SHA256 (X-Moneroo-Signature)
// avant de toucher la moindre donnée.
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { verifyMonerooSignature } from '../_shared/moneroo.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const rawBody = await req.text();
  const signature = req.headers.get('X-Moneroo-Signature');
  const webhookSecret = Deno.env.get('MONEROO_WEBHOOK_SECRET')!;

  if (!signature || !(await verifyMonerooSignature(rawBody, signature, webhookSecret))) {
    return new Response('Invalid signature', { status: 403 });
  }

  const { event, data } = JSON.parse(rawBody);
  const admin = getSupabaseAdmin();

  try {
    if (event === 'payment.success') {
      const metadata = data?.metadata ?? {};
      if (metadata.mia_type === 'coin_purchase' && metadata.mia_uid && metadata.mia_coin_amount) {
        // Idempotent : vérifie qu'aucune transaction ne référence déjà
        // cette payment_id avant de créditer, pour ne jamais créditer
        // deux fois sur un retry Moneroo (documenté jusqu'à 3 tentatives).
        const { data: existing } = await admin
          .from('coin_transactions')
          .select('id')
          .eq('related_id', data.id)
          .maybeSingle();

        if (!existing) {
          await admin.rpc('credit_coins', {
            p_user_id: metadata.mia_uid,
            p_amount: metadata.mia_coin_amount,
            p_description: `Achat de ${metadata.mia_coin_amount} pièces MIA confirmé`,
            p_related_id: data.id,
          });
        }
      }
    }
    // payment.initiated / payment.failed / payment.cancelled: rien à
    // faire, aucune pièce n'a été créditée donc rien à annuler.
    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('[moneroo-webhook] error', error);
    return new Response('Internal error', { status: 500 });
  }
});
