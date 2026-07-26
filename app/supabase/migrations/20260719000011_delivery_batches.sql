-- ============================================================
-- MIA Marketplace — Migration 011: Livraison groupée multi-vendeurs
-- ============================================================
-- "Les livreurs voient les produits. Si plusieurs produits chez même
-- vendeur, prix de livraison est le même [déjà géré: delivery_fee par
-- commande]. Mais si chez plusieurs vendeurs, le livreur peut choisir de
-- tout récupérer et livrer, ou choisir ceux qui sont proches de lui."
--
-- Modèle : deliveries reste 1:1 avec orders (une livraison = une
-- commande = une boutique), MAIS on ajoute delivery_batches pour
-- regrouper plusieurs deliveries prises par le MÊME livreur dans la
-- MÊME tournée quand elles viennent du même checkout_group_id (client
-- unique, plusieurs boutiques). Le livreur choisit librement quelles
-- deliveries individuelles rejoindre à son batch - jamais un tout-ou-rien.

create table public.delivery_batches (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id),
  checkout_group_id uuid references public.checkout_groups(id),
  status text not null default 'in_progress' check (status in ('in_progress','completed','cancelled')),
  created_at timestamptz not null default now()
);
create index idx_delivery_batches_driver on public.delivery_batches(driver_id, status);

alter table public.deliveries add column if not exists batch_id uuid references public.delivery_batches(id);
create index if not exists idx_deliveries_batch on public.deliveries(batch_id);

alter table public.delivery_batches enable row level security;
create policy "delivery_batches_select_own" on public.delivery_batches
  for select using (driver_id = auth.uid() or public.is_admin());
create policy "delivery_batches_driver_write" on public.delivery_batches
  for all using (driver_id = auth.uid()) with check (driver_id = auth.uid());

-- ---------- fn_available_deliveries_for_driver ----------
-- Liste les livraisons disponibles ('searching', pas encore assignées)
-- triées par proximité du livreur, en indiquant pour chacune si elle fait
-- partie d'un même checkout_group_id qu'une autre livraison déjà visible
-- (pour que l'UI propose "récupérer tout le groupe" comme RACCOURCI, sans
-- jamais l'imposer - le livreur choisit toujours au cas par cas).
create or replace function public.available_deliveries_for_driver(
  p_lat double precision, p_lng double precision, p_radius_km double precision default 15
) returns table (
  delivery_id uuid, order_id uuid, shop_id uuid, shop_name text,
  checkout_group_id uuid, pickup_lat double precision, pickup_lng double precision,
  distance_km double precision, order_total numeric, delivery_fee numeric, item_count int
)
language sql stable as $$
  select
    d.id, d.order_id, o.shop_id, s.name,
    o.checkout_group_id,
    ST_Y(d.pickup_location::geometry), ST_X(d.pickup_location::geometry),
    ST_Distance(d.pickup_location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000.0,
    o.total, o.delivery_fee,
    (select count(*) from public.order_items oi where oi.order_id = o.id)::int
  from public.deliveries d
  join public.orders o on o.id = d.order_id
  join public.shops s on s.id = o.shop_id
  where d.status = 'searching'
    and d.pickup_location is not null
    and ST_DWithin(d.pickup_location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000)
  order by 9 asc;
$$;

grant execute on function public.available_deliveries_for_driver(double precision, double precision, double precision) to authenticated;

-- ---------- fn_claim_deliveries ----------
-- Le livreur choisit UNE OU PLUSIEURS livraisons (p_delivery_ids) à
-- récupérer dans la même tournée. Peut être un sous-ensemble d'un
-- checkout_group (il prend seulement celles proches de lui) ou la
-- totalité (il "récupère tout"). Chaque delivery reste indépendante
-- (statut propre, remise indépendante) mais partage batch_id pour
-- l'affichage "tournée en cours" côté app livreur.
create or replace function public.claim_deliveries(p_delivery_ids uuid[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_batch_id uuid;
  v_group_id uuid;
  v_count int;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if array_length(p_delivery_ids, 1) is null then raise exception 'EMPTY_SELECTION'; end if;

  -- Toutes les livraisons demandées doivent être encore libres.
  select count(*) into v_count from public.deliveries
    where id = any(p_delivery_ids) and status = 'searching';
  if v_count <> array_length(p_delivery_ids, 1) then
    raise exception 'SOME_DELIVERIES_ALREADY_TAKEN';
  end if;

  select o.checkout_group_id into v_group_id
    from public.deliveries d join public.orders o on o.id = d.order_id
    where d.id = p_delivery_ids[1];

  insert into public.delivery_batches (driver_id, checkout_group_id)
    values (v_uid, v_group_id)
    returning id into v_batch_id;

  update public.deliveries
    set status = 'assigned', driver_id = v_uid, batch_id = v_batch_id, assigned_at = now()
    where id = any(p_delivery_ids) and status = 'searching';

  return v_batch_id;
end;
$$;

grant execute on function public.claim_deliveries(uuid[]) to authenticated;
