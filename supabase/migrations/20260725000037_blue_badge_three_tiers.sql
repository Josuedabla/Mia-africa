-- ============================================================
-- MIA Marketplace — Migration 035: Badge bleu vérifié — 3 formules
-- (1 / 3 / 12 mois) au lieu d'un tarif annuel unique
-- ============================================================
-- Remplace la fonction purchase_blue_badge(p_shop_id) de la migration
-- 032 (999 pièces / an, durée fixe) par purchase_blue_badge(p_shop_id,
-- p_duration_months) où la durée devient un choix explicite du vendeur :
--   - 1 mois  : 198 pièces (~198/mois)
--   - 3 mois  : 398 pièces (~133/mois)
--   - 12 mois : 999 pièces (~83/mois) — c'est l'ancien tarif annuel,
--     inchangé, conservé comme palier le plus avantageux.
--
-- On ne modifie pas le fichier 032 déjà appliqué en prod (convention du
-- projet) : on droppe l'ancienne signature à 1 argument et on recrée la
-- fonction avec la nouvelle signature à 2 arguments, p_duration_months
-- obligatoire (pas de valeur par défaut) pour forcer un choix explicite
-- côté appelant.
--
-- Découvert (ticket 0) : non concerné ici, comme avant — l'achat du
-- badge ne passe pas p_allow_overdraft à debit_coins, qui reste donc à
-- son défaut `false` (aucun découvert autorisé pour acheter un badge).

drop function if exists public.purchase_blue_badge(uuid);

create or replace function public.purchase_blue_badge(p_shop_id uuid, p_duration_months int)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner_id uuid;
  v_current_expiry timestamptz;
  v_new_expiry timestamptz;
  v_price bigint;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select owner_id into v_owner_id from public.shops where id = p_shop_id;
  if v_owner_id is null then raise exception 'SHOP_NOT_FOUND'; end if;
  if v_owner_id <> v_uid then raise exception 'NOT_SHOP_OWNER'; end if;

  if p_duration_months = 1 then
    v_price := 198;
  elsif p_duration_months = 3 then
    v_price := 398;
  elsif p_duration_months = 12 then
    v_price := 999;
  else
    raise exception 'INVALID_BADGE_DURATION';
  end if;

  perform public.debit_coins(
    v_uid,
    v_price,
    'Badge vérifié bleu (' || p_duration_months || ' mois) - boutique ' || p_shop_id,
    p_shop_id::text
  );

  -- S'assure qu'une ligne seller_profiles existe (filet de sécurité,
  -- même pattern que la migration 032).
  insert into public.seller_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;

  select blue_badge_expires_at into v_current_expiry
    from public.seller_profiles where user_id = v_uid for update;

  -- Renouvellement anticipé : logique inchangée (migration 032), seule
  -- la durée ajoutée correspond maintenant à la formule achetée au lieu
  -- de toujours 1 an.
  v_new_expiry := greatest(now(), coalesce(v_current_expiry, now())) + make_interval(months => p_duration_months);

  update public.seller_profiles
    set blue_badge_expires_at = v_new_expiry, updated_at = now()
    where user_id = v_uid;

  return v_new_expiry;
end;
$$;

grant execute on function public.purchase_blue_badge(uuid, int) to authenticated;
