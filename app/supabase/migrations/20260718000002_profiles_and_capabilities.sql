-- ============================================================
-- MIA Marketplace — Migration 002: Profiles & Capability system
-- ============================================================
-- Replaces the old single `role` field (user/vendor/driver/admin) with
-- a capability system: one MIA account can hold several capabilities at
-- once (buyer + creator + seller, for example), matching the product
-- vision of "one identity, many roles" instead of picking one box.

-- ---------- profiles ----------
-- One row per auth.users row (created automatically by the trigger at
-- the bottom of this file). Country is never chosen by the user in a
-- dropdown - it is detected (IP / phone prefix / GPS) and stored here,
-- see country_source.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text unique,
  full_name text,
  avatar_url text,
  country_code text,                         -- ISO 3166-1 alpha-2, e.g. 'TG'
  country_source text check (country_source in ('ip','phone','gps','manual','default')),
  currency text default 'FCFA',
  language text default 'fr',
  location geography(Point, 4326),           -- last known GPS position, nullable
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_country on public.profiles(country_code);
create index idx_profiles_location on public.profiles using gist(location);

-- ---------- user_capabilities ----------
-- The core of the new model. 'buyer' is granted automatically at signup.
-- 'creator' is self-serve (posting content shouldn't need approval).
-- 'seller' is self-serve today (matches the existing become-vendor UX),
-- but modeled with a status column so moderation can be turned on later
-- without a schema change. 'driver' requires approval (status starts
-- 'pending') since it involves handling other people's cash/goods.
-- 'wallet' capability existing does NOT mean the wallet UI is available -
-- that also depends on country_wallet_availability (migration 003).
create table public.user_capabilities (
  user_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null check (capability in ('buyer','creator','seller','driver','wallet')),
  status text not null default 'active' check (status in ('active','pending','suspended','rejected')),
  requested_at timestamptz not null default now(),
  granted_at timestamptz,
  primary key (user_id, capability)
);
create index idx_capabilities_user on public.user_capabilities(user_id);
create index idx_capabilities_pending on public.user_capabilities(capability, status) where status = 'pending';

-- ---------- seller_profiles ----------
-- Account-level seller identity (a seller can own several shops - see
-- shops.owner_id in migration 003). seller_score aggregates trust signals
-- (successful orders, reviews, disputes) - never directly writable by the
-- client, only by trusted server-side scoring logic (a future job/RPC).
create table public.seller_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  seller_score int not null default 50 check (seller_score between 0 and 100),
  verified boolean not null default false,
  total_sales numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- delivery_profiles ----------
create table public.delivery_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type text check (vehicle_type in ('moto','velo','voiture','pied')),
  zone text,
  available boolean not null default false,
  rating numeric not null default 0,
  deliveries_count int not null default 0,
  documents_verified boolean not null default false,
  current_location geography(Point, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_delivery_location on public.delivery_profiles using gist(current_location);

-- ---------- creator_profiles ----------
create table public.creator_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bio text,
  followers_count int not null default 0,
  content_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- wallet_profiles ----------
-- Separate from the `wallets` balance table (migration 003) on purpose:
-- this row exists for every user (so the app can always answer "does this
-- account use the wallet system"), independent of whether they've ever
-- put money in it.
create table public.wallet_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  country_code text,
  created_at timestamptz not null default now()
);

-- ---------- auto-provisioning trigger ----------
-- Runs whenever Supabase Auth creates a new user (email/phone signup,
-- OAuth, etc). Creates the profile row + grants 'buyer' automatically +
-- seeds a wallet_profiles row, so the rest of the app never has to check
-- "does this user have a profile yet".
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone)
  values (new.id, new.email, new.phone)
  on conflict (id) do nothing;

  insert into public.user_capabilities (user_id, capability, status, granted_at)
  values (new.id, 'buyer', 'active', now())
  on conflict (user_id, capability) do nothing;

  insert into public.wallet_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
