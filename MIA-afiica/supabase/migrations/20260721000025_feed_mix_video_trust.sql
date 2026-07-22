-- ============================================================
-- MIA Marketplace — Migration 025: Mélange de flux 60/20/20,
-- lecteur vidéo externe (YouTube/TikTok) et stats de confiance boutique
-- ============================================================
-- Comble deux écarts identifiés lors de l'audit de la feuille de route :
--
-- 1) Partie 3.4 du plan ("mélange délibéré du flux, pas 100% ce que
--    l'algo pense que tu aimes") n'était pas implémentée : le flux
--    triait simplement par is_boosted puis views. get_discovery_feed_page
--    est remplacée par une vraie fonction SQL qui mélange, par page :
--      ~60% recommandé (boost + popularité)
--      ~20% nouveaux vendeurs / boutiques peu exposées
--      ~20% boutiques suivies par l'utilisateur (0% si non connecté ou
--           s'il ne suit personne, redistribué au pool recommandé pour
--           ne jamais renvoyer un flux plus court que nécessaire)
--
-- 2) Partie 4 du plan (lecteur vidéo produit YouTube/TikTok) n'avait
--    aucune colonne pour stocker le lien externe. On ajoute
--    products.external_video_url ; le rendu (MediaPlayer.tsx) est côté
--    front, la BDD ne stocke qu'une URL de plus, pas de fichier vidéo.
--
-- 3) Nouveau : signaux de confiance affichables sur le profil public
--    d'un vendeur (nombre de likes reçus au total, nombre de commandes
--    total, abonnés, ancienneté, badge vérifié) - agrégés côté serveur
--    plutôt que recalculés côté client à partir de données parfois
--    protégées par la RLS (orders).

-- ---------- 1) Lien vidéo externe sur les produits ----------
alter table public.products
  add column if not exists external_video_url text;

comment on column public.products.external_video_url is
  'Lien YouTube ou TikTok optionnel pour la fiche produit (Partie 4 du plan de croissance). Ne remplace pas les photos, s''affiche en plus.';

-- ---------- 2) Flux de découverte mélangé 60/20/20 ----------
-- (avant cette migration, "getDiscoveryFeedPage" n'existait que côté
-- JS/TS - un simple order by is_boosted/views - jamais en SQL ici)
create or replace function public.get_discovery_feed_page(
  p_country text,
  p_page integer,
  p_page_size integer default 12,
  p_category text default null,
  p_user_id uuid default null
) returns setof public.products
language plpgsql stable as $$
declare
  v_followed_n integer;
  v_new_n integer;
  v_recommended_n integer;
  v_followed_available integer := 0;
begin
  if p_page_size is null or p_page_size < 1 then
    p_page_size := 12;
  end if;
  if p_page is null or p_page < 0 then
    p_page := 0;
  end if;

  v_followed_n := greatest(round(p_page_size * 0.2)::int, 0);
  v_new_n := greatest(round(p_page_size * 0.2)::int, 1);

  if p_user_id is not null then
    select count(*) into v_followed_available
    from public.followers f
    where f.follower_id = p_user_id and f.followed_shop_id is not null;
  end if;

  -- Personne à suivre (ou anonyme) -> ce pool ne renvoie jamais rien,
  -- alors autant redonner sa part au pool recommandé plutôt que
  -- raccourcir la page.
  if v_followed_available = 0 then
    v_followed_n := 0;
  end if;

  v_recommended_n := greatest(p_page_size - v_followed_n - v_new_n, 1);

  return query
  with followed_pool as (
    select p.*
    from public.products p
    where v_followed_n > 0
      and p_user_id is not null
      and p.country_code = p_country
      and p.status = 'active'
      and (p_category is null or p.category = p_category)
      and p.shop_id in (
        select f.followed_shop_id from public.followers f
        where f.follower_id = p_user_id and f.followed_shop_id is not null
      )
    order by p.created_at desc
    offset v_followed_n * p_page
    limit v_followed_n
  ),
  new_pool as (
    select p.*
    from public.products p
    join public.shops s on s.id = p.shop_id
    where p.country_code = p_country
      and p.status = 'active'
      and (p_category is null or p.category = p_category)
      and (s.total_sales = 0 or s.created_at > now() - interval '30 days')
      and p.id not in (select id from followed_pool)
    order by p.created_at desc
    offset v_new_n * p_page
    limit v_new_n
  ),
  used_ids as (
    select id from followed_pool
    union
    select id from new_pool
  ),
  recommended_pool as (
    select p.*
    from public.products p
    where p.country_code = p_country
      and p.status = 'active'
      and (p_category is null or p.category = p_category)
      and p.id not in (select id from used_ids)
    order by p.is_boosted desc, p.views desc
    offset v_recommended_n * p_page
    limit v_recommended_n
  )
  select * from followed_pool
  union all
  select * from new_pool
  union all
  select * from recommended_pool
  -- Mélange visuel : sinon la page afficherait un bloc "suivis" puis un
  -- bloc "nouveaux" puis un bloc "recommandé", ce qui n'a rien d'un flux
  -- mélangé même si les proportions sont correctes.
  order by random();
end;
$$;

grant execute on function public.get_discovery_feed_page(text, integer, integer, text, uuid) to authenticated, anon;

-- ---------- 3) Statistiques de confiance d'une boutique ----------
-- SECURITY DEFINER : le total de commandes doit être visible par tout le
-- monde sur la page publique de la boutique (preuve sociale), alors que
-- la table orders elle-même est protégée par RLS (un visiteur normal ne
-- peut lire que ses propres commandes). On n'expose ici qu'un agrégat
-- (un nombre), jamais le détail des commandes.
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
    coalesce((select sp.verified from public.seller_profiles sp where sp.user_id = s.owner_id), false) as verified
  from public.shops s
  where s.id = p_shop_id;
$$;

grant execute on function public.get_shop_trust_stats(uuid) to authenticated, anon;
