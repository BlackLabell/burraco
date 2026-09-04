# Tavolo da Burraco

### ▶ [Apri l'app — blacklabell.github.io/burraco](https://blacklabell.github.io/burraco/)

Burraco italiano con le regole ufficiali: **contro il computer** (uno contro uno o a coppie,
con quattro livelli di difficoltà) oppure **online in due**, con un codice di quattro lettere da
dettare all'altro. Gira nel browser, si installa sul telefono e contro il computer funziona
anche senza connessione.

**Versione pubblicata:** `burraco-v38` — 4 settembre 2026
**Costo di gestione: zero.** Nessuna dipendenza da installare, nessun server proprio, nessun
account a pagamento, nessun dominio da comprare.

> **Il repository si chiamava `test`** ed è stato rinominato `burraco`: il vecchio indirizzo
> `blacklabell.github.io/test/` non è più quello buono. Se hai l'icona sul telefono, toglila e
> reinstallala dal nuovo indirizzo: quella vecchia continuerebbe a mostrarti la copia salvata.
>
> **Vedi la versione vecchia?** L'app si salva sul dispositivo per funzionare offline.
> Ricarica tenendo premuto il pulsante di ricarica (su telefono: chiudi e riapri la scheda).
> Il numero di versione qui sopra deve corrispondere a quello scritto in `sw.js`.

---

## Cosa fa oggi l'app

### Al tavolo, contro il computer

Uno contro uno o a coppie (quattro posti a croce: tu a sud, il tuo compagno a nord, gli
avversari a est e ovest). Prima di iniziare si sceglie, posto per posto, uno dei **quattro
livelli del computer**:

- **Facile** — cala tutto quello che può appena può, pesca senza troppi calcoli, scarta solo
  pensando a cosa gli serve. Se in cima al monte scarti c'è una matta (jolly o due) la prende
  quasi sempre, anche senza un motivo preciso — è troppo preziosa per lasciarla lì. Un
  avversario onesto per chi sta imparando.
- **Medio** — non spreca una matta su un burraco che si chiuderebbe comunque da solo con la
  carta naturale, non svela subito tutte le combinazioni che ha in mano (una apertura debole a
  turno), nello scarto pesa parecchio il rischio di regalare punti all'avversario, e come il
  Facile prende quasi sempre il monte se la carta scoperta in cima è una matta.
- **Difficile** — in più osserva cosa prende l'avversario dal monte scarti per scartare più al
  sicuro, cala tutto insieme quando conviene mostrare le carte, rincorre il pozzetto "al volo"
  quando è a portata, decide se chiudere in fretta o inseguire punti guardando il punteggio
  della partita, e gioca in ampiezza: raccoglie molto più volentieri dal monte scarti per avere
  sempre materiale pronto per il gioco più lungo e più pulito possibile. Batte chiaramente sia
  Medio sia Facile — non solo sulla carta, verificato facendoli giocare centinaia di partite fra
  loro (`tools/simula-livelli.js`).
- **Pro** — stessa base decisa del Difficile (cala sempre tutto quello che può, nell'ordine
  giusto, raccoglie ancora più volentieri dal monte scarti), ma per le scelte più delicate —
  vale la pena usare questa matta adesso? conviene prendere questo monte o rischiare il tallone?
  quale carta scartare — non segue soglie scritte a tavolino: **prova davvero la mossa su una
  copia della partita e guarda a cosa porta** (`valoreStato`/`valutaMossa` in `src/engine.js`,
  ancora chiamato "Pro 2" nel nome interno delle funzioni), prima di deciderla. Batte il
  Difficile e il Medio nelle partite fra computer — verificato con `tools/simula-livelli.js`,
  vedi i numeri in `claude/offline-livelli-ia.md` nel progetto. **Contro un umano vero, giocando
  con Fabio, prendeva dal monte scarti in modo troppo aggressivo** anche quando non gli serviva
  (bastavano poche carte di scarso valore per farlo abboccare) — soglia corretta il 3 settembre
  2026, in attesa di conferma da partite vere: dettaglio in `claude/offline-livelli-ia.md`.

La scelta si ricorda da una partita all'altra, e il livello di ogni computer è scritto accanto
al suo nome durante la partita. **Nessuno dei quattro livelli legge mai le carte in mano a un
altro giocatore**, compagno di squadra compreso: ognuno ragiona solo sulla propria mano più
tutto quello che è già pubblico sul tavolo (giochi calati, monte scarti, quante carte ha in
mano ciascun altro, punteggio, chi ha preso cosa) — niente rete neurale, niente apprendimento
automatico, solo regole scritte a mano (anche il livello 4, che "prova le mosse" ma sempre
dentro regole fisse, non impara nulla da una partita all'altra), come il resto del motore.

Il tavolo si distribuisce come al vero: si mischia, si alza, si fanno i pozzetti carta per
carta, poi le mani in giro; si può saltare toccando lo schermo. Ogni mossa — pescata, calata,
scarto, turno del computer — si vede volare invece di comparire di colpo. C'è musica di
sottofondo e gli effetti delle carte, costruiti dal browser al momento (nessun file audio da
scaricare), disattivabili dal menu. Il computer si prende un tempo diverso a ogni turno, mai
istantaneo. Il regolamento ufficiale, diviso per articoli e con le fonti, è nel menu ☰. Dal menu
☰ si può anche **abbandonare la partita** in corso in ogni momento: si torna alla schermata
iniziale e non viene più riproposta da "Riprendi la partita".

### Online in due

Dalla schermata iniziale, *Gioca online* → **Apri un tavolo** dà un codice di quattro lettere;
l'altro lo scrive e si siede — niente iscrizione, niente ricerca di avversari, si gioca con chi
si conosce. Se l'app si chiude o cade la linea, si rientra al tavolo dalla schermata iniziale:
si ricostruisce da capo rileggendo le mosse, nessuno perde la partita, e in alto compare per
qualche secondo un avviso con l'ultima mossa fatta (per esempio "Marco ha pescato dal tallone e
scartato il 7♦"), così si riparte sapendo subito a che punto era rimasta. Anche online, dal menu
☰, si può abbandonare la partita in ogni momento.

**A tempo, se si vuole.** Chi apre il tavolo può scegliere un limite per turno — 30, 45 o 60
secondi, oppure nessun limite (come oggi). Il countdown si vede accanto a chi deve muovere; se il
tempo scade il turno passa **d'ufficio**: si pesca dal tallone (mai dal monte scarti) e si scarta
in automatico la carta meno utile secondo la stessa logica del computer di livello Medio, senza
calare nulla. Dopo **tre turni d'ufficio di fila** la partita si chiude da sola, senza vincitore,
e lo dice a entrambi — capita solo se uno dei due sparisce davvero, per non lasciare l'altro a
guardare un tavolo fermo all'infinito.

**Due parole in chat.** Un tasto 💬 vicino al proprio posto apre un elenco di frasi fisse e
faccine già pronte (saluti, commenti di gioco, cortesia, qualche sfottò) — non si scrive testo
libero. Le frasi appaiono in un fumetto sopra chi le manda, con un piccolo suono, e si può
disattivarle dal tavolo con un tasto muto se danno fastidio. Solo online: contro il computer non
c'è nessuno con cui parlare.

**La partita finita è finita**: quando una partita arriva al traguardo (2005 o 1005 punti), sia
offline sia online, la schermata iniziale smette da sola di offrire di riprenderla o di
rientrarci — non serve fare niente.

**Pausa, con l'accordo di entrambi.** Dal menu ☰, un tasto mette in pausa il tavolo — nessuno dei
due può più muovere, ed è fermo anche il tempo del turno — ma parte solo se l'altro accetta: un
dialogo dedicato gli chiede sì o no. Farlo ripartire funziona allo stesso modo, di nuovo con
l'accordo di entrambi: chi vuole riprendere chiede, l'altro accetta o rifiuta. Non serve nessuna
connessione in più: la pausa viaggia come una mossa qualunque, quindi chi rientra a un tavolo la
ritrova già giusta.

**Se la connessione va e viene.** Dal 4 settembre 2026, se il telefono non riesce per qualche
secondo a leggere le mosse dell'altro, l'app lo dice (un avviso sotto "Tocca a te") invece di far
finta di niente — e soprattutto non esegue più un turno d'ufficio "alla cieca" mentre la lettura
sta fallendo: aspetta di sapere per certo che l'altro non ha già mosso, prima di farlo al posto
suo. Prima poteva succedere, con una connessione instabile abbastanza a lungo, che le due partite
si sfasassero (un giocatore non vedeva quello che l'altro aveva calato davvero).

### Conto e statistiche

Un conto (email e password) è facoltativo e serve a una cosa sola: portare nome e statistiche
da un telefono all'altro. Senza conto si gioca lo stesso, e le statistiche si contano comunque
in locale — partite giocate/vinte/perse, mani chiuse, burrachi per tipo, punti totali e medi,
mano migliore, serie di vittorie — anche offline, anche contro il computer.

### Metriche: partite contro il Pro

A fine partita **1 contro 1, offline, contro il livello Pro** (il più forte del computer) l'app
manda da sola, in silenzio, un piccolo riepilogo: punteggio finale, chi ha vinto, quante volte il
Pro ha preso dal monte scarti invece che dal tallone. Non succede per nessun'altra combinazione
(non online, non contro gli altri tre livelli, non in 2v2 per ora), e non blocca né rallenta mai
la partita — se manca la rete, il riepilogo si perde senza che nessuno se ne accorga. Serve solo
a capire come gioca il Pro contro un umano vero, per ritoccarlo — è così che è stata trovata e
corretta la sua eccessiva aggressività nel prendere dal monte scarti (vedi
`claude/offline-livelli-ia.md`). Niente dashboard nell'app: i dati si guardano dal pannello
Supabase, con una query SQL (vedi la guida consegnata insieme allo script).

### Il resto

Login in alto a sinistra, tema chiaro e scuro (con buon contrasto in entrambi), installabile sul
telefono come un'app vera (icona propria, schermo intero, funziona in aereo contro il computer).
Il tasto «segnala un problema» (apriva un'email) è stato tolto il 3 settembre 2026 su richiesta
di Fabio — non gli piaceva che aprisse il client di posta.

## Cosa c'è sotto

```
index.html               pagina, schermata iniziale e tavolo
styles.css                stile, tema chiaro e scuro (una pianta sola, tarata sul telefono)
src/engine.js             motore: regole, combinazioni, punteggi, IL COMPUTER, registro mosse
src/ui.js                 interfaccia: disegno del tavolo, clic, finestre, animazioni, online
src/rete.js               gioco online: apre il tavolo, manda e legge le mosse
src/conto.js               registrazione e accesso, sessione sul telefono
src/statistiche.js        il conto delle partite, anche senza conto e senza rete
src/suoni.js              musica ed effetti, costruiti dal browser: nessun file audio
sw.js                     service worker: fa funzionare l'app senza connessione
manifest.webmanifest      dati per l'installazione sul telefono
icons/                    icone dell'app
tests/engine.test.js      motore e regole di gioco
tests/livelli.test.js     le regole dei quattro livelli del computer, una per una
tools/serve.js            server locale per lo sviluppo
tools/finto-supabase.js   copia locale del servizio online, per i collaudi senza rete
tools/simula-livelli.js   fa giocare i quattro livelli fra loro centinaia di volte e conta chi vince
.github/workflows/        test a ogni caricamento, e la sveglia del servizio online
```

**Il motore (`src/engine.js`) non sa niente dell'interfaccia**: è una funzione pura, senza
dipendenze, che gira identica nel browser e in Node — si può usare da solo, per esempio per far
giocare migliaia di partite di fila (è quello che fa `tools/simula-livelli.js`). Ogni mossa
viene annotata in un registro minimo (chi, cosa, quali carte): con il seme del mazzo, quel
registro basta a ricostruire la mano carta per carta. È il meccanismo dietro **l'annulla**
(si ricostruisce la mano fino a un turno prima), il **rientro** in una partita online, e il
gioco online stesso — fra i due telefoni non viaggia il tavolo, viaggiano le mosse, poche
decine di byte l'una, ognuna applicata dall'altro telefono con lo stesso motore.

**Sezione "IL COMPUTER" del motore**: quattro livelli (Facile/Medio/Difficile/Pro), scelti da chi
apre la partita in `g.livelli` (mai cambiati durante il gioco, mai indovinati). Vincolo che vale per
tutte le funzioni della sezione, senza eccezioni: ognuna riceve la partita e il posto, e legge
solo la mano di quel posto — tutto il resto che i livelli più alti usano in più (giochi calati,
monte scarti, punteggio, chi ha preso cosa dal monte) è informazione già pubblica. Verificato
sia leggendo il codice sia con un test dedicato. Un accorgimento tecnico, non una regola di
gioco: il computer evita — se ha altre carte fra cui scegliere — di riscartare subito la carta
appena presa dal monte, per non ripetere il loop di prendi-e-ributta visto in partite vere. Un
umano non ha questo limite: può ributtarla subito se vuole.

**Online**: sette funzioni SQL su Supabase (progetto `burraco`, piano gratuito, server in
Germania) — `apri_tavolo` (che ora accetta anche un limite di tempo per turno, facoltativo),
`siediti`, `guarda_tavolo`, `manda_mossa`, `leggi_mosse`, e le due della chat, `manda_chat` e
`leggi_chat` — parlate solo da `fetch`, nessuna libreria. Le tabelle non si toccano mai
direttamente: senza il codice del tavolo non si ottiene niente. La chat vive in una tabella a
parte (`chat`), letta nello stesso giro di polling delle mosse — non aggiunge traffico proprio.
Il motore gira sui due telefoni, non su un server: fra amici va benissimo — ogni telefono
rifiuta le mosse non regolari — ma chi apre la console del browser può vedere le carte
dell'altro; un "arbitro" lato server che tolga anche questo è pronto come guida e codice (vedi
*Funzionalità future*) ma non ancora collegato al client.

**Conto**: email e password gestite da Supabase Auth; nel database ci sono solo `profili` (il
nome al tavolo) e `statistiche`, e si toccano solo attraverso funzioni che guardano da sole chi
sta chiamando — non c'è modo di chiedere o cambiare i numeri di un altro giocatore. La password
non passa mai dall'app: sul telefono restano solo i due gettoni della sessione.

**Collaudi**: `tools/finto-supabase.js` parla la stessa lingua del servizio vero — registrazione
e accesso compresi — ma tiene tutto in memoria, così la partita online e il giro del conto si
provano anche su una macchina senza internet. Ogni notte i tavoli fermi da due giorni vengono
cancellati, e due volte a settimana il workflow `sveglia.yml` bussa al servizio: il piano
gratuito mette in pausa i progetti fermi da una settimana, e senza quella bussata il gioco
online smetterebbe di funzionare fino a riaccenderlo a mano.

> **Una cosa da fare una volta sola, nel pannello Supabase.** In *Authentication → Sign In /
> Providers → Email*, se **Confirm email** è acceso, chi si registra deve prima aprire il
> collegamento che gli arriva per posta — e la posta di prova di Supabase è molto limitata.
> Per un uso fra amici conviene spegnerlo; per aprire al pubblico conviene invece lasciarlo
> acceso e collegare un servizio di posta vero (SMTP), che serve comunque per il "password
> dimenticata". L'app funziona in tutti e due i casi: se la conferma è richiesta, dopo la
> registrazione lo dice e invita a controllare la posta.

---

## Funzionalità future

In ordine di priorità (vedi il piano completo nel progetto Claude):

- **Verificare il livello Pro contro un umano**: prendeva dal monte scarti in modo troppo
  aggressivo, sfruttabile da un avversario vero. Corretta il 3 settembre 2026 la soglia di
  valore che lo faceva abboccare (da 15 a 24) e il margine del controllo dinamico (da 4 a 8):
  nei test automatici il vantaggio sul Difficile è sceso da 74,6% a 59,7% su 300 partite — un
  compromesso accettato di proposito, perché l'obiettivo è reggere contro Fabio, non contro gli
  altri livelli del computer. **In attesa di conferma da partite vere** — se dopo qualche
  partita risulta ancora troppo debole, o troppo ammorbidito rispetto agli altri livelli,
  si ritocca ancora. Dettaglio in `claude/offline-livelli-ia.md`.
- **Arbitro sul server**: guida e codice consegnati (tabella `tavoli`, funzioni SQL e una edge
  function). Prossimo passo, una volta che Fabio conferma che i tre passi della guida
  funzionano: collegare `src/rete.js` e le parti online di `src/ui.js` al nuovo sistema.
- ~~Metriche minime~~ — fatto (`burraco-v37`), ma con uno scopo più stretto di quanto pensato
  all'inizio: non appoggiate all'arbitro (non ancora collegato), solo le partite 1v1 offline
  contro il Pro — vedi "Metriche: partite contro il Pro" più sopra.
- **Pozzetti a croce** al posto della fascia centrale — solo se dopo i test con gli amici
  risulta che la fascia attuale dà davvero un problema.
- **Verificare *Confirm email*** nel pannello Supabase (vedi sopra) prima di aprire l'app a
  persone nuove.
- **Informativa privacy e condizioni d'uso**: obbligatorie da quando si raccoglie un'email.
- **Schermo orizzontale**: con la fascia in mezzo, il telefono girato va rimisurato da capo.
- **Trova avversario**, per chi vuole giocare online senza un amico a portata di codice.
- **Una versione a parte per il computer**: oggi il PC mostra la stessa pianta pensata per il
  telefono, centrata. Il passo successivo è una pianta pensata per lo schermo largo.
- **Online anche a coppie** (quattro posti, con il computer di riserva per chi manca).
- **WebSocket al posto del polling**, quando il traffico lo richiederà davvero (non prima di
  scalare oltre un piccolo gruppo di tester).

Idee valutate e scartate per ora: quattro colori per i semi, vibrazione, una classifica
(inviterebbe a barare, dato che oggi i numeri li dichiara il telefono).

---

## Aggiornare il sito

Il sito è pubblicato da GitHub Pages a partire dal ramo `main`, cartella radice.
Ogni modifica caricata su `main` va online da sola in circa un minuto.

**Dal browser** (senza installare niente):

1. *Add file → Upload files* sulla pagina del repository.
2. Trascina dentro i file cambiati.
3. Scrivi una riga che dica cosa hai fatto e premi *Commit changes*.
4. Aspetta un minuto e ricarica il sito tenendo premuto il pulsante di ricarica.

**Da riga di comando:**

```bash
git add .
git commit -m "cosa hai cambiato"
git push
```

Se GitHub è nuovo per te, [la spiegazione da zero è qui](https://claude.ai/code/artifact/fee9ff02-1a7d-42d5-9e78-bd6a4595096e):
repository, commit, ramo, pull request, merge e Pages, con questo repository come esempio.

> **Attenzione:** i file che iniziano con un punto (`.github/`, `.nojekyll`) **non si possono
> caricare trascinandoli**: GitHub li salta. Si creano da *Add file → Create new file*
> scrivendo il percorso completo nel campo del nome.

---

## Installarla sul telefono

Apri [il sito](https://blacklabell.github.io/burraco/) e poi:

- **Android / Chrome:** menu ⋮ → *Aggiungi a schermata Home*
- **iPhone / Safari:** *Condividi* → *Aggiungi alla schermata Home*

Da quel momento parte a schermo intero come un'app e funziona anche in aereo.

---

## Lavorarci in locale

```bash
npm start     # apre http://localhost:8080
npm test      # 109 test: motore di gioco + le regole dei quattro livelli del computer
```

`npm start` usa un piccolo server incluso nel progetto: serve perché i moduli JavaScript e il
service worker non funzionano aprendo `index.html` con doppio clic (`file://`), ma solo via http.
Non c'è niente da installare: `npm install` non serve, il progetto non ha dipendenze.

Per verificare che i quattro livelli del computer siano davvero ordinati come devono essere
(Pro batte Difficile batte Medio batte Facile, non solo sulla carta): `node tools/simula-livelli.js`.

---

## Quando modifichi qualcosa

1. Cambia il codice.
2. `npm test` — se un test si rompe, hai toccato una regola.
3. **Alza `VERSIONE` in `sw.js`** (es. `burraco-v27` → `burraco-v28`). Senza questo passaggio
   chi ha già aperto l'app continua a vedere la versione vecchia presa dalla cache.
4. Aggiorna questo README se hai cambiato una funzionalità, e la versione in cima al file.
5. Carica su `main`.

Quando trovi un errore nelle regole, prima scrivi il test che lo mostra, poi correggi: è così
che i test di oggi sono diventati una rete di sicurezza. Per il computer vale lo stesso, ma con
un test in più da controllare: se cambi come gioca un livello, fai girare anche
`tools/simula-livelli.js` — un test unitario dice se una regola singola funziona, la
simulazione dice se il livello vince davvero di più in pratica.

---

## Regole implementate

108 carte (due mazzi francesi più 4 jolly), 11 carte a testa, due pozzetti da 11.
Il mazziere scopre la prima carta del tallone (Art. 4). Scale da 3 a 13 carte dello stesso seme,
tris da 3 a 8 carte uguali, una sola matta per gioco. Il 2 del seme in posizione naturale non
conta come matta; la matta incastrata si sposta solo se fra le carte aggiunte c'è la carta
naturale che rappresenta. Pozzetto preso quando si finiscono le carte, "al volo" se si finisce
senza scartare. Quando nel tallone restano due carte la mano finisce (Art. 17). Per chiudere
servono pozzetto preso, almeno un burraco e mano vuota; non si chiude scartando una matta né
calando l'ultima carta senza scarto.

Punti: jolly 30, pinella 20, asso 15, dall'8 al re 10, dal 3 al 7 cinque.
Burraco pulito 200, semipulito (matta a un'estremità, almeno 7 naturali di fila) 150, sporco 100.
Chiusura +100, pozzetto non preso −100.
Le carte rimaste in mano si sottraggono. Partita a 2005 punti, oppure 1005.

Il regolamento completo diviso per articoli, con le fonti, è dentro l'app: menu ☰ → *Regolamento*.

---

## Licenza

MIT — vedi `LICENSE`. Fanne quello che vuoi.
