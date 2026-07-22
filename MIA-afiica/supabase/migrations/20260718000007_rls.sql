-- ============================================================
-- MIA Marketplace — Migration 007: Row Level Security
-- ============================================================
-- Every table gets RLS enabled. Default-deny: a table with RLS enabled
-- and no matching policy blocks the operation entirely, so anything not
-- explicitly allowed below is refused by Postgres itself - the same
-- posture as the Firestore rules this replaces.

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------- profiles ----------
alter table public.profiles enable row level security;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id and is_admin = false);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Public can read minimal profile info (name/avatar/country) of sellers
-- and creators for shop pages and social features, without exposing the
-- whole row (phone, exact location).
create view public.public_profiles as
  select id, full_name, avatar_url, country_code from public.profiles;
grant select on public.public_profiles to authenticated, anon;

-- ---------- user_capabilities ----------
alter table public.user_capabilities enable row level security;
create policy "capabilities_select_own_or_admin" on public.user_capabilities
  for select using (auth.uid() = user_id or public.is_admin());
-- No insert/update/delete policy: only SECURITY DEFINER RPCs (become_seller,
-- request_driver_capability, enable_creator_capability, approve_driver_capability)
-- can change capabilities, running as the postgres owner.

-- ---------- seller_profiles ----------
alter table public.seller_profiles enable row level security;
create policy "seller_profiles_public_select" on public.seller_profiles for select using (true);

-- ---------- delivery_profiles ----------
alter table public.delivery_profiles enable row level security;
create policy "delivery_profiles_select_own_or_admin" on public.delivery_profiles
  for select using (auth.uid() = user_id or public.is_admin());
create policy "delivery_profiles_update_own" on public.delivery_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- creator_profiles ----------
alter table public.creator_profiles enable row level security;
create policy "creator_profiles_public_select" on public.creator_profiles for select using (true);

-- ---------- wallet_profiles ----------
alter table public.wallet_profiles enable row level security;
create policy "wallet_profiles_select_own" on public.wallet_profiles
  for select using (auth.uid() = user_id or public.is_admin());

-- ---------- shops ----------
alter table public.shops enable row level security;
create policy "shops_public_select_active" on public.shops
  for select using (status = 'active' or owner_id = auth.uid() or public.is_admin());
create policy "shops_owner_update" on public.shops
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- No direct insert policy: shop creation goes through become_seller() so
-- seller_profiles/user_capabilities stay in sync with the shop row.

-- ---------- products ----------
alter table public.products enable row level security;
create policy "products_public_select_active" on public.products
  for select using (
    status = 'active'
    or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
    or public.is_admin()
  );
create policy "products_owner_insert" on public.products
  for insert with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));
create policy "products_owner_update" on public.products
  for update using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));
create policy "products_owner_delete" on public.products
  for delete using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

-- ---------- product_media ----------
alter table public.product_media enable row level security;
create policy "product_media_public_select" on public.product_media for select using (true);
create policy "product_media_owner_write" on public.product_media
  for all using (
    exists (select 1 from public.products p join public.shops s on s.id = p.shop_id
            where p.id = product_id and s.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.products p join public.shops s on s.id = p.shop_id
            where p.id = product_id and s.owner_id = auth.uid())
  );

-- ---------- orders ----------
alter table public.orders enable row level security;
create policy "orders_select_involved" on public.orders
  for select using (
    customer_id = auth.uid()
    or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.deliveries d where d.order_id = id and d.driver_id = auth.uid())
    or public.is_admin()
  );
create policy "orders_customer_insert" on public.orders
  for insert with check (customer_id = auth.uid() and status = 'pending' and total > 0);
create policy "orders_update_involved" on public.orders
  for update using (
    public.is_admin()
    or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
    or (customer_id = auth.uid() and status = 'pending')
  );

-- ---------- order_items ----------
alter table public.order_items enable row level security;
create policy "order_items_select_via_order" on public.order_items
  for select using (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.customer_id = auth.uid()
      or exists (select 1 from public.shops s where s.id = o.shop_id and s.owner_id = auth.uid())
      or public.is_admin()
    )
  ));
create policy "order_items_insert_via_pending_order" on public.order_items
  for insert with check (exists (
    select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid() and o.status = 'pending'
  ));

-- ---------- deliveries ----------
alter table public.deliveries enable row level security;
create policy "deliveries_select_involved" on public.deliveries
  for select using (
    driver_id = auth.uid()
    or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
    or exists (select 1 from public.orders o join public.shops s on s.id = o.shop_id
               where o.id = order_id and s.owner_id = auth.uid())
    or public.is_admin()
  );
create policy "deliveries_driver_update" on public.deliveries
  for update using (driver_id = auth.uid() or public.is_admin());

-- ---------- Wallet & money tables: select own only, no client writes ----------
alter table public.wallets enable row level security;
create policy "wallets_select_own" on public.wallets for select using (auth.uid() = user_id or public.is_admin());

alter table public.transactions enable row level security;
create policy "transactions_select_own" on public.transactions for select using (auth.uid() = user_id or public.is_admin());

alter table public.coin_balances enable row level security;
create policy "coin_balances_select_own" on public.coin_balances for select using (auth.uid() = user_id or public.is_admin());

alter table public.coin_transactions enable row level security;
create policy "coin_transactions_select_own" on public.coin_transactions for select using (auth.uid() = user_id or public.is_admin());

alter table public.gifts enable row level security;
create policy "gifts_select_involved" on public.gifts
  for select using (from_user_id = auth.uid() or vendor_id = auth.uid() or public.is_admin());

alter table public.product_boosts enable row level security;
create policy "product_boosts_public_select" on public.product_boosts for select using (true);

alter table public.transfers enable row level security;
create policy "transfers_select_involved" on public.transfers
  for select using (from_user_id = auth.uid() or to_user_id = auth.uid() or public.is_admin());

alter table public.payout_requests enable row level security;
create policy "payout_requests_select_own" on public.payout_requests for select using (auth.uid() = user_id or public.is_admin());

alter table public.referrals enable row level security;
create policy "referrals_select_involved" on public.referrals
  for select using (user_id = auth.uid() or referrer_id = auth.uid() or public.is_admin());

alter table public.country_wallet_availability enable row level security;
create policy "country_wallet_public_select" on public.country_wallet_availability for select using (true);
create policy "country_wallet_admin_write" on public.country_wallet_availability
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.platform_settings enable row level security;
create policy "platform_settings_public_select" on public.platform_settings for select using (true);
create policy "platform_settings_admin_write" on public.platform_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- ads ----------
alter table public.ads enable row level security;
create policy "ads_public_select_active" on public.ads for select using (status = 'active' or public.is_admin() or
  exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));
create policy "ads_owner_write" on public.ads
  for all using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

-- ---------- followers ----------
alter table public.followers enable row level security;
create policy "followers_public_select" on public.followers for select using (true);
create policy "followers_manage_own" on public.followers
  for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());

-- ---------- likes ----------
alter table public.likes enable row level security;
create policy "likes_public_select" on public.likes for select using (true);
create policy "likes_manage_own" on public.likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- reviews ----------
alter table public.reviews enable row level security;
create policy "reviews_public_select" on public.reviews for select using (true);
create policy "reviews_insert_if_purchased" on public.reviews
  for insert with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = auth.uid() and o.status = 'delivered'
    )
  );
create policy "reviews_update_own" on public.reviews
  for update using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- ---------- notifications ----------
alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- analytics ----------
alter table public.analytics enable row level security;
create policy "analytics_insert_any" on public.analytics for insert with check (true);
create policy "analytics_select_admin_only" on public.analytics for select using (public.is_admin());
