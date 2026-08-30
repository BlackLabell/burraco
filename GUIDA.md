# Arbitro sul server — guida passo passo (Supabase Dashboard, senza CLI)

Progetto: **burraco** (cpwodjykbfmyykybbtzm)

## Perché serve

Oggi, quando due persone giocano online, ogni telefono riceve lo stesso
"seme" (un numero) e ricalcola da solo tutto il mazzo mischiato — tallone
compreso. Chi apre i tasti sviluppatore del browser (F12) può leggere
quel numero e, con un piccolo conto, vedere tutte le carte: le proprie,
quelle dell'avversario, e quelle ancora nel tallone. In più, oggi basta
conoscere il codice del tavolo (4 lettere) per "diventare" un giocatore
già seduto — non c'è modo di provare "sono davvero io".

Da qui in poi lo stato vero della partita vive solo sul server (con la
chiave segreta, mai esposta al browser), e ogni telefono riceve soltanto
la propria mano. In più, ogni posto ha un gettone segreto lungo e
casuale, diverso dal codice del tavolo: lo si riceve una volta sola
quando ci si siede, e serve per provare "questo posto è mio".

## Cosa c'è già (non toccare)

Guardando il tuo progetto ho trovato che una parte di questo lavoro è
**già stata fatta**, probabilmente in una sessione precedente:

- La tabella `tavoli` esiste già, con le colonne giuste: `segreti`
  (un gettone per posto), `stato` (la partita vera, letta e scritta solo
  dal server), `versione` (un numero che sale a ogni mossa, per capire
  se qualcosa è cambiato senza confrontare tutto).
- La funzione `vedi_tavolo` esiste già, ha i permessi giusti, e fa
  esattamente il lavoro corretto: controlla il gettone segreto e
  restituisce solo la mano del posto richiesto, mai quella dell'altro,
  mai il tallone per intero (solo quante carte contiene).
- La sicurezza delle tabelle (RLS) è già impostata bene su tutto il
  progetto: **nessuna policy** su `partite`, `mosse`, `tavoli`,
  `profili`, `statistiche`. Questo è corretto così — vuol dire che
  nessuno può leggere quelle tabelle direttamente con la chiave
  pubblica, solo attraverso le funzioni scritte apposta. **Non
  aggiungere policy RLS per `tavoli`**: se lo fai, riapri esattamente
  il buco che stiamo chiudendo.

Quello che manca sono due cose, ed è quello che sistemiamo qui:

1. **Aprire un tavolo** (mischiare e distribuire le carte) — richiede la
   logica vera del motore di gioco, in JavaScript. Non si può scrivere
   in modo affidabile in SQL puro senza rischiare che le regole di gioco
   "SQL" e quelle vere (`engine.js`, con i suoi 65 test) vadano fuori
   sincrono nel tempo.
2. **Giocare una mossa** (pescare, calare, scartare) — stesso motivo:
   serve il motore vero.
3. **Far entrare il secondo giocatore** — questa invece è semplice,
   niente motore di gioco, la facciamo in SQL come le altre.

## Passo 1 — la funzione per far entrare il secondo giocatore (5 minuti)

1. Apri il tuo progetto su [supabase.com/dashboard](https://supabase.com/dashboard).
2. Nel menu a sinistra, vai su **SQL Editor**.
3. Clicca **New query**.
4. Apri il file **`entra_tavolo.sql`** (incluso nello zip), copia tutto
   il contenuto e incollalo nell'editor.
5. Clicca **Run** (o Ctrl/Cmd+Invio).
6. Deve dire "Success. No rows returned". Se dà un errore, fermati e
   mandami il messaggio esatto prima di andare avanti.

## Passo 2 — la funzione "tavolo" (apre il tavolo, gioca le mosse)

Questa è una **Edge Function**: un piccolo pezzo di codice che gira sui
server di Supabase, non nel telefono di nessuno, e usa la chiave
segreta di servizio (mai visibile al browser).

1. Nel menu a sinistra, vai su **Edge Functions**.
2. Clicca **Deploy a new function**, poi **Via Editor**.
3. Ti proporrà dei modelli pronti (Stripe, OpenAI, ecc.): ignorali,
   scegli di partire da zero, oppure parti da "Hello World" e cancella
   tutto il contenuto.
4. Come **nome della funzione**, scrivi esattamente: `tavolo`
   (è importante: lo script di prova e, in futuro, l'app si aspettano
   proprio questo nome).
5. Apri il file **`index-dashboard.ts`** (incluso nello zip): è un
   unico file che contiene tutto (motore di gioco + arbitro + il ponte
   con il database) — non serve creare altri file.
6. Seleziona tutto il contenuto di `index-dashboard.ts`, copialo, e
   sostituisci **tutto** il contenuto del file nell'editor del
   Dashboard con questo.
7. Clicca **Deploy function** in basso. Aspetta il messaggio di
   successo (di solito 10-30 secondi).

Non serve toccare nessuna chiave o variabile d'ambiente: `SUPABASE_URL`
e `SUPABASE_SERVICE_ROLE_KEY` sono già disponibili automaticamente a
ogni edge function del progetto.

## Passo 3 — verifica che funzioni

**Opzione A — con lo script (più completo).** Sul tuo computer, apri il
terminale nella cartella dove hai scompattato lo zip, ed esegui:

```bash
chmod +x prova-arbitro.sh
./prova-arbitro.sh
```

Lo script apre un tavolo, fa entrare un secondo giocatore, prova un paio
di cose che devono essere rifiutate (terzo giocatore, gettone sbagliato),
e gioca una mossa vera. Se tutte le risposte hanno senso — soprattutto:
Alice non vede mai le carte di Bob, e viceversa — funziona.

**Opzione B — dal Dashboard, senza terminale.** Su **Edge Functions →
tavolo**, clicca **Test**, metodo POST, corpo:

```json
{"azione":"apri","nome":"Alice"}
```

Dovresti ricevere indietro un `codice` a 4 lettere, un `segreto` lungo,
e la mano di Alice (11 carte). Se invece arriva un errore, guarda il
prossimo paragrafo.

## Se qualcosa non funziona

Su **Edge Functions → tavolo → Logs** trovi i log della funzione: ogni
chiamata, e l'errore esatto se una chiamata fallisce. È il primo posto
dove guardare.

Gli errori più comuni:

- **"tavolo non trovato"** — il codice inserito non esiste, o è scritto
  con lettere diverse (il sistema lo maiuscolizza da solo, ma controlla
  di non aver scambiato una lettera).
- **Errore di permessi sulla tabella `tavoli`** — molto probabilmente il
  Passo 1 non è andato a buon fine: ricontrolla di aver eseguito
  `entra_tavolo.sql` senza errori.
- **La chiamata all'edge function restituisce 401** — controlla di
  passare sia l'header `apikey` sia `Authorization: Bearer <chiave>`
  con la stessa chiave pubblica (quella che inizia con
  `sb_publishable_...`, la trovi in **Settings → API Keys**).

## Cosa NON fare

- Non aggiungere policy RLS sulla tabella `tavoli` (né su `partite` o
  `mosse`): l'accesso deve passare solo dalle funzioni.
- Non cambiare `apri_tavolo`, `siediti`, `manda_mossa`, `sincronizza`,
  `leggi_mosse` (le funzioni vecchie, quelle di `partite`): l'app oggi
  le usa ancora per le partite online in corso, e continueranno a
  servire finché non sposteremo anche l'app sul nuovo sistema.

## E dopo?

Una volta che `./prova-arbitro.sh` passa tutti i controlli, il pezzo
mancante è collegare l'app vera (`src/rete.js` e le parti online di
`src/ui.js`) a queste tre funzioni al posto di quelle vecchie —
compreso salvare il nuovo gettone segreto sul telefono insieme al
codice del tavolo. È un lavoro a parte, meglio farlo insieme un'altra
volta con il backend già collaudato sotto mano, per poterlo provare
davvero da telefono a telefono mentre lo si scrive.
