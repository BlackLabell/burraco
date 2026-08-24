# Tavolo da Burraco

Burraco italiano contro il computer, uno contro uno o a coppie, con le regole ufficiali.
Gira nel browser, si installa sul telefono e funziona anche senza connessione.

**Costo di gestione: zero.** Nessuna dipendenza da installare, nessun server, nessun account
a pagamento, nessun dominio da comprare.

---

## Pubblicarla gratis su GitHub Pages

Serve solo un account GitHub gratuito. Dall'inizio alla fine sono dieci minuti.

1. **Crea il repository.** Su GitHub, *New repository* → nome `burraco` → visibilità **Public**
   (le Pages sono gratuite solo sui repository pubblici) → *Create*.

2. **Carica i file.** Dalla cartella del progetto:

   ```bash
   git init -b main
   git add .
   git commit -m "Prima versione"
   git remote add origin https://github.com/TUONOME/burraco.git
   git push -u origin main
   ```

   Se preferisci evitare la riga di comando: sulla pagina del repository vuoto usa
   *uploading an existing file* e trascina dentro tutta la cartella.

3. **Accendi le Pages.** Nel repository: *Settings* → *Pages* → in *Source* scegli
   **Deploy from a branch**, ramo `main`, cartella `/ (root)` → *Save*.

4. **Aspetta un minuto.** L'indirizzo sarà `https://TUONOME.github.io/burraco/`.
   Da lì l'app si può installare sul telefono: in Chrome *Aggiungi a schermata Home*,
   su iPhone in Safari *Condividi* → *Aggiungi alla schermata Home*.

Da questo momento ogni `git push` aggiorna il sito da solo, e i test girano automaticamente
a ogni push grazie a `.github/workflows/test.yml` (Actions è gratuito sui repository pubblici).

### Alternative, sempre gratuite

- **Netlify** o **Cloudflare Pages**: trascini la cartella e sei online, senza Git.
- **Il file unico** `burraco.html` (se lo hai ancora) funziona con un doppio clic, ma senza
  service worker: niente installazione sul telefono.

---

## Lavorarci in locale

```bash
npm start     # apre http://localhost:8080
npm test      # 46 test sul motore di gioco
```

`npm start` usa un piccolo server incluso nel progetto: serve perché i moduli JavaScript e il
service worker non funzionano aprendo `index.html` con doppio clic (`file://`), ma solo via http.
Non c'è niente da installare: `npm install` non serve, il progetto non ha dipendenze.

---

## Com'è fatto

```
index.html               pagina e struttura del tavolo
styles.css               stile, tema chiaro e scuro
src/engine.js            motore: regole, combinazioni, punteggi, intelligenza del computer
src/ui.js                interfaccia: disegno del tavolo, clic, finestre
sw.js                    service worker: fa funzionare l'app senza connessione
manifest.webmanifest     dati per l'installazione sul telefono
icons/                   icone dell'app
tests/engine.test.js     46 test, girano con Node senza librerie
tools/serve.js           server locale per lo sviluppo
```

Il motore non sa niente dell'interfaccia: si può usare da solo, per esempio per simulare
migliaia di partite. È quello che fanno i test.

---

## Quando modifichi qualcosa

1. Cambia il codice.
2. `npm test` — se un test si rompe, hai toccato una regola.
3. **Alza `VERSIONE` in `sw.js`** (`burraco-v1` → `burraco-v2`). Senza questo passaggio chi ha
   già aperto l'app continua a vedere la versione vecchia presa dalla cache.
4. `git push`.

Quando trovi un errore nelle regole, prima scrivi il test che lo mostra, poi correggi: è così
che i 46 test di oggi sono diventati una rete di sicurezza.

---

## Regole implementate

108 carte (due mazzi francesi più 4 jolly), 11 carte a testa, due pozzetti da 11.
Scale da 3 a 13 carte dello stesso seme, tris da 3 a 8 carte uguali, una sola matta per gioco.
Il 2 del seme in posizione naturale non conta come matta e la matta si sposta da sola quando
arriva la carta che rappresenta. Pozzetto preso quando si finiscono le carte, "al volo" se si
finisce senza scartare. Per chiudere servono pozzetto preso, almeno un burraco e mano vuota;
non si chiude scartando una matta.

Punti: jolly 30, pinella 20, asso 15, dall'8 al re 10, dal 3 al 7 cinque.
Burraco pulito 200, semipulito 150, sporco 100. Chiusura +100, pozzetto non preso −100.
Le carte rimaste in mano si sottraggono. Partita a 2005 punti, oppure 1005.

---

## Licenza

MIT — vedi `LICENSE`. Fanne quello che vuoi.
