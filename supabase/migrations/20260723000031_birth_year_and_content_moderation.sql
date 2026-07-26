-- ============================================================
-- MIA Marketplace — Migration 031: Année de naissance, logs de
-- recherche (Mia Ads), modération produits interdits, certification
-- vendeur, signalement
-- ============================================================
-- Cadre : voir MIA-Cadre-Legal-Moderation.md. Pas d'avocat consulté à ce
-- stade — cette migration suit les pratiques générales observées chez
-- les grandes plateformes (Meta/TikTok/YouTube : âge minimum 13 ans à
-- l'inscription, ciblage publicitaire comportemental exclu pour les
-- mineurs, préférence pour une donnée qui ne se périme pas plutôt qu'un
-- calcul figé). À faire valider par un juriste avant un usage publicitaire
-- réel à grande échelle.
--
-- Choix ANNÉE DE NAISSANCE plutôt que tranche d'âge fixe : une tranche
-- d'âge enregistrée aujourd'hui devient fausse dans 2 ou 3 ans (la
-- plateforme va durer des années, les utilisateurs vieillissent) alors
-- que l'année de naissance ne change jamais - l'âge et la tranche d'âge
-- sont dérivés à la volée à chaque lecture via get_age(), jamais stockés.

-- ============================================================
-- 1. Année de naissance (remplace la tranche d'âge figée)
-- ============================================================
alter table public.profiles
  add column if not exists birth_year int;

-- Âge minimum 13 ans à l'inscription, comme la plupart des grandes
-- plateformes (Meta, TikTok, Google) en l'absence de seuil légal propre
-- à chaque pays confirmé par un juriste - à ajuster pays par pays si
-- besoin plus tard (ex. RGPD retient 16 ans par défaut, certains pays
-- européens l'abaissent à 13-15 par dérogation nationale).
alter table public.profiles
  add constraint profiles_birth_year_range
  check (
    birth_year is null
    or (birth_year between 1900 and (extract(year from now())::int - 13))
  );

comment on column public.profiles.birth_year is
  'Année de naissance déclarée (jamais date complète) - suffisant pour calculer un âge/tranche d''âge et ne devient jamais obsolète, contrairement à une tranche d''âge stockée telle quelle. Renseigné uniquement avec le consentement marketing (voir set_profile_birth_year).';

-- ---------- fn: âge courant calculé à la volée ----------
create or replace function public.get_age(p_birth_year int)
returns int language sql stable as $$
  select case when p_birth_year is null then null
    else extract(year from now())::int - p_birth_year end;
$$;

-- ---------- fn: tranche d'âge dérivée (pour l'agrégation pub, jamais l'âge exact exposé côté ads) ----------
create or replace function public.get_age_bracket(p_birth_year int)
returns text language sql stable as $$
  select case
    when p_birth_year is null then null
    when public.get_age(p_birth_year) < 18 then null -- jamais de tranche pour un mineur, exclu du ciblage par construction
    when public.get_age(p_birth_year) between 18 and 24 then '18-24'
    when public.get_age(p_birth_year) between 25 and 34 then '25-34'
    when public.get_age(p_birth_year) between 35 and 44 then '35-44'
    when public.get_age(p_birth_year) between 45 and 54 then '45-54'
    else '55+'
  end;
$$;

grant execute on function public.get_age(int), public.get_age_bracket(int) to authenticated, anon;

-- ---------- RPC: définir/mettre à jour sa propre année de naissance ----------
-- Nécessite le consentement marketing déjà accepté (migration 023) -
-- cohérent avec "collecter seulement s'il accepte" : l'année de
-- naissance n'a d'utilité ici que pour la publicité, donc pas de raison
-- de la demander avant ce consentement précis.
create or replace function public.set_profile_birth_year(p_birth_year int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_marketing_consent boolean;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select marketing_consent into v_marketing_consent from public.user_consents where user_id = v_uid;
  if coalesce(v_marketing_consent, false) = false then
    raise exception 'MARKETING_CONSENT_REQUIRED';
  end if;

  if p_birth_year < 1900 or p_birth_year > (extract(year from now())::int - 13) then
    raise exception 'INVALID_BIRTH_YEAR';
  end if;

  update public.profiles set birth_year = p_birth_year, updated_at = now() where id = v_uid;
end;
$$;

grant execute on function public.set_profile_birth_year(int) to authenticated;

-- ============================================================
-- 2. Logs de recherche (Mia Ads) — conditionnés au consentement
--    analytique existant, réutilise le même mécanisme que `analytics`
-- ============================================================
create table public.search_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id text, -- visiteur anonyme, cohérent avec anonymous_consents.session_id
  query text not null,
  category text,
  country_code text,
  created_at timestamptz not null default now()
);

create index idx_search_logs_created on public.search_logs (created_at desc);
create index idx_search_logs_user on public.search_logs (user_id) where user_id is not null;

alter table public.search_logs enable row level security;

-- Écriture ouverte (comme `analytics`) car le trigger de consentement
-- (réutilisé tel quel, il ne connaît que new.user_id/new.session_id, donc
-- fonctionne sans modification sur cette table) annule silencieusement
-- tout insert sans consentement analytique valide - jamais de confiance
-- dans le client pour ne pas appeler la fonction si le consentement est
-- refusé.
create policy "search_logs_insert_open" on public.search_logs for insert with check (true);
-- Lecture réservée à l'utilisateur concerné (transparence, il doit
-- pouvoir voir ce qui a été loggé sur lui) et à l'admin (agrégation Mia
-- Ads) - jamais de lecture publique ou par un autre utilisateur.
create policy "search_logs_select_own_or_admin" on public.search_logs
  for select using (user_id = auth.uid() or public.is_admin());

drop trigger if exists trg_check_search_logs_consent on public.search_logs;
create trigger trg_check_search_logs_consent
  before insert on public.search_logs
  for each row execute function public.check_analytics_consent();

-- ---------- RPC: logger une recherche ----------
create or replace function public.log_search(p_query text, p_category text default null, p_country text default null, p_session_id text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_query is null or length(trim(p_query)) = 0 then return; end if;
  insert into public.search_logs (user_id, session_id, query, category, country_code)
    values (auth.uid(), p_session_id, trim(p_query), p_category, p_country);
end;
$$;

grant execute on function public.log_search(text, text, text, text) to authenticated, anon;

-- ---------- Purge automatique : conservation 24 mois, pas indéfinie ----------
create or replace function public.purge_old_search_logs()
returns integer language plpgsql as $$
declare v_deleted int;
begin
  delete from public.search_logs where created_at < now() - interval '24 months';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- ---------- fn agrégée pour Mia Ads : jamais l'âge exact, jamais un mineur ----------
-- Point d'entrée unique pour toute future exploitation publicitaire -
-- ne retourne que des agrégats (comptage par tranche/catégorie/pays), ne
-- permet jamais de retrouver la recherche individuelle d'un utilisateur.
create or replace function public.get_search_ads_aggregate(p_country text default null, p_since timestamptz default now() - interval '30 days')
returns table(age_bracket text, category text, search_count bigint)
language sql stable as $$
  select public.get_age_bracket(p.birth_year) as age_bracket, sl.category, count(*) as search_count
  from public.search_logs sl
  left join public.profiles p on p.id = sl.user_id
  where sl.created_at >= p_since
    and (p_country is null or sl.country_code = p_country)
    and public.get_age_bracket(p.birth_year) is not null -- exclut mineurs et utilisateurs sans consentement marketing/âge renseigné
  group by 1, 2;
$$;

grant execute on function public.get_search_ads_aggregate(text, timestamptz) to authenticated;
-- Restreint à l'admin uniquement au niveau applicatif (RPC), pas de
-- policy RLS spécifique nécessaire ici car la fonction ne lit que des
-- agrégats, jamais une ligne individuelle exploitable.

-- ============================================================
-- 3. Produits strictement interdits — rejet dur, pas de zone grise
-- ============================================================
create table public.prohibited_keywords (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  category text not null check (category in (
    'medicament', 'drogue', 'arme', 'espece_protegee', 'contrefacon',
    'bien_vole', 'faux_document', 'mineur', 'produit_financier_illegal'
  )),
  created_at timestamptz not null default now()
);

-- Liste de base — volontairement non exhaustive, à compléter par la
-- modération au fil de l'eau (table éditable par un futur outil admin,
-- pas figée dans le code). Termes génériques en français et anglais.
insert into public.prohibited_keywords (term, category) values
  ('cocaïne', 'drogue'), ('cocaine', 'drogue'),
  ('héroïne', 'drogue'), ('heroin', 'drogue'),
  ('cannabis', 'drogue'), ('marijuana', 'drogue'), ('weed', 'drogue'),
  ('méthamphétamine', 'drogue'), ('crystal meth', 'drogue'),
  ('tramadol', 'medicament'), ('opioïde', 'medicament'), ('opioid', 'medicament'),
  ('médicament sur ordonnance', 'medicament'), ('prescription drug', 'medicament'),
  ('pistolet', 'arme'), ('fusil', 'arme'), ('firearm', 'arme'), ('handgun', 'arme'),
  ('munitions', 'arme'), ('ammunition', 'arme'), ('explosif', 'arme'), ('explosive', 'arme'),
  ('ivoire', 'espece_protegee'), ('ivory', 'espece_protegee'),
  ('contrefaçon', 'contrefacon'), ('counterfeit', 'contrefacon'), ('réplique de marque', 'contrefacon'),
  ('faux passeport', 'faux_document'), ('fake passport', 'faux_document'),
  ('faux diplôme', 'faux_document'), ('fake diploma', 'faux_document')
on conflict (term) do nothing;

-- ---------- moderation_status + flag contenu adulte déclaré par le vendeur ----------
alter table public.products
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'pending_review', 'rejected')),
  add column if not exists is_age_restricted boolean not null default false;

comment on column public.products.is_age_restricted is
  'Déclaré par le vendeur à la publication (façon YouTube) - engage sa responsabilité (voir become_seller / certification légale). Ne dispense jamais du filtre prohibited_keywords : un produit interdit reste interdit même déclaré "adulte".';

-- ---------- trigger: rejet dur si un terme strictement interdit est détecté ----------
create or replace function public.moderate_product_content()
returns trigger language plpgsql as $$
declare
  v_match record;
  v_haystack text;
begin
  v_haystack := lower(coalesce(new.name, '') || ' ' || coalesce(new.description, '') || ' ' || coalesce(new.category, '') || ' ' || coalesce(new.subcategory, ''));

  select term, category into v_match
  from public.prohibited_keywords
  where v_haystack ~* ('(^|[^a-zà-ÿ])' || term || '([^a-zà-ÿ]|$)')
  limit 1;

  if v_match.term is not null then
    raise exception 'PROHIBITED_PRODUCT_CONTENT: %', v_match.category
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_moderate_product_content on public.products;
create trigger trg_moderate_product_content
  before insert or update of name, description, category, subcategory on public.products
  for each row execute function public.moderate_product_content();

-- ============================================================
-- 4. Certification légale vendeur (à l'inscription, engage sa responsabilité)
-- ============================================================
alter table public.shops
  add column if not exists legal_certification_accepted_at timestamptz,
  add column if not exists legal_certification_version text;

comment on column public.shops.legal_certification_accepted_at is
  'Horodatage de l''acceptation de la certification "je certifie que mes produits sont légaux et j''en suis seul responsable" - preuve en cas de contrôle, jamais réécrit après coup.';

create or replace function public.become_seller(p_shop_name text, p_category text, p_country text, p_phone text, p_legal_certification_accepted boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_slug text; v_shop_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if length(trim(p_shop_name)) < 3 then raise exception 'SHOP_NAME_TOO_SHORT'; end if;
  if p_legal_certification_accepted is not true then raise exception 'LEGAL_CERTIFICATION_REQUIRED'; end if;

  v_slug := lower(regexp_replace(trim(p_shop_name), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6);

  insert into public.shops (owner_id, name, slug, category, country_code, phone, legal_certification_accepted_at, legal_certification_version)
    values (v_uid, trim(p_shop_name), v_slug, p_category, p_country, p_phone, now(), 'v1')
    returning id into v_shop_id;

  insert into public.seller_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;

  insert into public.user_capabilities (user_id, capability, status, granted_at)
    values (v_uid, 'seller', 'active', now())
    on conflict (user_id, capability) do update set status = 'active', granted_at = now();

  return jsonb_build_object('shop_id', v_shop_id, 'slug', v_slug);
end;
$$;

grant execute on function public.become_seller(text, text, text, text, boolean) to authenticated;

-- ============================================================
-- 5. Signalement de produit (notice-and-takedown)
-- ============================================================
create table public.product_reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('produit_illegal', 'contrefacon', 'securite_mineur', 'autre')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

create index idx_product_reports_status on public.product_reports (status, created_at desc);

alter table public.product_reports enable row level security;
create policy "product_reports_insert_own" on public.product_reports
  for insert with check (reporter_id = auth.uid());
create policy "product_reports_select_own_or_admin" on public.product_reports
  for select using (reporter_id = auth.uid() or public.is_admin());
create policy "product_reports_admin_update" on public.product_reports
  for update using (public.is_admin()) with check (public.is_admin());

create or replace function public.report_product(p_product_id uuid, p_reason text, p_details text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_report_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.products where id = p_product_id) then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if p_reason not in ('produit_illegal', 'contrefacon', 'securite_mineur', 'autre') then
    raise exception 'INVALID_REPORT_REASON';
  end if;

  insert into public.product_reports (product_id, reporter_id, reason, details)
    values (p_product_id, v_uid, p_reason, p_details)
    returning id into v_report_id;

  -- Signalement "sécurité mineur" : passe le produit en revue immédiate,
  -- retiré de la visibilité publique le temps de la vérification -
  -- tolérance zéro, on ne laisse pas un signalement de cette gravité
  -- attendre une action manuelle avant de dépublier.
  if p_reason = 'securite_mineur' then
    update public.products set moderation_status = 'pending_review' where id = p_product_id;
  end if;

  return v_report_id;
end;
$$;

grant execute on function public.report_product(uuid, text, text) to authenticated;

-- ---------- Les requêtes publiques n'affichent que les produits approuvés ----------
-- search_products / get_trending_products_capped / get_discovery_feed_page
-- filtraient déjà sur status = 'active' - on ajoute moderation_status =
-- 'approved' partout où products.status = 'active' apparaît, pour que
-- pending_review/rejected disparaissent immédiatement de la découverte
-- sans attendre un changement de `status`.
create or replace function public.search_products(
  p_query text,
  p_country text default null,
  p_category text default null,
  p_limit int default 20,
  p_offset int default 0
) returns setof public.products
language sql stable as $$
  select p.*
  from public.products p
  where p.status = 'active'
    and p.moderation_status = 'approved'
    and (p_country is null or p.country_code = p_country)
    and (p_category is null or p.category = p_category)
    and (
      p_query is null or p_query = ''
      or p.search_vector @@ plainto_tsquery('french', p_query)
      or p.name % p_query
    )
  order by
    case when p_query is null or p_query = '' then 0
         else ts_rank(p.search_vector, plainto_tsquery('french', p_query)) + similarity(p.name, coalesce(p_query, ''))
    end desc,
    public.get_active_boost_score(p.id) desc,
    p.views desc
  limit p_limit offset p_offset;
$$;

create or replace function public.get_trending_products_capped(
  p_country text,
  p_limit integer default 12,
  p_max_per_shop integer default 2
) returns setof public.products
language sql stable as $$
  select p.* from (
    select p.*,
      row_number() over (
        partition by p.shop_id
        order by p.views desc, public.get_active_boost_score(p.id) desc
      ) as rank_in_shop
    from public.products p
    where p.country_code = p_country and p.status = 'active' and p.moderation_status = 'approved'
  ) p
  where p.rank_in_shop <= p_max_per_shop
  order by public.get_active_boost_score(p.id) desc, p.views desc
  limit p_limit;
$$;

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
      and p.moderation_status = 'approved'
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
      and p.moderation_status = 'approved'
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
      and p.moderation_status = 'approved'
      and (p_category is null or p.category = p_category)
      and p.id not in (select id from used_ids)
    order by public.get_active_boost_score(p.id) desc, p.views desc
    offset v_recommended_n * p_page
    limit v_recommended_n
  )
  select * from followed_pool
  union all
  select * from new_pool
  union all
  select * from recommended_pool;
end;
$$;
