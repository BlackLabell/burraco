-- Burraco — arbitro sul server: far entrare il secondo giocatore.
-- Incollare nell'SQL Editor di Supabase (progetto "burraco") ed eseguire
-- una volta sola.
--
-- Non serve toccare niente altro: la tabella `tavoli` e la funzione
-- `vedi_tavolo` esistono già nel progetto e sono corrette. Questa è la
-- terza e ultima funzione che serve, oltre alla edge function "tavolo"
-- (che gestisce apertura tavolo e mosse — vedi la guida).

create or replace function public.entra_tavolo(p_codice text, p_nome text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c   text := upper(trim(p_codice));
  seg text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  t   public.tavoli;
begin
  -- Un solo UPDATE, con tutte le condizioni nel WHERE: o si prende il
  -- posto in un colpo solo, o non si tocca nulla. Così due persone che
  -- premono "entra" nello stesso istante non possono mai finire sedute
  -- allo stesso posto.
  update public.tavoli
     set nomi    = jsonb_set(nomi, '{1}', to_jsonb(left(coalesce(p_nome, ''), 14))),
         segreti = jsonb_set(segreti, '{1}', to_jsonb(seg)),
         vista   = now()
   where codice = c
     and stato is not null        -- il tavolo dev'essere già pronto (aperto dalla edge function)
     and segreti->>1 is null      -- il secondo posto dev'essere libero
  returning * into t;

  if t.codice is null then
    -- non è riuscito: capiamo perché, solo per dare un messaggio chiaro
    select * into t from public.tavoli where codice = c;
    if t.codice is null then raise exception 'tavolo non trovato'; end if;
    if t.stato is null then raise exception 'il tavolo non è ancora pronto'; end if;
    raise exception 'il tavolo è già al completo';
  end if;

  return jsonb_build_object('codice', c, 'posto', 1, 'segreto', seg);
end $$;

grant execute on function public.entra_tavolo(text, text) to anon, authenticated;
