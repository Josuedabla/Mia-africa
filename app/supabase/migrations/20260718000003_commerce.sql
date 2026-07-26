-- ============================================================
-- MIA Marketplace — Migration 003: Commerce schema
-- ============================================================

-- ---------- shops ----------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  category text not null,
  country_code text not null,
  location geography(Point, 4326),
  logo_url text,
  banner_url text,
  phone text,
  whatsapp_number text,
  status text not null default 'active' check (status in ('active','suspended')),
  rating numeric not null default 0,
  review_count int not null default 0,
  product_count int not null default 0,
  total_sales numeric not null default 0,
  seller_score int not null default 50 check (seller_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_shops_owner on public.shops(owner_id);
create index idx_shops_country on public.shops(country_code);
create index idx_shops_location on public.shops using gist(location);
create index idx_shops_name_trgm on public.shops using gin (name gin_trgm_ops);

-- Trigger: prevent clients from writing seller_score directly through a
-- normal UPDATE (e.g. PATCH from the shop settings page). Only functions
-- running as the service role (or explicitly SECURITY DEFINER scoring
-- RPCs, added later) may change it - mirrors the anti self-promotion
-- protection that existed on Firestore's users.role field.
create or replace function public.protect_seller_score()
returns trigger
language plpgsql
as $$
begin
  if new.seller_score is distinct from old.seller_score and auth.role() <> 'service_role' then
    new.seller_score := old.seller_score;
  end if;
  return new;
end;
$$;
create trigger trg_protect_seller_score
  before update on public.shops
  for each row execute function public.protect_seller_score();

-- ---------- products ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  description text,                 -- sanitized HTML, same rules as before (client + edge function sanitization)
  category text not null,
  subcategory text,
  price numeric not null check (price > 0),
  original_price numeric,
  currency text not null default 'FCFA',
  stock int not null default 0,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  country_code text not null,
  seo_title text,
  seo_description text,
  keywords text[] not null default '{}',
  tags text[] not null default '{}',
  is_trending boolean not null default false,
  is_new boolean not null default true,
  is_boosted boolean not null default false,
  ai_generated boolean not null default false,
  quality_score int,
  rating numeric not null default 0,
  review_count int not null default 0,
  views int not null default 0,
  likes_count int not null default 0,
  sales_count int not null default 0,
  embedding vector(768),             -- reserved for future semantic search (product embeddings)
  search_vector tsvector generated always as (
    setweight(to_tsvector('french', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_products_shop on public.products(shop_id);
create index idx_products_country_status on public.products(country_code, status);
create index idx_products_category on public.products(category, country_code, status);
create index idx_products_search on public.products using gin(search_vector);
create index idx_products_name_trgm on public.products using gin (name gin_trgm_ops);
create index idx_products_trending on public.products(country_code, status, is_trending, views desc);

-- Keep shops.product_count roughly in sync automatically.
create or replace function public.sync_shop_product_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.shops set product_count = product_count + 1, updated_at = now() where id = new.shop_id;
  elsif tg_op = 'DELETE' then
    update public.shops set product_count = greatest(product_count - 1, 0), updated_at = now() where id = old.shop_id;
  end if;
  return null;
end;
$$;
create trigger trg_sync_shop_product_count
  after insert or delete on public.products
  for each row execute function public.sync_shop_product_count();

-- ---------- product_media ----------
create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_type text not null default 'image' check (media_type in ('image','video')),
  url text not null,
  position int not null default 0,
  width int,
  height int,
  created_at timestamptz not null default now()
);
create index idx_product_media_product on public.product_media(product_id, position);

-- ---------- orders ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  shop_id uuid not null references public.shops(id),
  status text not null default 'pending' check (status in ('pending','paid','shipped','delivered','cancelled')),
  payment_method text check (payment_method in ('wallet','moneroo','chariow','cash_on_delivery')),
  total numeric not null check (total > 0),
  commission_amount numeric,
  vendor_share numeric,
  currency text not null default 'FCFA',
  delivery_address text,
  delivery_location geography(Point, 4326),
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_orders_customer on public.orders(customer_id, created_at desc);
create index idx_orders_shop on public.orders(shop_id, created_at desc);
create index idx_orders_status on public.orders(status);

-- ---------- order_items ----------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity int not null check (quantity > 0),
  unit_price numeric not null,
  subtotal numeric not null
);
create index idx_order_items_order on public.order_items(order_id);

-- ---------- deliveries ----------
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  driver_id uuid references public.profiles(id),
  status text not null default 'searching' check (status in ('searching','assigned','picked_up','delivered','failed')),
  pickup_location geography(Point, 4326),
  dropoff_location geography(Point, 4326),
  distance_km numeric,
  otp_code text,
  proof_photo_url text,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_deliveries_driver on public.deliveries(driver_id);
create index idx_deliveries_status on public.deliveries(status);
create index idx_deliveries_pickup on public.deliveries using gist(pickup_location);
