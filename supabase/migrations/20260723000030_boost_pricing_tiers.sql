-- ============================================================
-- MIA Marketplace — Migration 030: Boost produit — paliers de
-- prix par durée (1 à 10 jours) au lieu d'un montant fixe / 24h
-- ============================================================
-- Avant cette migration, boost_product() acceptait n'importe quel
-- montant de pièces pour une durée fixe de 24h. Le vendeur choisit
-- maintenant une durée (1 à 10 jours) et paie un montant TOTAL pour
-- toute la durée, validé côté SQL contre un plancher/plafond
-- proportionnel à la durée choisie (jamais uniquement côté client,
-- comme le reste du projet le fait déjà systématiquement).
--
-- But du plancher : empêcher qu'un montant symbolique (ex. issu
-- uniquement de gains de parrainage) finance un boost de plusieurs
-- jours. But du plafond : empêcher qu'un montant démesuré écrase
-- durablement tous les autres vendeurs dans le tri.
--
-- Grille (progression strictement linéaire entre jour 1 et jour 10,
-- palier de 100 pièces/jour sur le plancher, 500 pièces/jour sur le
-- plafond) :
--   jour  1 : 99   à 500   pièces/jour  (total   99 à   500)
--   jour  2 : 199  à 1000  pièces/jour  (total  398 à  2000)
--   jour  3 : 299  à 1500  pièces/jour  (total  897 à  4500)
--   jour  4 : 399  à 2000  pièces/jour  (total 1596 à  8000)
--   jour  5 : 499  à 2500  pièces/jour  (total 2495 à 12500)
--   jour  6 : 599  à 3000  pièces/jour  (total 3594 à 18000)
--   jour  7 : 699  à 3500  pièces/jour  (total 4893 à 24500)
--   jour  8 : 799  à 4000  pièces/jour  (total 6392 à 32000)
--   jour  9 : 899  à 4500  pièces/jour  (total 8091 à 40500)
--   jour 10 : 999  à 5000  pièces/jour  (total 9990 à 50000)
--
-- Le vendeur ne voit ni clics, ni vues, ni le nom d'un réseau
-- externe dans l'interface de boost — uniquement la durée et le
-- prix en pièces.

-- ---------- Fonction: plancher/plafond total pour une durée donnée ----------
create or replace function public.get_boost_price_range(p_duration_days int)
returns table(min_total bigint, max_total bigint)
language sql immutable as $$
  select
    ((99 + (p_duration_days - 1) * 100) * p_duration_days)::bigint,
    ((500 + (p_duration_days - 1) * 500) * p_duration_days)::bigint;
$$;

grant execute on function public.get_boost_price_range(int) to authenticated, anon;

-- ---------- boost_product: durée en jours (1-10) + montant total validé ----------
create or replace function public.boost_product(p_product_id uuid, p_coin_amount bigint, p_duration_days int)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_boost_id uuid;
  v_min_total bigint;
  v_max_total bigint;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.products where id = p_product_id) then raise exception 'PRODUCT_NOT_FOUND'; end if;
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

-- Le paramètre p_duration_hours (int, défaut 24) disparaît au profit de
-- p_duration_days (int, obligatoire, 1-10) : signature identique en
-- nombre/type de paramètres (uuid, bigint, int), donc ce create or
-- replace remplace bien l'ancienne fonction plutôt que de créer une
-- surcharge supplémentaire.
grant execute on function public.boost_product(uuid, bigint, int) to authenticated;
