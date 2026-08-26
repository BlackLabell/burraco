# Tavolo da Burraco

### ▶ [Apri l'app — blacklabell.github.io/test](https://blacklabell.github.io/test/)

Burraco italiano contro il computer, uno contro uno o a coppie, con le regole ufficiali.
Gira nel browser, si installa sul telefono e funziona anche senza connessione.

**Versione pubblicata:** `burraco-v15` — 26 agosto 2026
**Costo di gestione: zero.** Nessuna dipendenza da installare, nessun server, nessun account
a pagamento, nessun dominio da comprare.

> **Vedi la versione vecchia?** L'app si salva sul dispositivo per funzionare offline.
> Ricarica tenendo premuto il pulsante di ricarica (su telefono: chiudi e riapri la scheda).
> Il numero di versione qui sopra deve corrispondere a quello scritto in `sw.js`.

---

## Novità

Le voci più recenti stanno in alto. Ogni riga corrisponde a una versione di `sw.js`.

### `burraco-v15` — 26 agosto 2026
**I giochi calati sono diventati il doppio o il triplo.** Due mosse, tutte e due sullo spazio:
- **Tallone, monte scarti e pozzetti non stanno più in una fascia in mezzo al tavolo**, ma in una
  colonna stretta sul lato destro. La fascia centrale mangiava 130-170 px di altezza a entrambe le
  fasce dei giochi; di lato non toglie niente, perché in larghezza lo spazio avanza.
- **Punteggio e cronaca sono passati dietro il pulsante *Punti***, anche da computer. La colonna
  di destra è sparita e il tavolo si prende tutta la larghezza dello schermo.

Le carte dei giochi calati, misurate con la partita avviata:

| schermo | prima | adesso |
|---|---|---|
| telefono 390×844 | 28 px | 28-40 px |
| tablet 768×1024 | 34 px | 50 px |
| pc 1280×800 | 18 px | 40 px |
| pc 1440×900 | 30 px | 56 px |
| pc 1920×1080 | 44 px | 64 px |

- La misura non è più decisa a tavolino: si parte da un tetto generoso e si cerca, misurando, la
  più grande alla quale tutti i giochi ci stanno interi.
- Lo stato del turno ("Tocca a te" e il suggerimento) è salito nella riga dell'avversario.
- A coppie, Est e Ovest stanno ai due bordi del campo, prima della colonna dei mazzi.

### `burraco-v14` — 26 agosto 2026
Correzioni trovate col collaudo automatico su sei misure di schermo, dal telefono al 1920.
- **Tablet e finestre strette (761–1000 px):** la colonna laterale finiva *sotto* il tavolo e gli
  rubava metà altezza — le fasce dei giochi restavano alte 21 px. Ora sotto i 1000 px la colonna
  sparisce e punteggio, cronaca e menu passano nei pulsanti in testata, come sul telefono.
- **Nessun gioco tagliato, davvero.** Le carte di una fascia si cercano ora per dimezzamenti la
  misura più grande alla quale *tutti* i giochi ci stanno, righe a capo comprese; se non basta,
  la fascia passa a fila unica che scorre di lato. Al massimo cinque carte per colonna, quindi
  una scala da 13 diventa tre colonne affiancate e resta bassa come un tris.
- **La mano non va mai a capo:** si controlla il risultato vero invece di stimarlo, e non si
  confonde più con l'animazione di distribuzione.
- **A coppie**, la pila di dorsi di Est e Ovest non fa più crescere la banda centrale.

### `burraco-v13` — 26 agosto 2026
- **Una schermata sola anche da computer.** Il tavolo sta dentro l'altezza della finestra a
  qualsiasi misura: non si scorre più né da telefono né da PC. Scorrono, se proprio serve,
  solo la colonna laterale e le fasce dei giochi.
- **Giochi calati molto più grandi.** Di ogni carta si vede la striscia con valore e seme
  scritti di fianco invece che uno sotto l'altro: la striscia è più bassa, quindi a parità di
  spazio le carte sono quasi il doppio. Le scale lunghe si spezzano in **due colonne
  affiancate**, come quando al tavolo si allarga il gioco.
- **La fascia dei vostri giochi è la più grande del tavolo** e le due fasce si contendono
  l'altezza: quando una rimpicciolisce l'altra guadagna, e le carte si riadattano da sole.
- **Via la riga dei pulsanti sotto la mano.** Si cala cliccando la zona dei vostri giochi e si
  scarta cliccando il monte scarti — che è già il modo normale di giocare.
- **Meno scritte:** le fasce si chiamano *Loro* e *Voi*, l'intestazione della mano è il solo
  numero di carte, e i pozzetti sono più piccoli del tallone perché si guardano una volta a mano.

### `burraco-v12` — 25 agosto 2026
- **Quattro giocatori a croce** nella partita a coppie: Nord è il tuo compagno, in alto; Est e
  Ovest sono gli avversari, ai lati del tallone, con la mano di taglio; tu a Sud, in basso.
  Come al tavolo vero.

### `burraco-v11` — 25 agosto 2026
- **Carte a semi veri.** In mano, sui mazzi e nelle finestre i semi sono disposti come sulle
  carte stampate: il 7 di picche ha sette picche nella loro posizione, quelli della metà bassa
  capovolti. Nei giochi calati resta il segno grande, che a quelle misure si legge meglio.
- **Telefono più leggibile.** Le carte in mano valgono circa un quinto della larghezza dello
  schermo (76 px su un telefono da 390) e le carte dei giochi calati sono un terzo più grandi.
- **Nessun gioco tagliato.** Se la scala più lunga non ci sta nella sua fascia, le carte di
  quella fascia rimpiccioliscono da sole quel tanto che basta a farla stare intera.
- **Una riga in meno sotto la mano.** Sono rimasti solo *Cala* e *Scarta*: il cambio d'ordine è
  diventato un pulsante nell'intestazione della mano e il suggerimento è passato sotto
  "Tocca a te", nella banda centrale.
- L'avversario sta di fianco al suo ventaglio invece che sotto, e le figure mostrano la lettera
  grande senza cornice: nel ventaglio mezza cornice sembrava un errore.

### `burraco-v10` — 25 agosto 2026
- **Interfaccia PC più grande.** Due scatti: da 1100 px di larghezza il testo passa a 16,5 px,
  le carte in mano a 82 px (94 nel proprio turno), tallone e scarti a 72 px, le carte dei giochi
  calati crescono del 32 %. Da 1560 px un altro scatto: testo 17,5 px, mano 94 px (108 nel turno),
  mazzi 84 px, giochi calati +52 %. Numeri, semi e figure sono legati alla larghezza della carta,
  quindi crescono insieme senza sfocarsi.

### `burraco-v9` — 25 agosto 2026
- **Telefono a schermata fissa.** La pagina non scorre più: il tavolo occupa esattamente
  l'altezza dello schermo. Testata sottile, punteggio e cronaca dietro il pulsante *Punti*,
  tema e regolamento dietro il menu ☰.
- Tallone, monte scarti e i due pozzetti su **una riga sola**.
- **Mano a ventaglio**: una riga sola con le carte sovrapposte, come quando le tieni in mano.
- Le fasce dei giochi calati si prendono lo spazio che resta e **scorrono di lato**, così nessun
  gioco viene tagliato a metà.

### `burraco-v8` — 24 agosto 2026
- **Regolamento ufficiale** diviso per articoli, con le fonti, dal menu.
- Corretto lo **spostamento della matta**: in una scala come 6-5-2♣-3 la matta incastrata si può
  muovere solo se fra le carte che aggiungi c'è la carta naturale che rappresenta.

### `burraco-v7` — 24 agosto 2026
- **Il mazziere scopre la prima carta** del tallone a inizio mano (Art. 4), così chi comincia può
  già prendere il monte.
- **Fine del tallone**: quando restano due carte la mano finisce (Art. 17).
- Non si chiude più calando l'ultima carta senza scartare.
- Risolto un **vicolo cieco**: con due carte in mano, pozzetto preso e nessun burraco, il motore
  ora impedisce le calate che ti lascerebbero senza scarto possibile.

### `burraco-v6` — 24 agosto 2026
- **Carte classiche**: indice valore+seme in alto a sinistra, ripetuto capovolto in basso a
  destra, segno grande al centro, figure incorniciate.
- **Tutti i giochi in verticale**, tris compresi, senza etichette sotto.
- **Distribuzione animata** e **presa del pozzetto** carta per carta.
- **Turno del computer passo per passo**, con la cronaca che segue.

---

## Da fare

- Animazioni anche per la pescata singola e per la calata.
- **Gioco online** con altre persone.

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

Apri [il sito](https://blacklabell.github.io/test/) e poi:

- **Android / Chrome:** menu ⋮ → *Aggiungi a schermata Home*
- **iPhone / Safari:** *Condividi* → *Aggiungi alla schermata Home*

Da quel momento parte a schermo intero come un'app e funziona anche in aereo.

---

## Lavorarci in locale

```bash
npm start     # apre http://localhost:8080
npm test      # 62 test sul motore di gioco
```

`npm start` usa un piccolo server incluso nel progetto: serve perché i moduli JavaScript e il
service worker non funzionano aprendo `index.html` con doppio clic (`file://`), ma solo via http.
Non c'è niente da installare: `npm install` non serve, il progetto non ha dipendenze.

---

## Com'è fatto

```
index.html               pagina e struttura del tavolo
styles.css               stile, tema chiaro e scuro, blocchi telefono e PC
src/engine.js            motore: regole, combinazioni, punteggi, intelligenza del computer
src/ui.js                interfaccia: disegno del tavolo, clic, finestre, animazioni
sw.js                    service worker: fa funzionare l'app senza connessione
manifest.webmanifest     dati per l'installazione sul telefono
icons/                   icone dell'app
tests/engine.test.js     62 test, girano con Node senza librerie
tools/serve.js           server locale per lo sviluppo
```

Il motore non sa niente dell'interfaccia: si può usare da solo, per esempio per simulare
migliaia di partite. È quello che fanno i test.

---

## Quando modifichi qualcosa

1. Cambia il codice.
2. `npm test` — se un test si rompe, hai toccato una regola.
3. **Alza `VERSIONE` in `sw.js`** (`burraco-v15` → `burraco-v16`). Senza questo passaggio chi ha
   già aperto l'app continua a vedere la versione vecchia presa dalla cache.
4. Aggiungi una voce in **Novità** qui sopra e aggiorna la versione in cima al file.
5. Carica su `main`.

Quando trovi un errore nelle regole, prima scrivi il test che lo mostra, poi correggi: è così
che i 62 test di oggi sono diventati una rete di sicurezza.

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
Burraco pulito 200, semipulito 150, sporco 100. Chiusura +100, pozzetto non preso −100.
Le carte rimaste in mano si sottraggono. Partita a 2005 punti, oppure 1005.

Il regolamento completo diviso per articoli, con le fonti, è dentro l'app: menu ☰ → *Regolamento*.

---

## Licenza

MIT — vedi `LICENSE`. Fanne quello che vuoi.
