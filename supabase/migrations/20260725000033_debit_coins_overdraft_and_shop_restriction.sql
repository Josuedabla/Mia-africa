-- ============================================================
-- MIA Marketplace — Migration 033 : Découvert autorisé jusqu'à -100 pièces
-- (Ticket 0 du chantier "nouveau modèle coins") — BLOQUANT, à merger
-- avant tous les autres tickets (1 à 5) de ce chantier.
-- ============================================================
-- Le nouveau modèle de prélèvement automatique par commande (ticket 1)
-- doit pouvoir débiter le vendeur même si son solde devient négatif,
-- jusqu'à -100 pièces, sans jamais bloquer la commande du client.
-- Au-delà de -100, sa boutique doit disparaître des listings publics
-- (ticket 2) mais rester joignable par lien direct (page produit/boutique).
--
-- debit_coins garde son comportement actuel par défaut : boost, badge
-- bleu et dons continuent d'appeler la fonction sur 4 arguments (vérifié
-- via grep sur supabase/ et src/ : aucun appel existant ne passe de 5e
-- argument), donc p_allow_overdraft reste false pour eux — pas de
-- découvert possible sur ces achats volontaires, uniquement sur le
-- prélèvement automatique par commande (ticket 1).

-- ------------------------------------------------------------
-- Piège à corriger AVANT de toucher à la fonction : coin_balances a une
-- contrainte CHECK (coins >= 0) posée à la création de la table
-- (20260718000004_wallet_and_coins.sql). Sans la relâcher, tout débit en
-- découvert échouerait avec une violation de contrainte Postgres — et
-- comme le ticket 1 entoure l'appel à debit_coins d'un
-- "exception when others then null", cet échec serait avalé
-- silencieusement : aucune commande ne serait jamais visible en base
-- comme "non prélevée", le vendeur ne descendrait jamais sous 0, et rien
-- ne le signalerait. Le découvert doit donc être autorisé au niveau de
-- la table elle-même, pas seulement dans la logique de la fonction.
-- ------------------------------------------------------------
alter table public.coin_balances drop constraint if exists coin_balances_coins_check;
alter table public.coin_balances add constraint coin_balances_coins_check check (coins >= -100);

create or replace function public.debit_coins(
  p_user_id uuid,
  p_amount bigint,
  p_description text,
  p_related_id text default null,
  p_allow_overdraft boolean default false
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_current bigint;
  v_new_balance bigint;
begin
  if p_amount <= 0 then raise exception 'Coin debit must be positive'; end if;

  select coins into v_current from public.coin_balances where user_id = p_user_id for update;
  if v_current is null then v_current := 0; end if;

  if p_allow_overdraft then
    if v_current - p_amount < -100 then
      raise exception 'OVERDRAFT_LIMIT_REACHED' using errcode = 'P0001';
    end if;
  else
    if v_current < p_amount then
      raise exception 'INSUFFICIENT_COINS' using errcode = 'P0001';
    end if;
  end if;

  insert into public.coin_balances (user_id, coins) values (p_user_id, -p_amount)
    on conflict (user_id) do update set coins = coin_balances.coins - p_amount, updated_at = now()
    returning coins into v_new_balance;

  insert into public.coin_transactions (user_id, type, amount, balance_after, description, related_id)
    values (p_user_id, 'debit', p_amount, v_new_balance, p_description, p_related_id);

  return v_new_balance;
end;
$$;

-- Le paramètre ajouté (p_allow_overdraft) est en fin de liste avec une
-- valeur par défaut : conserve la même signature d'arguments pour tous
-- les appels existants (create or replace suffit, pas de drop function).
grant execute on function public.debit_coins(uuid, bigint, text, text, boolean) to service_role, authenticated;

-- ============================================================
-- is_shop_restricted : vrai si le solde du PROPRIÉTAIRE de la boutique
-- (shops.owner_id, pas le client) est <= -100 pièces. Utilisée par le
-- ticket 2 pour masquer la boutique des listings publics (recherche,
-- tendances, feed de découverte) sans jamais bloquer l'accès direct par
-- lien à sa page produit ou sa page boutique.
-- Un propriétaire sans ligne dans coin_balances (jamais eu de débit/
-- crédit) est considéré à 0 pièce, donc non restreint.
-- ============================================================
create or replace function public.is_shop_restricted(p_shop_id uuid)
returns boolean
language sql stable as $$
  select coalesce(
    (select cb.coins <= -100
       from public.shops s
       join public.coin_balances cb on cb.user_id = s.owner_id
       where s.id = p_shop_id),
    false
  );
$$;

grant execute on function public.is_shop_restricted(uuid) to authenticated, anon, service_role;
