-- ============================================================
-- MIA Marketplace — Migration 034: Prélèvement automatique de pièces
-- par commande (Ticket 1 du chantier "nouveau modèle coins")
-- ============================================================
-- Règle exacte : à chaque commande créée pour une boutique, on prélève
-- 1 pièce par PRODUIT DISTINCT dans cette commande, pas par quantité.
-- Exemple de référence : 1 cahier + 3 sardines + 6 chaussures + 1 bic
-- (4 produits différents, 11 articles au total) = 4 pièces prélevées.
--
-- Dépend du Ticket 0 (migration 033) : public.debit_coins(...) accepte
-- désormais un paramètre p_allow_overdraft boolean default false, qui
-- autorise le débit jusqu'à -100 pièces au lieu de bloquer à 0.
--
-- Le client ne doit JAMAIS voir d'erreur liée au solde de pièces du
-- vendeur : le débit est isolé dans un bloc begin/exception pour que
-- son échec éventuel (ex. OVERDRAFT_LIMIT_REACHED) n'annule jamais la
-- commande elle-même.

create or replace function public.checkout_cart(
  p_items jsonb,
  p_delivery_address text default null,
  p_delivery_lat double precision default null,
  p_delivery_lng double precision default null,
  p_product_payment_timing text default 'before',
  p_delivery_payment_timing text default 'after'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_delivery_point geography;
  v_shop_id uuid;
  v_shop_owner_id uuid;
  v_order_id uuid;
  v_item record;
  v_product record;
  v_result jsonb := '[]'::jsonb;
  v_order_total numeric;
  v_distinct_products int;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;

  if p_delivery_lat is not null and p_delivery_lng is not null then
    v_delivery_point := ST_SetSRID(ST_MakePoint(p_delivery_lng, p_delivery_lat), 4326)::geography;
  end if;

  create temporary table tmp_cart_items on commit drop as
  select item.product_id, item.quantity, p.shop_id
  from jsonb_to_recordset(p_items) as item(product_id uuid, quantity int)
  join public.products p on p.id = item.product_id;

  if not exists (select 1 from tmp_cart_items) then
    raise exception 'NO_VALID_PRODUCTS_IN_CART';
  end if;

  insert into public.checkout_groups (customer_id, delivery_address, delivery_location)
    values (v_uid, p_delivery_address, v_delivery_point)
    returning id into v_group_id;

  for v_shop_id in select distinct shop_id from tmp_cart_items
  loop
    v_order_total := 0;

    insert into public.orders (
      customer_id, shop_id, checkout_group_id, status, total,
      delivery_address, delivery_location,
      product_payment_timing, delivery_payment_timing
    ) values (
      v_uid, v_shop_id, v_group_id, 'pending', 0,
      p_delivery_address, v_delivery_point,
      p_product_payment_timing, p_delivery_payment_timing
    ) returning id into v_order_id;

    for v_item in select product_id, quantity from tmp_cart_items where shop_id = v_shop_id
    loop
      select * into v_product from public.products where id = v_item.product_id for update;
      if v_product is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
      if v_product.status <> 'active' then raise exception 'PRODUCT_NOT_AVAILABLE'; end if;
      if v_product.stock < v_item.quantity then raise exception 'INSUFFICIENT_STOCK'; end if;

      insert into public.order_items (order_id, product_id, quantity, unit_price, subtotal)
        values (v_order_id, v_item.product_id, v_item.quantity, v_product.price, v_product.price * v_item.quantity);

      v_order_total := v_order_total + (v_product.price * v_item.quantity);

      update public.products set stock = stock - v_item.quantity where id = v_item.product_id;
    end loop;

    update public.orders set total = v_order_total where id = v_order_id;

    -- ---------- Ticket 1 : prélèvement de pièces par produit distinct ----------
    select count(distinct product_id) into v_distinct_products
      from tmp_cart_items where shop_id = v_shop_id;

    select owner_id into v_shop_owner_id from public.shops where id = v_shop_id;

    begin
      perform public.debit_coins(
        v_shop_owner_id,
        v_distinct_products,
        'Commande #' || v_order_id,
        v_order_id::text,
        p_allow_overdraft := true
      );
    exception when others then
      null;
    end;

    v_result := v_result || jsonb_build_object('order_id', v_order_id, 'shop_id', v_shop_id, 'total', v_order_total);
  end loop;

  return jsonb_build_object('checkout_group_id', v_group_id, 'orders', v_result);
end;
$$;

grant execute on function public.checkout_cart(jsonb, text, double precision, double precision, text, text) to authenticated;
