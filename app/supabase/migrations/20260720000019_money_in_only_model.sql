-- ============================================================
-- MIA Marketplace — Migration 019: Modèle "Money-In Only"
-- ============================================================
-- CHANGEMENT DE MODÈLE ÉCONOMIQUE MAJEUR, décidé explicitement avec le
-- fondateur : MIA ne touche plus JAMAIS l'argent réel des ventes. Le
-- paiement produit est strictement cash à la livraison, négocié
-- directement entre acheteur, vendeur et livreur - MIA n'y prend aucune
-- commission et n'a aucune responsabilité sur ce paiement.
--
-- Le seul revenu réel de MIA devient la vente de pièces MIA (jetons
-- internes, jamais convertibles en argent réel, pour personne - ni
-- vendeur, ni livreur, ni acheteur). Cela retire à MIA le statut
-- d'intermédiaire financier ("Money Transmitter"), et donc le besoin
-- d'un agrément de banque centrale pour opérer - c'est le bénéfice
-- juridique recherché par cette décision.
--
-- Ce qui disparaît : credit_wallet/debit_wallet liés aux ventes,
-- settle_order_payment (n'a plus de sens sans commission), payout
-- (plus aucun retrait possible pour personne), l'intégration
-- Moneroo/Chariow pour le règlement des commandes (mais PAS pour
-- l'achat de pièces, qui reste un paiement réel entrant - voir
-- migration 020).
--
-- Ce qui reste et devient central : le système de pièces (coins),
-- déjà présent depuis coins_debit/coins_credit, mais maintenant SEULE
-- monnaie de toute la plateforme.

-- ---------- Retrait des fonctions liées au wallet/commission de vente ----------
-- drop cascade nécessaire : credit_wallet/debit_wallet sont appelées par
-- settle_order_payment, purchase_with_wallet, request_payout, etc.
drop function if exists public.settle_order_payment(uuid, text) cascade;
drop function if exists public.purchase_with_wallet(uuid) cascade;
drop function if exists public.request_payout(uuid, numeric, text, jsonb) cascade;
drop function if exists public.credit_wallet(uuid, numeric, text, text, uuid, text, text) cascade;
drop function if exists public.debit_wallet(uuid, numeric, text, text, uuid) cascade;
drop function if exists public.transfer_to_user(uuid, uuid, numeric) cascade;
drop function if exists public.recharge_wallet_confirm(uuid, numeric, text, text) cascade;
drop function if exists public.payout_mark_completed(uuid) cascade;
drop function if exists public.payout_refund(uuid) cascade;

-- ---------- Retrait des tables devenues obsolètes ----------
-- On garde une trace en renommant plutôt qu'en supprimant tout de suite
-- (permet un audit/export avant suppression définitive si besoin), sauf
-- pour les tables purement transactionnelles sans valeur d'archive.
alter table if exists public.wallets rename to _deprecated_wallets_20260719;
alter table if exists public.wallet_transactions rename to _deprecated_wallet_transactions_20260719;
drop table if exists public.payout_requests cascade;
drop table if exists public.transfers cascade;

-- ---------- Nettoyage du schéma orders : plus de commission, plus de moneroo/chariow pour le règlement produit ----------
alter table public.orders drop column if exists commission_amount;
alter table public.orders drop column if exists vendor_share;
alter table public.orders drop column if exists chariow_sale_id;
alter table public.orders drop column if exists moneroo_payment_id;

-- payment_method n'a plus qu'une seule valeur possible en pratique, mais
-- on garde la colonne pour tracer explicitement "c'est bien du cash à la
-- livraison, négocié hors MIA" plutôt que de la retirer.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method is null or payment_method = 'cash_on_delivery');

comment on column public.orders.payment_method is 'Toujours cash_on_delivery ou NULL - MIA ne règle plus jamais un paiement produit. Le montant, le lieu et le moment sont négociés directement entre acheteur/vendeur/livreur, hors plateforme.';

-- ---------- orders.status simplifié : plus de 'paid' au sens "MIA a réglé" ----------
-- 'paid' est retiré du vocabulaire de statut : une commande passe direct
-- de 'pending' à 'delivered' (ou 'cancelled'/'failed') puisque MIA ne
-- constate jamais un paiement réel - seule la remise physique du produit
-- est un évènement que la plateforme peut observer (via confirm_delivery,
-- toujours d'actualité, migration 20260719000015).
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'shipped', 'delivered', 'cancelled', 'failed'));

-- ---------- confirm_delivery : retire l'appel à settle_order_payment (supprimée) ----------
create or replace function public.confirm_delivery(
  p_delivery_id uuid,
  p_otp_code text,
  p_proof_photo_url text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_delivery record;
begin
  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if v_delivery is null then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if v_delivery.driver_id <> auth.uid() then raise exception 'NOT_YOUR_DELIVERY'; end if;
  if v_delivery.status = 'delivered' then
    return; -- idempotent
  end if;
  if v_delivery.otp_code is null or v_delivery.otp_code <> p_otp_code then
    raise exception 'INVALID_OTP';
  end if;

  update public.deliveries
    set status = 'delivered', delivered_at = now(), proof_photo_url = coalesce(p_proof_photo_url, proof_photo_url)
    where id = p_delivery_id;

  -- Simple constat de remise, plus aucun règlement financier ici : MIA
  -- ne fait que reconnaître que le produit a changé de main. L'argent a
  -- été échangé directement entre les parties, hors plateforme.
  update public.orders set status = 'delivered', updated_at = now()
    where id = v_delivery.order_id and status in ('pending', 'shipped');
end;
$$;

grant execute on function public.confirm_delivery(uuid, text, text) to authenticated;

-- ---------- Correction du déclencheur de création de livraison ----------
-- La migration 20260719000014 créait la delivery quand orders.status
-- passait à 'paid' (paiement en ligne) OU dès l'insertion si
-- payment_method = 'cash_on_delivery'. Le statut 'paid' n'existe plus
-- (voir contrainte orders_status_check ci-dessus) : toute commande est
-- désormais cash à la livraison par nature, donc la delivery doit
-- systématiquement être créée dès l'insertion de la commande.
drop trigger if exists trg_create_delivery_on_paid on public.orders;
drop trigger if exists trg_create_delivery_on_cod_order on public.orders;

create trigger trg_create_delivery_on_order_insert
  after insert on public.orders
  for each row
  execute function public.create_delivery_for_order();

-- ---------- Correction de la notification de changement de statut ----------
-- notify_order_status_change (migration 20260719000012) mentionnait le
-- statut 'paid', retiré de orders_status_check ci-dessus.
create or replace function public.notify_order_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  if new.status = old.status then return new; end if;
  v_label := case new.status
    when 'shipped' then 'Votre commande est en route'
    when 'delivered' then 'Votre commande a été livrée'
    when 'cancelled' then 'Votre commande a été annulée'
    when 'failed' then 'La livraison de votre commande a échoué'
    else null
  end;
  if v_label is not null then
    insert into public.notifications (user_id, type, title, body, data)
      values (new.customer_id, 'order_status', v_label, null, jsonb_build_object('order_id', new.id, 'status', new.status));
  end if;
  return new;
end;
$$;
