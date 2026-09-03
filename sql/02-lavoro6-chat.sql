-- ============================================================
-- LAVORO 6 — chat di gioco (frasi standard e faccine)
-- Una tabella nuova, separata da "mosse" (stessa forma: chiave primaria
-- (codice, n), così una raffica di frasi non può mai sfasare il numero
-- delle mosse vere), più le due funzioni per scriverci e leggerla — sullo
-- stesso modello di manda_mossa/leggi_mosse, letto dal database vero
-- prima di scrivere questo script.
--
-- Non è chat libera: solo frasi standard e faccine già decise (vedi
-- FRASI_CHAT in src/ui.js). Niente da moderare lato server per questo:
-- basta un tetto di lunghezza, di cortesia.
-- ============================================================

create table if not exists public.chat (
  codice text not null references public.partite(codice) on delete cascade,
  n integer not null,
  posto smallint not null,
  testo text not null,
  creata timestamptz not null default now(),
  primary key (codice, n)
);

-- Stessa impostazione delle altre tabelle: RLS accesa, nessuna policy.
-- La tabella non si legge né si scrive direttamente con la chiave
-- pubblica — ci si passa solo dalle due funzioni qui sotto.
alter table public.chat enable row level security;

create or replace function public.manda_chat(p_codice text, p_n integer, p_posto smallint, p_testo text)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_testo text;
begin
  v_testo := left(coalesce(p_testo, ''), 40);
  if v_testo = '' then raise exception 'frase vuota'; end if;
  insert into public.chat (codice, n, posto, testo)
  values (upper(trim(p_codice)), p_n, p_posto, v_testo);
  -- una frase in chat conta come attività del tavolo, come una mossa: non
  -- deve rischiare di far chiudere per inattività (pulisci_tavoli, due
  -- giorni fermi) un tavolo dove i due si stanno solo scambiando frasi.
  update public.partite set vista = now() where codice = upper(trim(p_codice));
  return p_n;
end $function$;

create or replace function public.leggi_chat(p_codice text, p_da integer)
 returns table(n integer, posto smallint, testo text)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select c.n, c.posto, c.testo
    from public.chat c
   where c.codice = upper(trim(p_codice)) and c.n >= coalesce(p_da, 0)
   order by c.n;
$function$;

-- Stessi permessi delle altre RPC del tavolo (anon: nessuna registrazione
-- richiesta per giocare né per chattare, com'è oggi per le mosse).
grant execute on function public.manda_chat(text, integer, smallint, text) to anon, authenticated, service_role;
grant execute on function public.leggi_chat(text, integer) to anon, authenticated, service_role;

-- Nota su pulisci_tavoli(): non serve toccarla. cancella le righe di
-- "partite" ferme da due giorni, e "chat" ha "on delete cascade" verso
-- "partite" (stessa cosa che ha già "mosse", verificato prima di scrivere
-- questo script) — quindi le frasi di un tavolo abbandonato spariscono da
-- sole insieme al resto, senza bisogno di una riga in più nel job notturno.
