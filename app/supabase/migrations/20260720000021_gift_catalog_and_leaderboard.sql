-- ============================================================
-- MIA Marketplace — Migration 021: Catalogue de cadeaux & classement public
-- ============================================================
-- "Les dons doivent être des cœurs, fleurs, logo MIA, diamant (le plus
-- cher, +2000 pièces)... on achète un cadeau et on l'envoie comme TikTok
-- avec les pièces disponibles. Leur nom s'affichera dans les
-- donateurs/boosteurs, l'ego va les pousser à dépenser."
--
-- Remplace send_gift (migration 0008 dans une version antérieure de ce
-- projet, absente ici) par un vrai catalogue d'objets-cadeaux nommés,
-- chacun avec sa propre icône et son propre prix - pas un simple
-- virement de pièces brutes.

create table public.gift_catalog (
  id text primary key, -- slug stable: 'heart', 'flower', 'mia_logo', 'diamond'
  name text not null,
  emoji text not null,
  coin_price integer not null check (coin_price > 0),
  display_order integer not null default 0,
  is_active boolean not null default true
);

insert into public.gift_catalog (id, name, emoji, coin_price, display_order) values
  ('heart', 'Cœur', '❤️', 5, 1),
  ('flower', 'Fleur', '🌸', 15, 2),
  ('star', 'Étoile', '⭐', 30, 3),
  ('mia_logo', 'Logo MIA', '💚', 100, 4),
  ('crown', 'Couronne', '👑', 500, 5),
  ('diamond', 'Diamant', '💎', 2000, 6);

alter table public.gift_catalog enable row level security;
create policy "gift_catalog_public_select" on public.gift_catalog for select using (is_active = true);

-- ---------- Cadeaux envoyés (remplace toute ancienne notion de "send_gift" en pièces brutes) ----------
-- L'ancienne send_gift(uuid, bigint, uuid) (migration 20260718000006)
-- envoyait un montant de pièces brut plutôt qu'un objet-cadeau nommé.
-- PostgreSQL autorise la surcharge par signature différente, donc sans
-- ce drop explicite les deux fonctions coexisteraient de façon confuse -
-- on retire l'ancienne avant de créer la nouvelle avec sa vraie signature.
drop function if exists public.send_gift(uuid, bigint, uuid);

create table public.gifts_sent (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id),
  shop_id uuid not null references public.shops(id) on delete cascade,
  gift_id text not null references public.gift_catalog(id),
  coin_amount integer not null,
  message text,
  created_at timestamptz not null default now()
);

create index idx_gifts_sent_shop on public.gifts_sent (shop_id, created_at desc);
create index idx_gifts_sent_from on public.gifts_sent (from_user_id);

alter table public.gifts_sent enable row level security;
create policy "gifts_sent_public_select" on public.gifts_sent for select using (true); -- visibilité publique nécessaire pour l'effet ego (classement)

create or replace function public.send_gift(
  p_from_user_id uuid,
  p_shop_id uuid,
  p_gift_id text,
  p_message text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_gift record;
  v_gift_sent_id uuid;
begin
  select * into v_gift from public.gift_catalog where id = p_gift_id and is_active = true;
  if v_gift is null then raise exception 'GIFT_NOT_FOUND'; end if;
  if not exists (select 1 from public.shops where id = p_shop_id and status = 'active') then
    raise exception 'SHOP_NOT_FOUND';
  end if;

  perform public.debit_coins(p_from_user_id, v_gift.coin_price, format('Cadeau envoyé: %s %s', v_gift.emoji, v_gift.name));

  insert into public.gifts_sent (from_user_id, shop_id, gift_id, coin_amount, message)
    values (p_from_user_id, p_shop_id, p_gift_id, v_gift.coin_price, p_message)
    returning id into v_gift_sent_id;

  -- Le vendeur REÇOIT les pièces (pas d'argent réel, cohérent avec le
  -- modèle money-in only) : il pourra les réutiliser pour ses propres
  -- boosts/badges/IA. C'est ce qui "boucle" le circuit interne de pièces.
  perform public.credit_coins(
    (select owner_id from public.shops where id = p_shop_id),
    v_gift.coin_price,
    format('Cadeau reçu: %s %s', v_gift.emoji, v_gift.name)
  );

  return v_gift_sent_id;
end;
$$;

grant execute on function public.send_gift(uuid, uuid, text, text) to authenticated;

-- ---------- Classement public des donateurs (effet ego, façon "top fans" TikTok) ----------
create or replace view public.shop_top_supporters as
select
  shop_id, from_user_id,
  p.display_name, p.username, p.avatar_url,
  sum(coin_amount) as total_coins_given,
  count(*) as gifts_count
from public.gifts_sent gs
join public.profiles p on p.id = gs.from_user_id
group by shop_id, from_user_id, p.display_name, p.username, p.avatar_url;

-- ---------- Classement public des boosteurs (produits/boutiques boostées, même logique ego) ----------
-- S'appuie sur spotlight_purchases déjà créée (migration 017) - on
-- expose juste le nom de l'acheteur publiquement, ce qui n'existait pas
-- encore (spotlight_purchases n'était visible que par le propriétaire).
create or replace view public.shop_top_boosters as
select
  shop_id, buyer_id,
  p.display_name, p.username, p.avatar_url,
  sum(coin_amount) as total_coins_spent,
  count(*) as boosts_count
from public.spotlight_purchases sp
join public.profiles p on p.id = sp.buyer_id
group by shop_id, buyer_id, p.display_name, p.username, p.avatar_url;
