-- Ticket 5 (chantier nouveau modèle pièces) : historique des pièces
-- prélevées automatiquement par commande, agrégé par jour/semaine/mois.
--
-- La donnée brute existe déjà dans coin_transactions (créée dans
-- 20260718000004_wallet_and_coins.sql, alimentée par le prélèvement
-- automatique du ticket 1 avec description = 'Commande #<id>'). Ce
-- fichier ne fait qu'ajouter une fonction d'agrégation en lecture, il ne
-- modifie aucune migration existante.

create or replace function public.get_coin_debit_summary(
  p_user_id uuid,
  p_granularity text default 'day'
)
returns table (
  period timestamptz,
  orders_count bigint,
  coins_debited bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- security definer contourne la RLS de coin_transactions (qui limite
  -- déjà la lecture à auth.uid() = user_id), donc on refait la même
  -- vérification explicitement ici pour ne pas exposer les pièces
  -- prélevées d'un autre vendeur.
  if auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_granularity not in ('day', 'week', 'month') then
    raise exception 'INVALID_GRANULARITY';
  end if;

  return query
    select
      date_trunc(p_granularity, ct.created_at) as period,
      count(*)::bigint as orders_count,
      sum(ct.amount)::bigint as coins_debited
    from public.coin_transactions ct
    where ct.user_id = p_user_id
      and ct.type = 'debit'
      and ct.description like 'Commande #%'
    group by period
    order by period desc;
end;
$$;

grant execute on function public.get_coin_debit_summary(uuid, text) to authenticated;
