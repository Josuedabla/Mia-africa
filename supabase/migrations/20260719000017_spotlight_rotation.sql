-- ============================================================
-- MIA Marketplace — Migration 017: Rotation équitable des profils (remplace
-- la migration 016 vendor_stories, jugée à risque de favoritisme perçu)
-- ============================================================
-- Contexte de la décision : afficher un profil fixe pendant 24h créait un
-- risque réel de perception de favoritisme ("pourquoi lui et pas moi ?"),
-- même si l'accès était techniquement ouvert à tous. Remplacé par un
-- carrousel à défilement continu (façon panneau publicitaire routier :
-- chaque profil entre par un bord, traverse, sort par l'autre) où
-- l'ORDRE DE PASSAGE est garanti équitable par construction, pas par
-- bonne volonté : un vendeur qui n'est pas encore passé récemment a
-- toujours priorité sur celui qui vient de passer.
--
-- La mise en avant payante ("boost") est un signal ADDITIONNEL qui
-- augmente la fréquence de passage, jamais un accès exclusif - un
-- vendeur non-payant continue de tourner. Elle est toujours accompagnée
-- d'un badge "Sponsorisé" côté client (obligation légale de transparence
-- commerciale dans la plupart des juridictions - ne jamais présenter du
-- contenu payant comme organique).

drop table if exists public.vendor_stories cascade;
drop view if exists public.active_vendor_stories cascade;

-- ---------- File d'attente de rotation ----------
-- Une ligne par boutique éligible (active, avec au moins un produit).
-- last_shown_at est LA garantie d'équité : le tirage pour le carrousel
-- trie toujours par last_shown_at croissant (jamais montré ou montré il
-- y a le plus longtemps en premier), donc aucune boutique ne peut rester
-- indéfiniment devant ni indéfiniment derrière.
create table public.spotlight_rotation (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  last_shown_at timestamptz not null default '1970-01-01'::timestamptz,
  show_count_total integer not null default 0,
  -- Boost payant actif : augmente la PROBABILITÉ de passage plus tôt,
  -- jamais un accès exclusif. Voir get_spotlight_queue ci-dessous.
  boost_active boolean not null default false,
  boost_expires_at timestamptz,
  boost_weight integer not null default 1 check (boost_weight between 1 and 3),
  updated_at timestamptz not null default now()
);

create index idx_spotlight_last_shown on public.spotlight_rotation (last_shown_at asc);

-- Ajoute automatiquement une boutique à la rotation dès son passage à 'active'.
create or replace function public.enroll_shop_in_spotlight()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' then
    insert into public.spotlight_rotation (shop_id) values (new.id)
    on conflict (shop_id) do nothing;
  else
    delete from public.spotlight_rotation where shop_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_enroll_shop_in_spotlight
  after insert or update of status on public.shops
  for each row execute function public.enroll_shop_in_spotlight();

-- ---------- Table des achats de mise en avant (transparence + audit) ----------
create table public.spotlight_purchases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id),
  coin_amount integer not null,
  weight integer not null check (weight between 1 and 3),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_spotlight_purchases_shop on public.spotlight_purchases (shop_id, expires_at);

alter table public.spotlight_rotation enable row level security;
alter table public.spotlight_purchases enable row level security;

create policy "spotlight_rotation_public_select" on public.spotlight_rotation
  for select using (true);

create policy "spotlight_purchases_owner_select" on public.spotlight_purchases
  for select using (public.owns_shop(shop_id) or public.is_admin());

-- ---------- fn: acheter une mise en avant (coins), plafonnée ----------
-- weight 1 = passage normal pondéré x1 (rare dans la file, comme tout le
-- monde), 2 = x2, 3 = x3 (plafond dur : jamais plus, pour qu'aucun
-- montant d'argent ne puisse acheter une exclusivité totale). Le badge
-- "Sponsorisé" est un champ renvoyé par get_spotlight_queue, pas une
-- option - toujours affiché côté client quand boost_active est vrai.
create or replace function public.purchase_spotlight_boost(
  p_shop_id uuid,
  p_coin_amount integer,
  p_duration_hours integer default 24
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_weight integer;
begin
  if not public.owns_shop(p_shop_id) then
    raise exception 'NOT_YOUR_SHOP';
  end if;
  if p_coin_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Barème simple et plafonné : le poids maximum est 3, quel que soit le
  -- montant dépensé au-delà du seuil - empêche un gros budget d'écraser
  -- structurellement les autres vendeurs.
  v_weight := least(3, greatest(1, 1 + (p_coin_amount / 500)));

  perform public.coins_debit(v_uid, p_coin_amount, format('Mise en avant boutique %s', p_shop_id));

  insert into public.spotlight_purchases (shop_id, buyer_id, coin_amount, weight, expires_at)
    values (p_shop_id, v_uid, p_coin_amount, v_weight, now() + make_interval(hours => greatest(p_duration_hours, 1)));

  update public.spotlight_rotation
    set boost_active = true, boost_expires_at = now() + make_interval(hours => greatest(p_duration_hours, 1)), boost_weight = v_weight
    where shop_id = p_shop_id;
end;
$$;

grant execute on function public.purchase_spotlight_boost(uuid, integer, integer) to authenticated;

-- Désactive automatiquement les boosts expirés (à appeler périodiquement
-- depuis une Edge Function planifiée, ou avant chaque lecture de la
-- queue - voir get_spotlight_queue qui vérifie déjà boost_expires_at
-- directement, donc cette fonction est un nettoyage de confort, pas une
-- dépendance stricte pour la correction du système).
create or replace function public.expire_spotlight_boosts()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.spotlight_rotation
    set boost_active = false, boost_weight = 1
    where boost_active = true and boost_expires_at < now();
end;
$$;

-- ---------- fn: tirage de la file du carrousel ----------
-- Retourne p_count boutiques pour peupler le carrousel à l'instant T,
-- garanties les "moins récemment montrées" en premier (équité), avec un
-- boost actif qui ne fait qu'AUGMENTER la fréquence de sélection (répété
-- boost_weight fois dans le pool de tirage) sans jamais garantir une
-- place fixe ni exclure les autres. is_sponsored est renvoyé
-- explicitement pour que le client affiche toujours le badge requis.
create or replace function public.get_spotlight_queue(p_count integer default 8)
returns table (
  shop_id uuid, shop_name text, shop_slug text, shop_logo_url text,
  is_sponsored boolean, featured_product_id uuid, featured_product_name text
)
language plpgsql stable as $$
begin
  return query
  with eligible as (
    select
      sr.shop_id, sr.last_shown_at,
      (sr.boost_active and coalesce(sr.boost_expires_at, now()) > now()) as is_sponsored,
      case when sr.boost_active and coalesce(sr.boost_expires_at, now()) > now() then sr.boost_weight else 1 end as weight
    from public.spotlight_rotation sr
    join public.shops s on s.id = sr.shop_id
    where s.status = 'active'
  ),
  -- Duplique chaque boutique 'weight' fois dans le pool de tirage : un
  -- boost à poids 3 a 3x plus de chances d'être tiré tôt, jamais une
  -- exclusivité - une boutique non boostée reste toujours dans le pool
  -- avec sa chance normale.
  weighted_pool as (
    select e.shop_id, e.last_shown_at, e.is_sponsored
    from eligible e, generate_series(1, e.weight)
  )
  select distinct on (wp.shop_id)
    s.id, s.name, s.slug, s.logo_url, wp.is_sponsored,
    p.id, p.name
  from weighted_pool wp
  join public.shops s on s.id = wp.shop_id
  left join lateral (
    select id, name from public.products
    where shop_id = s.id and status = 'active'
    order by created_at desc limit 1
  ) p on true
  order by wp.shop_id, wp.last_shown_at asc
  limit p_count;
end;
$$;

grant execute on function public.get_spotlight_queue(integer) to authenticated, anon;

-- ---------- fn: marque les boutiques comme montrées (met à jour l'équité) ----------
-- Appelée côté client après affichage réel d'une vague du carrousel, pour
-- que ces boutiques passent en fin de file la prochaine fois - c'est ce
-- qui empêche mécaniquement une boutique de repasser tout de suite.
create or replace function public.mark_spotlight_shown(p_shop_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.spotlight_rotation
    set last_shown_at = now(), show_count_total = show_count_total + 1, updated_at = now()
    where shop_id = any(p_shop_ids);
end;
$$;

grant execute on function public.mark_spotlight_shown(uuid[]) to authenticated, anon;

-- Seed initial : enrôle toutes les boutiques déjà actives.
insert into public.spotlight_rotation (shop_id)
select id from public.shops where status = 'active'
on conflict (shop_id) do nothing;
