-- ============================================================
-- MIA Marketplace — Migration 004: Wallet, coins, referral, country gating
-- ============================================================
-- All balance mutations happen through SECURITY DEFINER functions in
-- migration 005_functions.sql, never through direct client INSERT/UPDATE
-- (enforced by RLS in migration 006). Postgres gives us real ACID
-- transactions here, so unlike the previous Firestore version there is
-- no need to split every function into a read-phase and a write-phase -
-- a PL/pgSQL function body already runs atomically.

-- ---------- country_wallet_availability ----------
-- Drives the "Wallet not available in your country yet" message. Never
-- hide the Wallet nav item/page - always show it, gate the content.
create table public.country_wallet_availability (
  country_code text primary key,
  wallet_enabled boolean not null default false,
  currency text not null default 'FCFA',
  payout_methods text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------- wallets ----------
create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric not null default 0 check (balance >= 0),
  currency text not null default 'FCFA',
  updated_at timestamptz not null default now()
);

-- ---------- transactions (wallet FCFA ledger) ----------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  type text not null check (type in (
    'recharge','purchase','vendor_payout_received','payout_requested',
    'payout_failed_refund','transfer_out','transfer_in','transfer_fee',
    'referral_cashback','coin_purchase','gift_received'
  )),
  amount numeric not null check (amount > 0),
  balance_after numeric,
  status text not null default 'completed' check (status in ('pending','completed','failed')),
  description text,
  related_id uuid,
  provider text,             -- 'moneroo' | 'chariow' | null (internal)
  provider_ref text,
  created_at timestamptz not null default now()
);
create index idx_transactions_user on public.transactions(user_id, created_at desc);
create index idx_transactions_provider_ref on public.transactions(provider, provider_ref);

-- ---------- coin_balances / coin_transactions ----------
create table public.coin_balances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins bigint not null default 0 check (coins >= 0),
  updated_at timestamptz not null default now()
);

create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  type text not null check (type in ('credit','debit')),
  amount bigint not null check (amount > 0),
  balance_after bigint,
  description text,
  related_id uuid,
  created_at timestamptz not null default now()
);
create index idx_coin_transactions_user on public.coin_transactions(user_id, created_at desc);

-- ---------- gifts ----------
create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id),
  shop_id uuid not null references public.shops(id),
  vendor_id uuid not null references public.profiles(id),
  product_id uuid references public.products(id),
  coin_amount bigint not null check (coin_amount > 0),
  cash_value numeric not null,
  created_at timestamptz not null default now()
);
create index idx_gifts_vendor on public.gifts(vendor_id, created_at desc);

-- ---------- product_boosts ----------
create table public.product_boosts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  user_id uuid not null references public.profiles(id),
  coin_amount bigint not null check (coin_amount > 0),
  boost_score int not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_boosts_product on public.product_boosts(product_id, expires_at desc);

-- ---------- transfers ----------
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id),
  to_user_id uuid not null references public.profiles(id),
  amount numeric not null check (amount > 0),
  fee numeric not null default 0,
  status text not null default 'completed' check (status in ('completed','failed')),
  created_at timestamptz not null default now()
);
create index idx_transfers_from on public.transfers(from_user_id, created_at desc);
create index idx_transfers_to on public.transfers(to_user_id, created_at desc);

-- ---------- payout_requests ----------
create table public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  amount numeric not null check (amount > 0),
  method text not null,
  recipient jsonb,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  provider_ref text,
  error text,
  created_at timestamptz not null default now()
);
create index idx_payouts_user on public.payout_requests(user_id, created_at desc);

-- ---------- referrals ----------
-- 2-level affiliate model only - see fn_distribute_referral_cashback in
-- migration 005. user_id is PK: one referrer per account, set once.
create table public.referrals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  referrer_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint no_self_referral check (user_id <> referrer_id)
);
create index idx_referrals_referrer on public.referrals(referrer_id);
