-- ============================================================
-- METRICHE: partite contro il livello Pro (3 settembre 2026)
-- Una tabella nuova, indipendente da tutto il resto (partite, mosse,
-- chat, conto, statistiche): non tocca niente di esistente. Serve solo
-- a raccogliere, a fine partita 1v1 offline contro il livello più forte
-- del computer (il "Pro"), un riepilogo utile a capire come gioca contro
-- un umano vero e a ritoccare le soglie in src/engine.js — vedi
-- claude/offline-livelli-ia.md nel progetto.
--
-- Stesso stile delle altre tabelle del gioco: RLS accesa, nessuna
-- policy — non si legge né si scrive nulla con la chiave pubblica, solo
-- attraverso la funzione qui sotto (che scrive soltanto, non legge: le
-- righe si guardano dal pannello Supabase, come proprietario del
-- progetto, non dall'app).
-- ============================================================

create table if not exists public.metriche_pro (
  id bigint generated always as identity primary key,
  creata timestamptz not null default now(),
  nome text,
  seme text,
  mani integer,
  punti_umano integer,
  punti_computer integer,
  vincitore text check (vincitore in ('umano', 'computer')),
  turni_totali integer,
  prese_monte_computer integer,
  prese_tallone_computer integer,
  versione text
);

alter table public.metriche_pro enable row level security;

create or replace function public.manda_metrica_pro(
  p_nome text,
  p_seme text,
  p_mani integer,
  p_punti_umano integer,
  p_punti_computer integer,
  p_vincitore text,
  p_turni_totali integer,
  p_prese_monte_computer integer,
  p_prese_tallone_computer integer,
  p_versione text
)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into public.metriche_pro
    (nome, seme, mani, punti_umano, punti_computer, vincitore,
     turni_totali, prese_monte_computer, prese_tallone_computer, versione)
  values
    (left(coalesce(p_nome, ''), 40),
     left(coalesce(p_seme, ''), 40),
     coalesce(p_mani, 0),
     coalesce(p_punti_umano, 0),
     coalesce(p_punti_computer, 0),
     case when p_vincitore in ('umano', 'computer') then p_vincitore else 'computer' end,
     coalesce(p_turni_totali, 0),
     coalesce(p_prese_monte_computer, 0),
     coalesce(p_prese_tallone_computer, 0),
     left(coalesce(p_versione, ''), 20));
$function$;

grant execute on function public.manda_metrica_pro(
  text, text, integer, integer, integer, text, integer, integer, integer, text
) to anon, authenticated, service_role;

-- Nota su pulisci_tavoli(): non tocca questa tabella (non ha nessun
-- collegamento a "partite"), quindi le righe di metriche_pro restano per
-- sempre finché non le cancelli tu — utile perché sono dati da guardare
-- nel tempo, non stato di un tavolo da buttare quando la partita finisce.
