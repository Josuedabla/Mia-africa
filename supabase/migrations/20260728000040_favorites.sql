-- ============================================================
-- MIA Marketplace — Migration 040: favorites (produits sauvegardés)
-- ============================================================
-- Le bouton "Ajouter aux favoris" sur ProductPage.tsx n'avait aucune
-- logique derrière (pas d'onClick) - il n'existait ni table, ni
-- fonction pour ça. Cette migration crée le strict nécessaire pour
-- qu'un acheteur connecté puisse sauvegarder/retirer un produit et
-- consulter sa liste de favoris.

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists favorites_user_id_idx on public.favorites(user_id);
create index if not exists favorites_product_id_idx on public.favorites(product_id);

alter table public.favorites enable row level security;

-- Un utilisateur ne voit, n'ajoute et ne retire que ses propres favoris -
-- jamais ceux de quelqu'un d'autre, jamais une liste publique par défaut.
drop policy if exists favorites_owner_all on public.favorites;
create policy favorites_owner_all
  on public.favorites
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Bascule favori/pas favori en un seul aller-retour (évite un select
-- puis un insert/delete séparés côté client, source classique de race
-- condition sur un double-clic rapide). Retourne le nouvel état.
create or replace function public.toggle_favorite(p_product_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existed boolean;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select true into v_existed
  from public.favorites
  where user_id = v_uid and product_id = p_product_id;

  if v_existed then
    delete from public.favorites where user_id = v_uid and product_id = p_product_id;
    return false;
  else
    insert into public.favorites (user_id, product_id) values (v_uid, p_product_id)
    on conflict (user_id, product_id) do nothing;
    return true;
  end if;
end;
$$;

grant execute on function public.toggle_favorite(uuid) to authenticated;

-- Liste des produits favoris d'un utilisateur, triée du plus récent au
-- plus ancien - réutilisée telle quelle par la future page "Mes favoris".
create or replace function public.get_my_favorite_products()
returns setof public.products
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.products p
  join public.favorites f on f.product_id = p.id
  where f.user_id = auth.uid()
  order by f.created_at desc;
$$;

grant execute on function public.get_my_favorite_products() to authenticated;
