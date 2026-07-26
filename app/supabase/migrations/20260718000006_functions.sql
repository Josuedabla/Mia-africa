-- ============================================================
-- MIA Marketplace — Migration 006: Business logic functions (RPCs)
-- ============================================================
-- Everything that touches money or capabilities lives here as
-- SECURITY DEFINER PL/pgSQL functions. Unlike the previous Firestore
-- Cloud Functions version, a function body here runs as a single
-- Postgres transaction automatically - no manual read-phase/write-phase
-- split is needed to avoid race conditions; row locks (`for update`) are
-- enough to prevent double-spends.
--
-- Grants are managed explicitly at the bottom of this file:
--  - functions meant to be called BY users (via the client SDK / PostgREST
--    RPC) are granted to `authenticated`.
--  - functions meant to be called only by trusted server code (Edge
--    Functions using the service role key, e.g. after verifying a
--    payment webhook signature) are granted to `service_role` only.

-- ---------- platform_settings ----------
-- Single place to tune every percentage without a redeploy (addresses a
-- gap from the Firebase version, where rates were hardcoded constants).
create table public.platform_settings (
  key text primary key,
  value numeric not null,
  description text
);
insert into public.platform_settings (key, value, description) values
  ('platform_commission_rate', 0.08, 'MIA cut on a vendor sale (0.08 = 8%)'),
  ('referral_level1_rate', 0.03, 'Cashback rate for a direct referrer'),
  ('referral_level2_rate', 0.01, 'Cashback rate for a level-2 referrer'),
  ('coin_purchase_rate_fcfa', 10, '1 coin costs this many FCFA to buy'),
  ('coin_gift_payout_rate_fcfa', 5, 'FCFA credited to recipient per coin gifted'),
  ('transfer_fee_rate', 0.01, 'Wallet-to-wallet transfer fee (0.01 = 1%)'),
  ('transfer_fee_min_fcfa', 25, 'Minimum transfer fee in FCFA'),
  ('min_payout_fcfa', 1000, 'Minimum cash-out amount in FCFA');

create or replace function public.get_setting(p_key text)
returns numeric language sql stable as $$
  select value from public.platform_settings where key = p_key;
$$;

-- ============================================================
-- Wallet ledger primitives
-- ============================================================

create or replace function public.credit_wallet(
  p_user_id uuid, p_amount numeric, p_type text, p_description text,
  p_related_id uuid default null, p_provider text default null, p_provider_ref text default null
) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_new_balance numeric;
begin
  if p_amount <= 0 then raise exception 'Credit amount must be positive'; end if;

  insert into public.wallets (user_id, balance) values (p_user_id, 0)
    on conflict (user_id) do nothing;

  update public.wallets set balance = balance + p_amount, updated_at = now()
    where user_id = p_user_id
    returning balance into v_new_balance;

  insert into public.transactions (user_id, type, amount, balance_after, description, related_id, provider, provider_ref)
    values (p_user_id, p_type, p_amount, v_new_balance, p_description, p_related_id, p_provider, p_provider_ref);

  return v_new_balance;
end;
$$;

create or replace function public.debit_wallet(
  p_user_id uuid, p_amount numeric, p_type text, p_description text, p_related_id uuid default null
) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_current numeric; v_new_balance numeric;
begin
  if p_amount <= 0 then raise exception 'Debit amount must be positive'; end if;

  select balance into v_current from public.wallets where user_id = p_user_id for update;
  if v_current is null then v_current := 0; end if;
  if v_current < p_amount then
    raise exception 'INSUFFICIENT_FUNDS' using errcode = 'P0001';
  end if;

  insert into public.wallets (user_id, balance) values (p_user_id, -p_amount)
    on conflict (user_id) do update set balance = wallets.balance - p_amount, updated_at = now()
    returning balance into v_new_balance;

  insert into public.transactions (user_id, type, amount, balance_after, description, related_id)
    values (p_user_id, p_type, p_amount, v_new_balance, p_description, p_related_id);

  return v_new_balance;
end;
$$;

create or replace function public.credit_coins(p_user_id uuid, p_amount bigint, p_description text, p_related_id uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_new_balance bigint;
begin
  if p_amount <= 0 then raise exception 'Coin credit must be positive'; end if;
  insert into public.coin_balances (user_id, coins) values (p_user_id, p_amount)
    on conflict (user_id) do update set coins = coin_balances.coins + p_amount, updated_at = now()
    returning coins into v_new_balance;
  insert into public.coin_transactions (user_id, type, amount, balance_after, description, related_id)
    values (p_user_id, 'credit', p_amount, v_new_balance, p_description, p_related_id);
  return v_new_balance;
end;
$$;

create or replace function public.debit_coins(p_user_id uuid, p_amount bigint, p_description text, p_related_id uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_current bigint; v_new_balance bigint;
begin
  if p_amount <= 0 then raise exception 'Coin debit must be positive'; end if;
  select coins into v_current from public.coin_balances where user_id = p_user_id for update;
  if v_current is null then v_current := 0; end if;
  if v_current < p_amount then
    raise exception 'INSUFFICIENT_COINS' using errcode = 'P0001';
  end if;
  insert into public.coin_balances (user_id, coins) values (p_user_id, -p_amount)
    on conflict (user_id) do update set coins = coin_balances.coins - p_amount, updated_at = now()
    returning coins into v_new_balance;
  insert into public.coin_transactions (user_id, type, amount, balance_after, description, related_id)
    values (p_user_id, 'debit', p_amount, v_new_balance, p_description, p_related_id);
  return v_new_balance;
end;
$$;

-- ============================================================
-- Referral cashback (2-level, real-purchase-triggered only)
-- ============================================================

create or replace function public.distribute_referral_cashback(p_buyer_id uuid, p_order_id uuid, p_order_total numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_level1 uuid;
  v_level2 uuid;
  v_rate1 numeric := public.get_setting('referral_level1_rate');
  v_rate2 numeric := public.get_setting('referral_level2_rate');
  v_amount numeric;
begin
  select referrer_id into v_level1 from public.referrals where user_id = p_buyer_id;
  if v_level1 is null then return; end if;

  v_amount := round(p_order_total * v_rate1);
  if v_amount > 0 then
    perform public.credit_wallet(v_level1, v_amount, 'referral_cashback',
      'Cashback parrainage niveau 1 (commande ' || left(p_order_id::text, 8) || ')', p_order_id);
  end if;

  select referrer_id into v_level2 from public.referrals where user_id = v_level1;
  if v_level2 is not null and v_level2 <> p_buyer_id then
    v_amount := round(p_order_total * v_rate2);
    if v_amount > 0 then
      perform public.credit_wallet(v_level2, v_amount, 'referral_cashback',
        'Cashback parrainage niveau 2 (commande ' || left(p_order_id::text, 8) || ')', p_order_id);
    end if;
  end if;
end;
$$;

create or replace function public.apply_referral_code(p_referrer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_referrer_id = v_uid then raise exception 'CANNOT_REFER_SELF'; end if;
  if not exists (select 1 from public.profiles where id = p_referrer_id) then
    raise exception 'REFERRER_NOT_FOUND';
  end if;
  insert into public.referrals (user_id, referrer_id) values (v_uid, p_referrer_id);
exception when unique_violation then
  raise exception 'REFERRAL_ALREADY_APPLIED';
end;
$$;

-- ============================================================
-- Order settlement (shared by wallet purchase + payment webhooks)
-- ============================================================

create or replace function public.settle_order_payment(p_order_id uuid, p_payment_method text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order record;
  v_vendor_id uuid;
  v_commission numeric;
  v_vendor_share numeric;
  v_rate numeric := public.get_setting('platform_commission_rate');
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'pending' then
    return; -- already settled (idempotent - safe for webhook retries)
  end if;

  select owner_id into v_vendor_id from public.shops where id = v_order.shop_id;
  v_commission := round(v_order.total * v_rate);
  v_vendor_share := v_order.total - v_commission;

  if p_payment_method <> 'cash_on_delivery' then
    perform public.credit_wallet(v_vendor_id, v_vendor_share, 'vendor_payout_received',
      'Vente commande ' || left(p_order_id::text, 8) || ' (commission MIA ' || round(v_rate * 100) || '%)', p_order_id);
    perform public.distribute_referral_cashback(v_order.customer_id, p_order_id, v_order.total);
  end if;

  update public.orders
    set status = 'paid', payment_method = p_payment_method,
        commission_amount = v_commission, vendor_share = v_vendor_share,
        paid_at = now(), updated_at = now()
    where id = p_order_id;

  update public.shops set total_sales = total_sales + v_order.total where id = v_order.shop_id;
end;
$$;

create or replace function public.purchase_with_wallet(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_order record;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.customer_id <> v_uid then raise exception 'NOT_YOUR_ORDER'; end if;
  if v_order.status <> 'pending' then raise exception 'ORDER_ALREADY_PROCESSED'; end if;

  perform public.debit_wallet(v_uid, v_order.total, 'purchase',
    'Achat commande ' || left(p_order_id::text, 8), p_order_id);
  perform public.settle_order_payment(p_order_id, 'wallet');
end;
$$;

-- ============================================================
-- Recharge / payout confirmation (called by Edge Functions after
-- verifying the Moneroo/Chariow webhook signature - service_role only)
-- ============================================================

create or replace function public.confirm_wallet_recharge(p_user_id uuid, p_amount numeric, p_provider text, p_provider_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Idempotency: if this provider_ref was already processed, do nothing
  -- (Moneroo/Chariow may retry a webhook up to 3 times).
  if exists (select 1 from public.transactions where provider = p_provider and provider_ref = p_provider_ref) then
    return;
  end if;
  perform public.credit_wallet(p_user_id, p_amount, 'recharge', 'Recharge du portefeuille MIA confirmée', null, p_provider, p_provider_ref);
end;
$$;

create or replace function public.confirm_order_payment_webhook(p_order_id uuid, p_payment_method text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.settle_order_payment(p_order_id, p_payment_method);
end;
$$;

create or replace function public.confirm_payout(p_payout_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.payout_requests set status = 'completed' where id = p_payout_id and status = 'processing';
end;
$$;

create or replace function public.fail_payout(p_payout_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_payout record;
begin
  select * into v_payout from public.payout_requests where id = p_payout_id and status = 'processing' for update;
  if v_payout is null then return; end if;
  perform public.credit_wallet(v_payout.user_id, v_payout.amount, 'payout_failed_refund', 'Échec du retrait - remboursement', p_payout_id);
  update public.payout_requests set status = 'failed' where id = p_payout_id;
end;
$$;

-- ============================================================
-- User-facing wallet actions
-- ============================================================

create or replace function public.request_payout(p_amount numeric, p_method text, p_recipient jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_min numeric := public.get_setting('min_payout_fcfa'); v_payout_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_amount < v_min then raise exception 'AMOUNT_BELOW_MINIMUM'; end if;

  perform public.debit_wallet(v_uid, p_amount, 'payout_requested', 'Demande de retrait', null);
  insert into public.payout_requests (user_id, amount, method, recipient)
    values (v_uid, p_amount, p_method, p_recipient)
    returning id into v_payout_id;

  update public.transactions set related_id = v_payout_id
    where user_id = v_uid and type = 'payout_requested' and related_id is null and created_at > now() - interval '5 seconds';

  return v_payout_id;
end;
$$;

create or replace function public.transfer_to_user(p_to_user_id uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_rate numeric := public.get_setting('transfer_fee_rate');
  v_min_fee numeric := public.get_setting('transfer_fee_min_fcfa');
  v_fee numeric;
  v_transfer_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_to_user_id = v_uid then raise exception 'CANNOT_TRANSFER_TO_SELF'; end if;
  if not exists (select 1 from public.profiles where id = p_to_user_id) then
    raise exception 'RECIPIENT_NOT_FOUND';
  end if;

  v_fee := greatest(round(p_amount * v_rate), v_min_fee);

  perform public.debit_wallet(v_uid, p_amount + v_fee, 'transfer_out', 'Transfert à un utilisateur MIA', null);
  perform public.credit_wallet(p_to_user_id, p_amount, 'transfer_in', 'Transfert reçu', null);

  insert into public.transfers (from_user_id, to_user_id, amount, fee)
    values (v_uid, p_to_user_id, p_amount, v_fee)
    returning id into v_transfer_id;

  return jsonb_build_object('transfer_id', v_transfer_id, 'fee', v_fee);
end;
$$;

create or replace function public.transfer_to_phone(p_phone text, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_to_user uuid;
begin
  select id into v_to_user from public.profiles where phone = p_phone;
  if v_to_user is null then raise exception 'RECIPIENT_NOT_FOUND'; end if;
  return public.transfer_to_user(v_to_user, p_amount);
end;
$$;

-- ============================================================
-- Coins: purchase / gift / boost
-- ============================================================

create or replace function public.purchase_coins(p_coin_amount bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_rate numeric := public.get_setting('coin_purchase_rate_fcfa'); v_cost numeric;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_coin_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  v_cost := p_coin_amount * v_rate;
  perform public.debit_wallet(v_uid, v_cost, 'coin_purchase', 'Achat de ' || p_coin_amount || ' pièces MIA', null);
  perform public.credit_coins(v_uid, p_coin_amount, 'Achat de ' || p_coin_amount || ' pièces', null);
  return jsonb_build_object('coin_amount', p_coin_amount, 'cost', v_cost);
end;
$$;

create or replace function public.send_gift(p_shop_id uuid, p_coin_amount bigint, p_product_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_vendor_id uuid;
  v_shop_name text;
  v_payout_rate numeric := public.get_setting('coin_gift_payout_rate_fcfa');
  v_cash_value numeric;
  v_gift_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select owner_id, name into v_vendor_id, v_shop_name from public.shops where id = p_shop_id;
  if v_vendor_id is null then raise exception 'SHOP_NOT_FOUND'; end if;

  perform public.debit_coins(v_uid, p_coin_amount, 'Cadeau envoyé à ' || v_shop_name, null);
  v_cash_value := p_coin_amount * v_payout_rate;
  perform public.credit_wallet(v_vendor_id, v_cash_value, 'gift_received', 'Cadeau reçu (' || p_coin_amount || ' pièces)', null);

  insert into public.gifts (from_user_id, shop_id, vendor_id, product_id, coin_amount, cash_value)
    values (v_uid, p_shop_id, v_vendor_id, p_product_id, p_coin_amount, v_cash_value)
    returning id into v_gift_id;

  return v_gift_id;
end;
$$;

create or replace function public.boost_product(p_product_id uuid, p_coin_amount bigint, p_duration_hours int default 24)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_boost_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.products where id = p_product_id) then raise exception 'PRODUCT_NOT_FOUND'; end if;

  perform public.debit_coins(v_uid, p_coin_amount, 'Boost produit ' || p_product_id, null);

  insert into public.product_boosts (product_id, user_id, coin_amount, boost_score, expires_at)
    values (p_product_id, v_uid, p_coin_amount, p_coin_amount, now() + make_interval(hours => p_duration_hours))
    returning id into v_boost_id;

  update public.products set is_boosted = true where id = p_product_id;
  return v_boost_id;
end;
$$;

-- ============================================================
-- Capability requests
-- ============================================================

create or replace function public.become_seller(p_shop_name text, p_category text, p_country text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_slug text; v_shop_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if length(trim(p_shop_name)) < 3 then raise exception 'SHOP_NAME_TOO_SHORT'; end if;

  v_slug := lower(regexp_replace(trim(p_shop_name), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6);

  insert into public.shops (owner_id, name, slug, category, country_code, phone)
    values (v_uid, trim(p_shop_name), v_slug, p_category, p_country, p_phone)
    returning id into v_shop_id;

  insert into public.seller_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;

  insert into public.user_capabilities (user_id, capability, status, granted_at)
    values (v_uid, 'seller', 'active', now())
    on conflict (user_id, capability) do update set status = 'active', granted_at = now();

  return jsonb_build_object('shop_id', v_shop_id, 'slug', v_slug);
end;
$$;

create or replace function public.request_driver_capability(p_vehicle_type text, p_zone text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  insert into public.delivery_profiles (user_id, vehicle_type, zone, available)
    values (v_uid, p_vehicle_type, p_zone, false)
    on conflict (user_id) do update set vehicle_type = excluded.vehicle_type, zone = excluded.zone;

  insert into public.user_capabilities (user_id, capability, status)
    values (v_uid, 'driver', 'pending')
    on conflict (user_id, capability) do update set status = 'pending', requested_at = now();
end;
$$;

create or replace function public.approve_driver_capability(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'ADMIN_ONLY';
  end if;
  update public.user_capabilities set status = 'active', granted_at = now()
    where user_id = p_user_id and capability = 'driver';
end;
$$;

create or replace function public.enable_creator_capability()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  insert into public.creator_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;
  insert into public.user_capabilities (user_id, capability, status, granted_at)
    values (v_uid, 'creator', 'active', now())
    on conflict (user_id, capability) do update set status = 'active';
end;
$$;

-- ============================================================
-- Grants: lock down execute permissions per function
-- ============================================================
revoke execute on all functions in schema public from public;

-- User-callable (via supabase.rpc(...) with the anon/authenticated key):
grant execute on function
  public.apply_referral_code(uuid),
  public.purchase_with_wallet(uuid),
  public.request_payout(numeric, text, jsonb),
  public.transfer_to_user(uuid, numeric),
  public.transfer_to_phone(text, numeric),
  public.purchase_coins(bigint),
  public.send_gift(uuid, bigint, uuid),
  public.boost_product(uuid, bigint, int),
  public.become_seller(text, text, text, text),
  public.request_driver_capability(text, text),
  public.approve_driver_capability(uuid),
  public.enable_creator_capability(),
  public.get_setting(text)
to authenticated;

-- Server-only (Edge Functions using the service role key, after
-- verifying a payment webhook signature):
grant execute on function
  public.confirm_wallet_recharge(uuid, numeric, text, text),
  public.confirm_order_payment_webhook(uuid, text),
  public.confirm_payout(uuid),
  public.fail_payout(uuid),
  public.settle_order_payment(uuid, text),
  public.credit_wallet(uuid, numeric, text, text, uuid, text, text),
  public.debit_wallet(uuid, numeric, text, text, uuid),
  public.credit_coins(uuid, bigint, text, uuid),
  public.debit_coins(uuid, bigint, text, uuid)
to service_role;
