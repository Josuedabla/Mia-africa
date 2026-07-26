-- ============================================================
-- MIA Marketplace — Migration 005: Social commerce schema
-- ============================================================

-- ---------- ads (MIA Ads - coin-funded product/shop promotion) ----------
create table public.ads (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid references public.products(id),
  budget_coins bigint not null check (budget_coins > 0),
  spent_coins bigint not null default 0,
  status text not null default 'active' check (status in ('active','paused','completed')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_ads_shop on public.ads(shop_id);
create index idx_ads_active on public.ads(status) where status = 'active';

-- ---------- followers ----------
-- Polymorphic-lite: a follow targets either a user (creator) or a shop,
-- never both - enforced by the check constraint below.
create table public.followers (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_user_id uuid references public.profiles(id) on delete cascade,
  followed_shop_id uuid references public.shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint one_target check (
    (followed_user_id is not null and followed_shop_id is null) or
    (followed_user_id is null and followed_shop_id is not null)
  ),
  constraint no_self_follow check (follower_id <> followed_user_id)
);
create unique index uq_follow_user on public.followers(follower_id, followed_user_id) where followed_user_id is not null;
create unique index uq_follow_shop on public.followers(follower_id, followed_shop_id) where followed_shop_id is not null;
create index idx_followers_followed_user on public.followers(followed_user_id);
create index idx_followers_followed_shop on public.followers(followed_shop_id);

-- ---------- likes ----------
create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index idx_likes_product on public.likes(product_id);

create or replace function public.sync_product_likes_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.products set likes_count = likes_count + 1 where id = new.product_id;
  elsif tg_op = 'DELETE' then
    update public.products set likes_count = greatest(likes_count - 1, 0) where id = old.product_id;
  end if;
  return null;
end;
$$;
create trigger trg_sync_product_likes
  after insert or delete on public.likes
  for each row execute function public.sync_product_likes_count();

-- ---------- reviews ----------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id),
  customer_id uuid not null references public.profiles(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (order_id, product_id)   -- one review per purchased item
);
create index idx_reviews_product on public.reviews(product_id);

create or replace function public.sync_product_rating()
returns trigger
language plpgsql
as $$
begin
  update public.products p
  set rating = coalesce((select avg(rating) from public.reviews where product_id = p.id), 0),
      review_count = (select count(*) from public.reviews where product_id = p.id)
  where p.id = coalesce(new.product_id, old.product_id);
  return null;
end;
$$;
create trigger trg_sync_product_rating
  after insert or update or delete on public.reviews
  for each row execute function public.sync_product_rating();

-- ---------- notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on public.notifications(user_id, read, created_at desc);

-- ---------- analytics ----------
-- High-volume event log (product views, search queries, boost clicks...).
-- bigserial instead of uuid: cheaper to index at scale, and ordering by
-- id is naturally chronological for this append-only table.
create table public.analytics (
  id bigserial primary key,
  user_id uuid references public.profiles(id),
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}',
  country_code text,
  created_at timestamptz not null default now()
);
create index idx_analytics_event on public.analytics(event_type, created_at desc);
create index idx_analytics_entity on public.analytics(entity_type, entity_id);
