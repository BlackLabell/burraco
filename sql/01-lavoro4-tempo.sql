-- ============================================================
-- LAVORO 4 — online a tempo
-- Aggiunge la colonna "tempo" alla partita (30/45/60 secondi a turno, o
-- nessun limite) e insegna ad apri_tavolo a riceverla e salvarla.
--
-- Sicuro da eseguire su un database già in uso: aggiunge solo, non
-- cancella e non tocca righe esistenti (le partite già aperte restano
-- senza limite di tempo, cioè col comportamento di oggi).
-- ============================================================

-- 1) La colonna nuova. Nullable: null/mancante = nessun limite di tempo,
--    esattamente come si gioca oggi. Niente vincolo CHECK: l'unico modo
--    per scrivere in questa colonna è apri_tavolo() qui sotto, che già
--    controlla da sola che il valore sia 30, 45 o 60 (o lo azzera).
alter table public.partite add column if not exists tempo integer;

-- 2) apri_tavolo() con un quarto parametro, p_tempo. Si sostituisce la
--    funzione di tre argomenti con una di quattro: prima la si toglie di
--    mezzo (altrimenti Postgres non lascia cambiare i parametri con un
--    semplice "or replace"), poi si ricrea identica a com'era più la parte
--    nuova. Il quarto argomento ha un default (null), quindi se per
--    qualunque motivo un client vecchio la chiamasse ancora con tre
--    argomenti soli, continuerebbe a funzionare lo stesso (senza limite
--    di tempo).
drop function if exists public.apri_tavolo(text, integer, text);

create function public.apri_tavolo(p_modo text, p_target integer, p_nome text, p_tempo integer default null)
 returns partite
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  p public.partite;
  v_tempo integer;
begin
  if p_modo not in ('1v1', '2v2') then raise exception 'modo non valido'; end if;
  if p_target not in (1005, 2005) then raise exception 'traguardo non valido'; end if;
  -- Solo 30/45/60 secondi sono ammessi (deciso da Fabio); qualunque altro
  -- valore (0, null, o un numero a caso) si legge come "nessun limite" —
  -- non si blocca l'apertura del tavolo per un valore fuori misura.
  v_tempo := case when p_tempo in (30, 45, 60) then p_tempo else null end;
  insert into public.partite (codice, modo, target, seme, nomi, tempo)
  values (public.codice_nuovo(), p_modo, coalesce(p_target, 2005),
          floor(random() * 2147483647)::bigint,
          jsonb_build_array(left(coalesce(p_nome, ''), 14), ''),
          v_tempo)
  returning * into p;
  return p;
end $function$;

-- Stessi permessi che aveva già la funzione di prima (letti dal database
-- vero prima di scrivere questo script): anon, authenticated, service_role.
grant execute on function public.apri_tavolo(text, integer, text, integer) to anon, authenticated, service_role;
