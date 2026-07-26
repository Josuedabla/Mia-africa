-- ============================================================
-- MIA Marketplace — Migration 026: Variantes produit
-- ============================================================
-- Spec (MIA-Spec-Fonctionnalites.md, section 2 & 4) : couleur, taille,
-- poids — chaque attribut activable/désactivable par le vendeur avant
-- publication. Deux tables :
--   product_variant_attributes : quels attributs sont actifs pour un
--     produit donné, et la liste de valeurs possibles pour chacun.
--   product_variants : le produit cartésien des valeurs (une ligne par
--     combinaison réellement en vente), avec son propre stock.
-- products.stock reste la source de vérité pour le checkout existant
-- (multi_vendor_checkout.sql décrémente products.stock uniquement) -
-- quand des variantes sont actives, products.stock est simplement tenu
-- à jour automatiquement comme la somme des stocks de variantes
-- (trigger ci-dessous), pour ne rien casser côté commande.

alter table public.products
  add column if not exists has_variants boolean not null default false;

create table public.product_variant_attributes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attribute text not null check (attribute in ('couleur', 'taille', 'poids')),
  values text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (product_id, attribute)
);
create index idx_product_variant_attributes_product on public.product_variant_attributes(product_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attributes jsonb not null,   -- ex: {"couleur": "Rouge", "taille": "M"}
  stock int not null default 0 check (stock >= 0),
  sku text,
  created_at timestamptz not null default now(),
  unique (product_id, attributes)
);
create index idx_product_variants_product on public.product_variants(product_id);

-- Garde products.stock synchronisé avec la somme des variantes dès
-- qu'au moins une variante existe pour ce produit - le reste du code
-- (checkout, affichage "en stock") continue de lire products.stock
-- sans rien savoir des variantes.
create or replace function public.sync_product_stock_from_variants()
returns trigger
language plpgsql
as $$
declare
  v_product_id uuid;
  v_total int;
begin
  v_product_id := coalesce(new.product_id, old.product_id);
  select coalesce(sum(stock), 0) into v_total from public.product_variants where product_id = v_product_id;
  update public.products set stock = v_total, updated_at = now() where id = v_product_id;
  return null;
end;
$$;
create trigger trg_sync_product_stock_from_variants
  after insert or update of stock or delete on public.product_variants
  for each row execute function public.sync_product_stock_from_variants();

alter table public.product_variant_attributes enable row level security;
alter table public.product_variants enable row level security;

create policy "product_variant_attributes_public_select" on public.product_variant_attributes for select using (true);
create policy "product_variant_attributes_owner_write" on public.product_variant_attributes
  for all using (
    exists (select 1 from public.products p join public.shops s on s.id = p.shop_id
            where p.id = product_id and s.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.products p join public.shops s on s.id = p.shop_id
            where p.id = product_id and s.owner_id = auth.uid())
  );

create policy "product_variants_public_select" on public.product_variants for select using (true);
create policy "product_variants_owner_write" on public.product_variants
  for all using (
    exists (select 1 from public.products p join public.shops s on s.id = p.shop_id
            where p.id = product_id and s.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.products p join public.shops s on s.id = p.shop_id
            where p.id = product_id and s.owner_id = auth.uid())
  );
