-- ============================================================
-- MIA Marketplace — Migration 032: Badge bleu vérifié — achat
-- payant en pièces (999 pièces / an)
-- ============================================================
-- seller_profiles.verified existait déjà (migration 002) mais n'était
-- modifiable que côté admin, sans aucun flux d'achat - c'est ce badge
-- (icône BadgeCheck bleue, déjà affiché sur ShopPage via
-- get_shop_trust_stats().verified) que ce fichier rend achetable par le
-- vendeur lui-même, pour sa propre boutique, sans jamais dépendre d'une
-- validation admin.
--
-- Design : un nouveau champ blue_badge_expires_at (durée, contrairement
-- à seller_profiles.verified qui reste un flag permanent réservé à une
-- vérification admin/KYC future). Les deux mécanismes cohabitent et
-- affichent le MÊME badge public : get_shop_trust_stats().verified
-- devient vrai si l'un OU l'autre est actif.
--
-- Pas de cron d'expiration nécessaire ici (contrairement aux boosts
-- produit, migration 029) : blue_badge_expires_at est un timestamp
-- comparé à now() à la lecture, jamais un booléen dénormalisé qu'il
-- faudrait resynchroniser - le badge disparaît de lui-même à l'affichage
-- dès l'expiration, sans job périodique.

alter table public.seller_profiles
  add column if not exists blue_badge_expires_at timestamptz;

-- ---------- Prix fixe : 999 pièces / an ----------
-- Constante en dur dans la fonction (comme le taux de conversion
-- 12 FCFA/pièce l'est déjà côté client, coins.service.ts) plutôt qu'une
-- table de configuration - un seul palier, pas de tarification variable
-- comme pour les boosts produit.

create or replace function public.purchase_blue_badge(p_shop_id uuid)
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
  v_price constant bigint := 999;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select owner_id into v_owner_id from public.shops where id = p_shop_id;
  if v_owner_id is null then raise exception 'SHOP_NOT_FOUND'; end if;
  if v_owner_id <> v_uid then raise exception 'NOT_SHOP_OWNER'; end if;

  perform public.debit_coins(v_uid, v_price, 'Badge vérifié bleu (1 an) - boutique ' || p_shop_id, p_shop_id::text);

  -- S'assure qu'une ligne seller_profiles existe (devrait toujours être
  -- le cas pour un propriétaire de boutique - filet de sécurité, même
  -- pattern "insert ... on conflict do nothing" que le reste du projet,
  -- ex. migration 20260718000006_functions.sql:410).
  insert into public.seller_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;

  select blue_badge_expires_at into v_current_expiry
    from public.seller_profiles where user_id = v_uid for update;

  -- Renouvellement anticipé : prolonge à partir de l'expiration actuelle
  -- si elle est encore future (jamais perdue), sinon à partir de
  -- maintenant si le badge était déjà expiré ou jamais acheté.
  v_new_expiry := greatest(now(), coalesce(v_current_expiry, now())) + interval '1 year';

  update public.seller_profiles
    set blue_badge_expires_at = v_new_expiry, updated_at = now()
    where user_id = v_uid;

  return v_new_expiry;
end;
$$;

grant execute on function public.purchase_blue_badge(uuid) to authenticated;

-- ---------- get_shop_trust_stats: badge actif = admin OU achat ----------
-- Même signature de sortie qu'avant (migration 025) - seul le calcul de
-- `verified` change, donc create or replace suffit (pas besoin de drop).
create or replace function public.get_shop_trust_stats(p_shop_id uuid)
returns table (
  total_likes bigint,
  total_orders bigint,
  total_followers bigint,
  total_reviews integer,
  avg_rating numeric,
  member_since timestamptz,
  verified boolean
)
language sql
security definer
set search_path = public
stable as $$
  select
    coalesce((select sum(p.likes_count) from public.products p where p.shop_id = s.id), 0) as total_likes,
    coalesce((select count(*) from public.orders o where o.shop_id = s.id and o.status in ('paid','shipped','delivered')), 0) as total_orders,
    coalesce((select count(*) from public.followers f where f.followed_shop_id = s.id), 0) as total_followers,
    s.review_count as total_reviews,
    s.rating as avg_rating,
    s.created_at as member_since,
    coalesce(
      (select sp.verified or (sp.blue_badge_expires_at is not null and sp.blue_badge_expires_at > now())
       from public.seller_profiles sp where sp.user_id = s.owner_id),
      false
    ) as verified
  from public.shops s
  where s.id = p_shop_id;
$$;

grant execute on function public.get_shop_trust_stats(uuid) to authenticated, anon;
