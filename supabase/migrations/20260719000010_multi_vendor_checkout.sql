-- ============================================================
-- MIA Marketplace — Migration 010: Checkout multi-vendeurs & livraison groupée
-- ============================================================
-- Contexte : un panier peut contenir des produits de plusieurs boutiques.
-- Chaque boutique ne doit voir/traiter QUE ce qui la concerne : on scinde
-- donc le panier en une commande (orders) PAR boutique dès le checkout,
-- jamais une commande unique multi-vendeurs. C'est le sens de
-- "chaque vendeur reçoit seulement ce qui est commandé chez eux".
--
-- Le lien entre plusieurs commandes nées du même panier (utile pour
-- afficher "votre commande groupée" côté client, et pour permettre à un
-- livreur de choisir de tout récupérer d'un coup) est un simple
-- checkout_group_id partagé - pas une nouvelle hiérarchie de tables.

-- ---------- checkout_groups ----------
-- Un groupe = un passage en caisse du client, peut engendrer 1..N orders
-- (une par boutique présente dans le panier à ce moment-là).
create table public.checkout_groups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  delivery_address text,
  delivery_location geography(Point, 4326),
  created_at timestamptz not null default now()
);
create index idx_checkout_groups_customer on public.checkout_groups(customer_id, created_at desc);

alter table public.orders add column if not exists checkout_group_id uuid references public.checkout_groups(id);
create index if not exists idx_orders_checkout_group on public.orders(checkout_group_id);

-- ---------- Frais et modalités de livraison sur la commande ----------
-- "Si plusieurs produits chez même vendeur, prix de livraison est le
-- même" -> le frais de livraison est calculé UNE FOIS par commande
-- (= par boutique), jamais par article, donc il vit ici sur orders et
-- pas sur order_items.
alter table public.orders add column if not exists delivery_fee numeric not null default 0;
alter table public.orders add column if not exists delivery_fee_paid boolean not null default false;
-- 'before' = le client paie la livraison à la commande, 'after' = le
-- client paie le livreur à la remise (cash), 'included' = frais déjà
-- inclus dans "total" (paiement wallet/carte unique).
alter table public.orders add column if not exists delivery_payment_timing text
  check (delivery_payment_timing in ('before','after','included')) default 'after';
-- Paiement du produit lui-même avant ou après réception - distinct du
-- paiement de la livraison : un client peut par ex. payer la livraison
-- d'avance sur wallet mais choisir le paiement à la livraison pour le
-- produit (cash on delivery classique en Afrique de l'Ouest).
alter table public.orders add column if not exists product_payment_timing text
  check (product_payment_timing in ('before','after')) default 'before';

comment on column public.orders.delivery_fee is 'Frais de livraison pour CETTE commande (= cette boutique). Identique quel que soit le nombre d''articles de cette boutique dans le panier.';
comment on column public.orders.delivery_payment_timing is 'before = payé à la commande, after = payé au livreur à la remise, included = déjà dans le total payé en ligne.';

-- ---------- WhatsApp : réception de commande par boutique ----------
-- "Le vendeur reçoit les commandes au niveau des commandes ET sur
-- WhatsApp, sauf s'il désactive". Un numéro dédié par boutique (déjà
-- whatsapp_number sur shops) + un flag d'activation + traçabilité de
-- qui a le droit d'utiliser ce numéro pour CE produit (collaboration :
-- "un utilisateur populaire peut mettre le produit d'un autre vendeur
-- avec le numéro de cet autre vendeur").
alter table public.shops add column if not exists whatsapp_orders_enabled boolean not null default true;

-- Numéro de réception spécifique à un produit (override du numéro de la
-- boutique) - permet la collaboration décrite : le produit reste dans le
-- catalogue du vendeur A, mais les commandes WhatsApp de CE produit
-- partent vers le numéro renseigné (qui peut être celui du vendeur B).
alter table public.products add column if not exists whatsapp_order_number text;
alter table public.products add column if not exists whatsapp_orders_enabled boolean not null default true;

comment on column public.products.whatsapp_order_number is 'Numéro WhatsApp de réception pour CE produit spécifiquement (override shops.whatsapp_number). Permet une collaboration: produit du vendeur A, commandes reçues par le vendeur B.';

-- ---------- fn_checkout : scinde un panier multi-vendeurs en N commandes ----------
-- p_items: jsonb array [{ "product_id": "...", "quantity": 2 }, ...]
-- Retourne un jsonb array des commandes créées (une par boutique), avec
-- leur order_id, shop_id et total, pour que le client redirige ensuite
-- vers le paiement (wallet direct, ou checkout Moneroo/Chariow un par un
-- ou groupé selon ce que choisit le client à l'écran).
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
  v_order_id uuid;
  v_item record;
  v_product record;
  v_result jsonb := '[]'::jsonb;
  v_order_total numeric;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;

  if p_delivery_lat is not null and p_delivery_lng is not null then
    v_delivery_point := ST_SetSRID(ST_MakePoint(p_delivery_lng, p_delivery_lat), 4326)::geography;
  end if;

  -- Matérialise le panier UNE SEULE FOIS dans une table temporaire, avec
  -- le shop_id résolu par ligne : évite de reparser le jsonb à chaque
  -- itération de la boucle par boutique ci-dessous.
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

  -- Une passe par boutique distincte présente dans le panier : chaque
  -- boutique = une commande séparée, contenant uniquement SES articles.
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

    v_result := v_result || jsonb_build_object('order_id', v_order_id, 'shop_id', v_shop_id, 'total', v_order_total);
  end loop;

  return jsonb_build_object('checkout_group_id', v_group_id, 'orders', v_result);
end;
$$;

grant execute on function public.checkout_cart(jsonb, text, double precision, double precision, text, text) to authenticated;

-- ---------- Frais de livraison : calcul simple par zone/pays ----------
-- Table de tarifs de base par pays (ajustable en back-office), le calcul
-- réel fin (distance PostGIS boutique <-> livraison) reste côté
-- Edge Function delivery-quote pour pouvoir évoluer sans migration.
create table public.delivery_pricing (
  country_code text primary key,
  base_fee numeric not null default 0,
  per_km_fee numeric not null default 0,
  free_above_amount numeric,
  updated_at timestamptz not null default now()
);
insert into public.delivery_pricing (country_code, base_fee, per_km_fee) values
  ('TG', 500, 100), ('BJ', 500, 100), ('CI', 1000, 150), ('SN', 1000, 150);

alter table public.delivery_pricing enable row level security;
create policy "delivery_pricing_public_select" on public.delivery_pricing for select using (true);
create policy "delivery_pricing_admin_write" on public.delivery_pricing
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.checkout_groups enable row level security;
create policy "checkout_groups_select_own" on public.checkout_groups
  for select using (customer_id = auth.uid() or public.is_admin());
create policy "checkout_groups_insert_own" on public.checkout_groups
  for insert with check (customer_id = auth.uid());
