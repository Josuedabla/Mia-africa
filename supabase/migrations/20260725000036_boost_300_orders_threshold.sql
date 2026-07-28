-- ============================================================
-- MIA Marketplace — Migration 035: Boost produit — seuil de 300
-- commandes reçues avant de pouvoir booster (Ticket 3 du chantier
-- "Nouveau modèle économique MIA (pièces)")
-- ============================================================
-- Le système de paliers de prix du boost (1 à 10 jours, grille définie
-- dans la migration 20260723000030_boost_pricing_tiers.sql) NE CHANGE
-- PAS : le vendeur choisit toujours librement sa durée et son montant
-- dans la fourchette autorisée. La seule nouveauté est un verrou
-- d'accès : il faut que la boutique ait déjà reçu au moins 300
-- commandes (statut 'paid', 'shipped' ou 'delivered') pour pouvoir
-- utiliser le boost, qu'elle qu'en soit la durée choisie.
--
-- boost_product() garde une signature strictement identique
-- (p_product_id uuid, p_coin_amount bigint, p_duration_days int) : ce
-- create or replace remplace donc bien la fonction existante plutôt que
-- de créer une surcharge.
--
-- Le débit reste sans découvert autorisé (p_allow_overdraft non passé à
-- debit_coins, donc false par défaut) : impossible d'acheter un boost à
-- découvert, quelle que soit la durée choisie.

-- ---------- boost_product: ajout du verrou 300 commandes ----------
create or replace function public.boost_product(p_product_id uuid, p_coin_amount bigint, p_duration_days int)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_boost_id uuid;
  v_min_total bigint;
  v_max_total bigint;
  v_order_count int;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.products where id = p_product_id) then raise exception 'PRODUCT_NOT_FOUND'; end if;

  select count(*) into v_order_count from public.orders
    where shop_id = (select shop_id from public.products where id = p_product_id)
    and status in ('paid','shipped','delivered');
  if v_order_count < 300 then
    raise exception 'BOOST_LOCKED_NEED_300_ORDERS';
  end if;

  if p_duration_days is null or p_duration_days < 1 or p_duration_days > 10 then
    raise exception 'INVALID_BOOST_DURATION';
  end if;

  select min_total, max_total into v_min_total, v_max_total
    from public.get_boost_price_range(p_duration_days);

  if p_coin_amount < v_min_total or p_coin_amount > v_max_total then
    raise exception 'BOOST_AMOUNT_OUT_OF_RANGE';
  end if;

  perform public.debit_coins(v_uid, p_coin_amount, 'Boost produit ' || p_product_id, null);

  insert into public.product_boosts (product_id, user_id, coin_amount, boost_score, expires_at)
    values (p_product_id, v_uid, p_coin_amount, p_coin_amount, now() + make_interval(days => p_duration_days))
    returning id into v_boost_id;

  update public.products set is_boosted = true where id = p_product_id;
  return v_boost_id;
end;
$$;

grant execute on function public.boost_product(uuid, bigint, int) to authenticated;

-- ---------- Nouvelle fonction: nombre de commandes reçues par une boutique ----------
-- Nécessaire côté frontend pour afficher "il vous manque encore {{n}}
-- commandes" AVANT même de tenter le boost, y compris pour un visiteur
-- non authentifié qui consulte la page produit (ProductPage.tsx affiche
-- GiftBoostPanel à tous les visiteurs, pas seulement au vendeur). La
-- table orders est protégée par RLS ("orders_select_involved" — seuls le
-- client de la commande ou le propriétaire de la boutique peuvent la
-- lire), donc un simple select côté client ne fonctionnerait pas ici :
-- cette fonction security definer expose uniquement le COMPTE, pas le
-- détail des commandes.
create or replace function public.get_shop_order_count(p_shop_id uuid)
returns int language sql security definer set search_path = public stable as $$
  select count(*)::int from public.orders
    where shop_id = p_shop_id
    and status in ('paid','shipped','delivered');
$$;

grant execute on function public.get_shop_order_count(uuid) to authenticated, anon;
