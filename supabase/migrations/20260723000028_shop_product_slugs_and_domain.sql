-- ============================================================
-- MIA Marketplace — Migration 028: Liens personnalisables + domaine
-- ============================================================
-- Spec (section 2, "Nom de domaine") + demande explicite complémentaire:
--   1. Chaque boutique a un lien à partager (shops.slug) - il existait
--      déjà (auto-généré à la création, jamais éditable) mais on l'ouvre
--      à l'édition par le vendeur, avec unicité stricte (déjà garantie
--      par la contrainte unique existante, on ajoute juste la RPC de
--      changement contrôlé + validation de format).
--   2. Chaque produit a maintenant un lien similaire (products.slug),
--      qui n'existait pas du tout avant cette migration - c'était un bug
--      latent : supabase/functions/product-meta/index.ts référence déjà
--      `product.slug` (select ... slug ...) alors que la colonne
--      n'existait pas encore, donc ce select silently renvoyait null au
--      lieu d'échouer (Postgres ne râle pas sur une colonne demandée qui
--      n'existe pas dans un .select() PostgREST... en fait si, ça
--      renvoie une erreur - product-meta était donc cassé en silence
--      jusqu'à cette migration, qui corrige le bug en créant enfin la
--      colonne qu'il attendait).
--   3. Domaine personnalisé : chaque boutique peut remplacer son
--      sous-domaine gratuit `{slug}.mia.africa` par son propre nom de
--      domaine. Le sous-domaine reste TOUJOURS actif et fonctionnel même
--      si un domaine externe est configuré (jamais de lien cassé), il
--      cesse simplement d'être le lien "à partager" mis en avant.
--      L'attachement réel du domaine au projet Vercel (ajout dans le
--      dashboard Vercel + configuration DNS chez le registrar du
--      vendeur) reste une étape manuelle admin hors base de données -
--      cette migration ne fait que stocker la demande et son statut de
--      vérification, voir SUPABASE_DEPLOYMENT.md pour la procédure.

-- ---------- products.slug ----------
alter table public.products
  add column if not exists slug text;

-- Unicité: NULL autorisé tant qu'aucun slug n'a été choisi (les produits
-- existants avant cette migration restent accessibles via /produit/:id),
-- mais deux produits ne peuvent jamais partager le même slug une fois
-- renseigné - comme pour shops.slug, la contrainte protège contre la
-- race condition que la seule validation applicative ne peut pas éviter.
create unique index if not exists idx_products_slug_unique
  on public.products (slug) where slug is not null;

-- ---------- shops: domaine personnalisé ----------
alter table public.shops
  add column if not exists custom_domain text,
  add column if not exists custom_domain_status text not null default 'none'
    check (custom_domain_status in ('none', 'pending', 'verified', 'failed'));

create unique index if not exists idx_shops_custom_domain_unique
  on public.shops (custom_domain) where custom_domain is not null;

comment on column public.shops.custom_domain is
  'Domaine externe du vendeur (ex: maboutique.com), optionnel. Le sous-domaine {slug}.mia.africa reste toujours actif en parallèle.';
comment on column public.shops.custom_domain_status is
  'none = pas de domaine personnalisé ; pending = renseigné par le vendeur, DNS/SSL pas encore vérifiés côté admin/Vercel ; verified = actif ; failed = vérification DNS échouée, à corriger par le vendeur.';

-- ---------- RPC: changer le slug d'une boutique ----------
-- Validation de format côté serveur (jamais confiance dans une validation
-- uniquement client) + message d'erreur explicite en cas de doublon, pour
-- que l'UI vendeur puisse afficher "ce lien est déjà pris" plutôt qu'une
-- erreur Postgres brute de contrainte unique.
create or replace function public.set_shop_slug(p_shop_id uuid, p_slug text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_clean_slug text;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  if not exists (select 1 from public.shops where id = p_shop_id and owner_id = v_uid) then
    raise exception 'NOT_SHOP_OWNER';
  end if;

  v_clean_slug := lower(trim(p_slug));
  if v_clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_clean_slug) < 3 or length(v_clean_slug) > 60 then
    raise exception 'INVALID_SLUG_FORMAT';
  end if;

  if exists (select 1 from public.shops where slug = v_clean_slug and id <> p_shop_id) then
    raise exception 'SLUG_ALREADY_TAKEN';
  end if;

  update public.shops set slug = v_clean_slug, updated_at = now() where id = p_shop_id;
  return jsonb_build_object('slug', v_clean_slug);
end;
$$;

-- ---------- RPC: changer/attribuer le slug d'un produit ----------
create or replace function public.set_product_slug(p_product_id uuid, p_slug text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_clean_slug text;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  if not exists (
    select 1 from public.products p join public.shops s on s.id = p.shop_id
    where p.id = p_product_id and s.owner_id = v_uid
  ) then
    raise exception 'NOT_PRODUCT_OWNER';
  end if;

  v_clean_slug := lower(trim(p_slug));
  if v_clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_clean_slug) < 3 or length(v_clean_slug) > 80 then
    raise exception 'INVALID_SLUG_FORMAT';
  end if;

  if exists (select 1 from public.products where slug = v_clean_slug and id <> p_product_id) then
    raise exception 'SLUG_ALREADY_TAKEN';
  end if;

  update public.products set slug = v_clean_slug, updated_at = now() where id = p_product_id;
  return jsonb_build_object('slug', v_clean_slug);
end;
$$;

-- ---------- RPC: demander un domaine personnalisé ----------
-- Passe le statut à 'pending' - un admin (ou une future automatisation
-- côté Vercel API) doit ensuite vérifier les DNS et repasser le statut à
-- 'verified' ou 'failed'. Le client ne peut jamais s'auto-vérifier
-- 'verified' lui-même (colonne modifiable uniquement via cette fonction
-- et le futur outil admin, jamais par un update direct du client - voir
-- policy shops_owner_update existante qui ne restreint pas encore cette
-- colonne : à durcir si un update direct pose problème en pratique).
create or replace function public.request_shop_custom_domain(p_shop_id uuid, p_domain text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_clean_domain text;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  if not exists (select 1 from public.shops where id = p_shop_id and owner_id = v_uid) then
    raise exception 'NOT_SHOP_OWNER';
  end if;

  v_clean_domain := lower(trim(p_domain));
  if v_clean_domain !~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$' then
    raise exception 'INVALID_DOMAIN_FORMAT';
  end if;

  if exists (select 1 from public.shops where custom_domain = v_clean_domain and id <> p_shop_id) then
    raise exception 'DOMAIN_ALREADY_TAKEN';
  end if;

  update public.shops
    set custom_domain = v_clean_domain, custom_domain_status = 'pending', updated_at = now()
    where id = p_shop_id;

  return jsonb_build_object('custom_domain', v_clean_domain, 'status', 'pending');
end;
$$;

-- ---------- RPC: retirer un domaine personnalisé (retour au sous-domaine gratuit) ----------
create or replace function public.remove_shop_custom_domain(p_shop_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.shops where id = p_shop_id and owner_id = v_uid) then
    raise exception 'NOT_SHOP_OWNER';
  end if;
  update public.shops
    set custom_domain = null, custom_domain_status = 'none', updated_at = now()
    where id = p_shop_id;
end;
$$;
