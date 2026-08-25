# Tavolo da Burraco

### ▶ [Apri l'app — blacklabell.github.io/test](https://blacklabell.github.io/test/)

Burraco italiano contro il computer, uno contro uno o a coppie, con le regole ufficiali.
Gira nel browser, si installa sul telefono e funziona anche senza connessione.

**Versione pubblicata:** `burraco-v10` — 25 agosto 2026
**Costo di gestione: zero.** Nessuna dipendenza da installare, nessun server, nessun account
a pagamento, nessun dominio da comprare.

> **Vedi la versione vecchia?** L'app si salva sul dispositivo per funzionare offline.
> Ricarica tenendo premuto il pulsante di ricarica (su telefono: chiudi e riapri la scheda).
> Il numero di versione qui sopra deve corrispondere a quello scritto in `sw.js`.

---

## Novità

Le voci più recenti stanno in alto. Ogni riga corrisponde a una versione di `sw.js`.

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

- Carte disegnate **a semi veri** (il 7 di cuori con sette cuori disposti come nella carta vera).
- Partita a coppie con i **quattro giocatori a croce**.
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
3. **Alza `VERSIONE` in `sw.js`** (`burraco-v10` → `burraco-v11`). Senza questo passaggio chi ha
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
