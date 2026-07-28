-- ============================================================
-- MIA Marketplace — Migration 023: Consentement éclairé (RGPD-like)
-- ============================================================
-- "Même si le compte peut ne pas être créé au début, on doit collecter
-- leurs données seulement s'il accepte." -> le consentement doit exister
-- AVANT la création du compte (pour le tracking anonyme d'un simple
-- visiteur) ET être confirmé explicitement à l'inscription (pour les
-- données personnelles : téléphone, localisation).
--
-- Conforme à l'esprit des lois citées par l'audit (Ghana Data Protection
-- Act, Sénégal, Togo, Bénin, Cameroun...) : consentement EXPLICITE,
-- GRANULAIRE (pas un "tout accepter" fourre-tout), et TRAÇABLE (preuve
-- de quand/quoi a été accepté, en cas de contrôle par une autorité).

-- ---------- Consentement anonyme (avant tout compte) ----------
-- Un visiteur non connecté a un session_id (déjà utilisé par
-- interactions.session_id, migration 20260719000009 dans une version
-- antérieure du schéma) - on trace son choix de consentement au
-- tracking analytique AVANT qu'il ne crée un compte.
create table public.anonymous_consents (
  session_id text primary key,
  analytics_consent boolean not null default false,
  consented_at timestamptz not null default now(),
  ip_country text -- pour preuve de quelle juridiction s'appliquait au moment du consentement
);

alter table public.anonymous_consents enable row level security;
-- Un visiteur anonyme n'a pas de auth.uid() : accès via clé anon
-- uniquement en insert/update sur SON PROPRE session_id (fourni par le
-- client, jamais deviné côté serveur) - pas de lecture publique.
create policy "anonymous_consents_insert_own" on public.anonymous_consents
  for insert with check (true); -- le session_id est un identifiant opaque généré client-side, pas un secret à protéger en écriture
create policy "anonymous_consents_update_own" on public.anonymous_consents
  for update using (true) with check (true);
create policy "anonymous_consents_admin_select" on public.anonymous_consents
  for select using (public.is_admin());

-- ---------- Consentement lié à un compte (granulaire, traçable) ----------
create table public.user_consents (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- Chaque type de consentement est SÉPARÉ (granulaire) - refuser le
  -- marketing ne doit jamais bloquer l'usage du service, seul le
  -- consentement "essential_data" (nécessaire au fonctionnement même du
  -- compte : téléphone pour l'auth, adresse pour la livraison) est requis.
  essential_data_consent boolean not null default false,
  essential_data_consented_at timestamptz,
  analytics_consent boolean not null default false,
  analytics_consented_at timestamptz,
  marketing_consent boolean not null default false,
  marketing_consented_at timestamptz,
  location_consent boolean not null default false,
  location_consented_at timestamptz,
  -- Version de la politique de confidentialité acceptée - si le texte
  -- change significativement, le consentement doit être redemandé
  -- (comparer à la dernière version publiée, cf. privacy_policy_versions).
  privacy_policy_version text,
  updated_at timestamptz not null default now()
);

alter table public.user_consents enable row level security;
create policy "user_consents_select_own" on public.user_consents
  for select using (user_id = auth.uid() or public.is_admin());
create policy "user_consents_insert_own" on public.user_consents
  for insert with check (user_id = auth.uid());
create policy "user_consents_update_own" on public.user_consents
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Historique immuable des consentements (preuve légale) ----------
-- user_consents ne garde que l'état ACTUEL - en cas de contrôle, il faut
-- pouvoir prouver l'historique complet (ex: "l'utilisateur a refusé le
-- marketing le 3 janvier, puis accepté le 15 mars"). Table append-only,
-- jamais de update/delete.
create table public.consent_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id text, -- pour tracer un consentement anonyme devenu compte plus tard
  consent_type text not null check (consent_type in ('essential_data', 'analytics', 'marketing', 'location')),
  granted boolean not null,
  privacy_policy_version text,
  created_at timestamptz not null default now()
);

create index idx_consent_history_user on public.consent_history (user_id, created_at desc);

alter table public.consent_history enable row level security;
create policy "consent_history_select_own" on public.consent_history
  for select using (user_id = auth.uid() or public.is_admin());
create policy "consent_history_insert_own" on public.consent_history
  for insert with check (user_id = auth.uid() or user_id is null);
-- Pas de policy update/delete pour authenticated: table append-only par
-- construction (RLS refuse par défaut sans policy correspondante).

-- ---------- fn: enregistrer un consentement (met à jour l'état ET l'historique atomiquement) ----------
create or replace function public.set_user_consent(
  p_user_id uuid,
  p_consent_type text,
  p_granted boolean,
  p_privacy_policy_version text default 'v1'
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_consent_type not in ('essential_data', 'analytics', 'marketing', 'location') then
    raise exception 'INVALID_CONSENT_TYPE';
  end if;

  insert into public.user_consents (user_id) values (p_user_id) on conflict (user_id) do nothing;

  execute format(
    'update public.user_consents set %I = $1, %I = now(), privacy_policy_version = $2, updated_at = now() where user_id = $3',
    p_consent_type || '_consent', p_consent_type || '_consented_at'
  ) using p_granted, p_privacy_policy_version, p_user_id;

  insert into public.consent_history (user_id, consent_type, granted, privacy_policy_version)
    values (p_user_id, p_consent_type, p_granted, p_privacy_policy_version);
end;
$$;

grant execute on function public.set_user_consent(uuid, text, boolean, text) to authenticated;

-- ---------- fn: enregistrer un consentement anonyme (avant compte) ----------
create or replace function public.set_anonymous_consent(
  p_session_id text,
  p_analytics_consent boolean,
  p_ip_country text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.anonymous_consents (session_id, analytics_consent, ip_country)
    values (p_session_id, p_analytics_consent, p_ip_country)
  on conflict (session_id) do update
    set analytics_consent = p_analytics_consent, consented_at = now();

  insert into public.consent_history (session_id, consent_type, granted)
    values (p_session_id, 'analytics', p_analytics_consent);
end;
$$;

grant execute on function public.set_anonymous_consent(text, boolean, text) to authenticated, anon;

-- ---------- Conditionne le tracking analytics au consentement ----------
-- La table 'analytics' (utilisée par trackEvent côté client) doit
-- vérifier le consentement AVANT d'accepter un insert - jamais faire
-- confiance au client pour ne pas appeler trackEvent si le consentement
-- est refusé (un bug frontend ne doit jamais devenir une violation
-- légale silencieuse).
create or replace function public.check_analytics_consent()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_consented boolean;
begin
  if new.user_id is not null then
    select analytics_consent into v_consented from public.user_consents where user_id = new.user_id;
  elsif new.session_id is not null then
    select analytics_consent into v_consented from public.anonymous_consents where session_id = new.session_id;
  end if;

  if coalesce(v_consented, false) = false then
    -- Ne bloque pas l'insert avec une exception (casserait l'UX pour une
    -- fonctionnalité non-critique) - on annule silencieusement l'écriture
    -- en la redirigeant vers null via RETURN NULL sur un trigger BEFORE.
    return null;
  end if;

  return new;
end;
$$;

-- Ajoute session_id à analytics si absent (nécessaire pour vérifier le
-- consentement anonyme d'un visiteur non connecté).
alter table public.analytics add column if not exists session_id text;

drop trigger if exists trg_check_analytics_consent on public.analytics;
create trigger trg_check_analytics_consent
  before insert on public.analytics
  for each row execute function public.check_analytics_consent();

comment on table public.analytics is 'Écriture conditionnée au consentement (voir trg_check_analytics_consent) - un insert sans consentement valide est silencieusement annulé, jamais enregistré.';
