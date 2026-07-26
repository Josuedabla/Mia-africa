-- ============================================================
-- MIA Marketplace — Migration 014: Création automatique de la livraison
-- ============================================================
-- Sans ce trigger, aucune commande payée n'atteint jamais les livreurs :
-- available_deliveries_for_driver() ne lit que la table deliveries, qui
-- restait vide. Dès qu'une commande passe en statut 'paid', on crée la
-- delivery correspondante avec pickup_location = position de la boutique
-- (pour le calcul de distance côté livreur) et dropoff_location = celle
-- déjà enregistrée sur la commande (le client a choisi son adresse au
-- checkout). Statut initial 'searching' : visible immédiatement dans
-- available_deliveries_for_driver().
--
-- Le paiement à la livraison (cash_on_delivery) doit AUSSI générer une
-- delivery dès la création de la commande (elle ne passera jamais par
-- 'paid' avant remise) - géré par le second trigger ci-dessous.

create or replace function public.create_delivery_for_order()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_shop_location geography;
begin
  -- Idempotent : ne crée jamais deux deliveries pour la même commande
  -- (protégé aussi par la contrainte unique sur deliveries.order_id).
  if exists (select 1 from public.deliveries where order_id = new.id) then
    return new;
  end if;

  select location into v_shop_location from public.shops where id = new.shop_id;

  insert into public.deliveries (order_id, status, pickup_location, dropoff_location)
    values (new.id, 'searching', v_shop_location, new.delivery_location);

  return new;
end;
$$;

-- Cas paiement en ligne (wallet/moneroo/chariow) : la delivery n'a de
-- sens qu'une fois la commande réellement payée.
create trigger trg_create_delivery_on_paid
  after update of status on public.orders
  for each row
  when (new.status = 'paid' and old.status = 'pending')
  execute function public.create_delivery_for_order();

-- Cas paiement à la livraison : la commande reste 'pending' jusqu'à la
-- remise (le paiement se fait alors), donc il faut créer la delivery dès
-- l'insertion de la commande si product_payment_timing = 'after' ET
-- delivery_payment_timing != 'before' payé en ligne au préalable -
-- concrètement : dès que payment_method = 'cash_on_delivery' est choisi.
create trigger trg_create_delivery_on_cod_order
  after insert on public.orders
  for each row
  when (new.payment_method = 'cash_on_delivery')
  execute function public.create_delivery_for_order();
