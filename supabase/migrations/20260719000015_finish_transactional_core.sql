-- ============================================================
-- MIA Marketplace — Migration 015: Finaliser le cœur transactionnel
-- ============================================================
-- Corrige trois trous trouvés en auditant paiement/livraison/avis :
--
-- 1. deliveries.otp_code existait mais n'était jamais généré ni vérifié -
--    n'importe quel livreur pouvait marquer "livré" sans preuve de remise.
-- 2. Rien ne propageait deliveries.status='delivered' vers orders.status -
--    la commande restait bloquée, et donc AUCUN avis n'était jamais
--    possible (la policy reviews_insert_if_purchased exige
--    orders.status = 'delivered').
-- 3. Le règlement du paiement cash à la livraison (settle_order_payment
--    avec 'cash_on_delivery') existait déjà en fonction, mais rien ne
--    l'appelait au moment réel de la remise.
--
-- Ces trois trous combinés cassaient silencieusement toute la boucle de
-- confiance : livraison non prouvée + commande jamais soldée + avis
-- impossible = zéro signal de fiabilité vendeur, malgré tout le reste de
-- l'architecture déjà en place pour l'exploiter.

-- ---------- Génération de l'OTP à l'assignation du livreur ----------
-- Un code à 4 chiffres, donné par le client au livreur en main propre à
-- la remise (affiché dans l'app client dès que la livraison est
-- 'assigned'). Le livreur doit le saisir pour pouvoir marquer "livré" -
-- preuve simple mais efficace, standard dans la logistique africaine
-- (Jumia, Glovo utilisent le même mécanisme).
create or replace function public.generate_delivery_otp()
returns trigger language plpgsql as $$
begin
  if new.status = 'assigned' and (old.status is null or old.status <> 'assigned') and new.otp_code is null then
    new.otp_code := lpad(floor(random() * 10000)::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_generate_delivery_otp
  before update of status on public.deliveries
  for each row execute function public.generate_delivery_otp();

-- Cas où la delivery est créée directement en 'assigned' (rare mais
-- possible) - même logique à l'insertion.
create trigger trg_generate_delivery_otp_insert
  before insert on public.deliveries
  for each row
  when (new.status = 'assigned')
  execute function public.generate_delivery_otp();

-- ---------- Confirmation de livraison avec vérification OTP ----------
-- Remplace un simple update direct sur deliveries.status par cette
-- fonction : c'est le SEUL chemin légitime pour passer une livraison à
-- 'delivered'. Vérifie l'OTP fourni par le livreur, propage vers orders,
-- et règle le paiement si la commande est en paiement à la livraison.
create or replace function public.confirm_delivery(
  p_delivery_id uuid,
  p_otp_code text,
  p_proof_photo_url text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_delivery record;
  v_order record;
begin
  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if v_delivery is null then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if v_delivery.driver_id <> auth.uid() then raise exception 'NOT_YOUR_DELIVERY'; end if;
  if v_delivery.status = 'delivered' then
    return; -- idempotent : déjà confirmée
  end if;
  if v_delivery.otp_code is null or v_delivery.otp_code <> p_otp_code then
    raise exception 'INVALID_OTP';
  end if;

  update public.deliveries
    set status = 'delivered', delivered_at = now(), proof_photo_url = coalesce(p_proof_photo_url, proof_photo_url)
    where id = p_delivery_id;

  select * into v_order from public.orders where id = v_delivery.order_id for update;

  -- Règle le paiement si c'était du cash à la livraison et que la
  -- commande n'est pas déjà payée par un autre moyen (wallet/en ligne
  -- payé d'avance) - settle_order_payment est idempotent par construction
  -- (elle vérifie status = 'pending' avant d'agir).
  if v_order.status = 'pending' and v_order.product_payment_timing = 'after' then
    perform public.settle_order_payment(v_order.id, 'cash_on_delivery');
  end if;

  -- Propage le statut "livré" vers la commande dans tous les cas (même
  -- si déjà payée en ligne avant) - c'est CE champ que la policy RLS des
  -- avis (reviews_insert_if_purchased) vérifie.
  update public.orders set status = 'delivered', updated_at = now()
    where id = v_delivery.order_id and status in ('pending', 'paid', 'shipped');
end;
$$;

grant execute on function public.confirm_delivery(uuid, text, text) to authenticated;

-- ---------- Note : la mise à jour de deliveries par le livreur (pour
-- marquer picked_up) est déjà couverte par la policy "deliveries_driver_update"
-- (migration 20260718000007_rls.sql, using driver_id = auth.uid()) - pas
-- besoin d'une policy supplémentaire ici.

-- ---------- Notification au client : le livreur a le colis ----------
create or replace function public.notify_picked_up()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'picked_up' or old.status = 'picked_up' then return new; end if;
  insert into public.notifications (user_id, type, title, body, data)
  select o.customer_id, 'delivery_picked_up', 'Votre colis est en route',
    'Le livreur a récupéré votre commande et se dirige vers vous.',
    jsonb_build_object('order_id', o.id, 'delivery_id', new.id)
  from public.orders o where o.id = new.order_id;
  return new;
end;
$$;

create trigger trg_notify_picked_up
  after update of status on public.deliveries
  for each row execute function public.notify_picked_up();
