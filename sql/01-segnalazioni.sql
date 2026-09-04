-- Burraco — "Segnala un problema" (richiesto di nuovo il 4 settembre 2026)
-- Una tabella nuova, indipendente da tutte le altre, per i messaggi liberi
-- di segnalazione: niente più email (mailto), il testo va dritto qui.
--
-- Stesso schema di sicurezza di ogni altra tabella di questo progetto:
-- RLS acceso, NESSUNA policy (senza policy esplicita, con RLS acceso,
-- Postgres blocca sia lettura sia scrittura dirette — anche con la chiave
-- pubblica), unico accesso tramite la funzione SECURITY DEFINER qui sotto,
-- che il client chiama via RPC (vedi Rete.mandaSegnalazione in src/rete.js).
--
-- Da eseguire una sola volta, dal pannello Supabase → SQL Editor → New query
-- → incolla tutto → Run. Vedi GUIDA.md in questa stessa consegna per i
-- passi con gli screenshot dei menu.

create table if not exists public.segnalazioni (
  id          bigint generated always as identity primary key,
  creato_a    timestamptz not null default now(),
  testo       text not null,
  versione    text,
  dispositivo text,
  mosse       text
);

alter table public.segnalazioni enable row level security;
-- Nessuna riga di "create policy" qui sotto: è voluto. Vedi la nota sopra.

create or replace function public.manda_segnalazione(
  p_testo       text,
  p_versione    text default '',
  p_dispositivo text default '',
  p_mosse       text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_testo is null or length(trim(p_testo)) = 0 then
    raise exception 'Il messaggio è vuoto.';
  end if;
  if length(p_testo) > 2000 then
    raise exception 'Messaggio troppo lungo.';
  end if;
  insert into public.segnalazioni (testo, versione, dispositivo, mosse)
  values (
    trim(p_testo),
    coalesce(nullif(trim(p_versione), ''), 'sconosciuta'),
    coalesce(p_dispositivo, ''),
    coalesce(p_mosse, '')
  );
end;
$$;

-- Il client non ha (e non deve avere) un conto per mandare una segnalazione:
-- deve poterlo fare anche chi non si è mai registrato, quindi il grant è
-- anche verso "anon", esattamente come per manda_mossa, manda_chat e
-- manda_metrica_pro.
grant execute on function public.manda_segnalazione(text, text, text, text) to anon, authenticated;
