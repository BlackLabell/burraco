# Lavoro 4 e 6 — cosa eseguire sul tuo Supabase, passo per passo

Nessuna riga di comando: solo il pannello di Supabase, come per l'arbitro
sul server. Due file SQL, indipendenti l'uno dall'altro — si possono
eseguire in un ordine qualsiasi, ma ti conviene farli nell'ordine dato
(prima il tempo, poi la chat).

Ho controllato **direttamente sul tuo progetto vero** (burraco,
`cpwodjykbfmyykybbtzm`) come sono scritte oggi le funzioni che tocco,
prima di scrivere questi script — non sono a memoria: sono la copia
esatta di quello che c'è già, più la parte nuova.

## Passo 1 — `01-lavoro4-tempo.sql`

1. Apri il pannello Supabase del progetto **burraco**.
2. Vai su **SQL Editor** (icona a sinistra) → **New query**.
3. Incolla tutto il contenuto di `01-lavoro4-tempo.sql`.
4. **Run**.

Cosa fa: aggiunge una colonna `tempo` alla tabella `partite` (vuota per le
partite già aperte: continuano a giocare senza limite di tempo, come
oggi), e sostituisce `apri_tavolo` con una versione che accetta anche
`p_tempo` (30, 45 o 60 secondi — qualunque altro valore lo tratta come
"nessun limite"). Il resto della funzione è identico a quello che c'è già.

Non tocca `siediti`, `guarda_tavolo`, `manda_mossa`, `leggi_mosse`: quelle
restano esattamente come sono, perché la partita entra già col campo
`tempo` dentro la riga che restituiscono (fa parte della `partite` intera
che rimandano indietro).

## Passo 2 — `02-lavoro6-chat.sql`

1. Stessa strada: **SQL Editor** → **New query**.
2. Incolla tutto il contenuto di `02-lavoro6-chat.sql`.
3. **Run**.

Cosa fa: crea una tabella nuova `chat` (uguale nella forma a `mosse`: un
codice tavolo, un numero progressivo, chi parla, cosa dice) e due funzioni
per scriverci e leggerla, `manda_chat` e `leggi_chat` — stesso schema di
`manda_mossa`/`leggi_mosse` che hai già. RLS accesa e nessuna policy,
come tutte le altre tabelle del gioco: non si legge né si scrive niente
con la chiave pubblica, solo attraverso queste due funzioni.

Non serve toccare il lavoro notturno che chiude i tavoli fermi da due
giorni (`pulisci_tavoli`, ogni notte alle 4:17): quando cancella un
tavolo vecchio, le frasi di chat di quel tavolo spariscono da sole insieme
alle mosse (stessa regola "on delete cascade" che ha già `mosse`).

## Dopo aver eseguito i due script

Nessun riavvio da fare, nessuna cache da svuotare: le funzioni SQL sono
attive nell'istante in cui premi Run. Il client (l'app) userà la colonna
`tempo` e le due funzioni nuove solo quando pubblichi la versione
`burraco-v34` — finché non lo fai, il sito online resta quello di oggi e
gli script eseguiti qui non cambiano niente per chi sta già giocando.

## Se qualcosa va storto

- **"function apri_tavolo(text, integer, text) does not exist"** dopo aver
  eseguito il passo 1: è normale finché non pubblichi anche `burraco-v34`
  — il sito attuale chiama ancora la versione a tre argomenti. Lo script
  ne crea una a quattro con l'ultimo opzionale, quindi in teoria continua
  a funzionare anche coi tre soli; se per qualche motivo desse comunque
  errore, fammelo sapere prima di pubblicare la nuova versione del sito.
- **Vuoi tornare indietro** (togliere il tempo o la chat): il passo 1 si
  annulla con `alter table public.partite drop column tempo;` (le partite
  in corso perdono solo il limite di tempo, nessun altro dato); il passo 2
  con `drop table public.chat;`. Non serve normalmente, ma è lì se serve.
