-- ============================================================
-- MIA Marketplace — Migration 009: Storage buckets & policies
-- ============================================================
-- Replaces Firebase Storage. Mirrors the ownership rules from the old
-- storage.rules file: public read, write restricted to the shop owner
-- (for products/shops) or the user themself (avatars/delivery proofs).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('products', 'products', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('shops', 'shops', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('delivery-proofs', 'delivery-proofs', false, 5242880, array['image/jpeg','image/png']);

-- products/{shopId}/... — public read, write only by the shop's owner.
-- Path convention: products/<shop_id>/<filename>
create policy "products_bucket_public_read" on storage.objects
  for select using (bucket_id = 'products');
create policy "products_bucket_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'products'
    and exists (select 1 from public.shops s where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid())
  );
create policy "products_bucket_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'products'
    and exists (select 1 from public.shops s where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid())
  );

-- shops/{shopId}/... — same ownership pattern, for logo/banner.
create policy "shops_bucket_public_read" on storage.objects
  for select using (bucket_id = 'shops');
create policy "shops_bucket_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'shops'
    and exists (select 1 from public.shops s where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid())
  );

-- avatars/{userId}/... — only the user themself.
create policy "avatars_bucket_public_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_bucket_owner_write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_bucket_owner_delete" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- delivery-proofs/{deliveryId}/... — private: only the assigned driver
-- and the order's customer/shop owner/admin can read; only the driver
-- can upload a proof photo for their own delivery.
create policy "delivery_proofs_involved_read" on storage.objects
  for select using (
    bucket_id = 'delivery-proofs'
    and exists (
      select 1 from public.deliveries d
      join public.orders o on o.id = d.order_id
      join public.shops s on s.id = o.shop_id
      where d.id::text = (storage.foldername(name))[1]
        and (d.driver_id = auth.uid() or o.customer_id = auth.uid() or s.owner_id = auth.uid() or public.is_admin())
    )
  );
create policy "delivery_proofs_driver_write" on storage.objects
  for insert with check (
    bucket_id = 'delivery-proofs'
    and exists (select 1 from public.deliveries d where d.id::text = (storage.foldername(name))[1] and d.driver_id = auth.uid())
  );
