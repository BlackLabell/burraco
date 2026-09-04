# Guida — eseguire lo script SQL delle segnalazioni

Un solo script, `01-segnalazioni.sql`, da eseguire **una volta sola** prima di pubblicare la
consegna `lavoro-segnala-problema`. Finché non lo esegui, il tasto "🐞 Segnala" nell'app non
romperà nulla: il messaggio semplicemente non riuscirà a essere inviato (mostra un avviso
"Non sono riuscito a inviarla…") finché lo script non è stato eseguito.

## Passi

1. Vai sul pannello di Supabase del progetto (quello di sempre, lo stesso di conto, statistiche
   e gioco online).
2. Nel menu a sinistra, apri **SQL Editor**.
3. Clicca **New query**.
4. Apri il file `01-segnalazioni.sql` di questa consegna, copia tutto il contenuto e incollalo
   nella finestra dell'editor.
5. Clicca **Run** (o il tasto play in alto a destra dell'editor).
6. Deve comparire "Success. No rows returned" (o simile) senza errori in rosso.

Fatto: da questo momento il tasto "Segnala un problema" nell'app funziona.

## Come leggere le segnalazioni arrivate

Non c'è (ancora) una schermata nell'app per guardarle: con poche segnalazioni alla volta, la via
più semplice è una query diretta dallo stesso SQL Editor:

```sql
select creato_a, testo, versione, dispositivo, mosse
from segnalazioni
order by creato_a desc
limit 50;
```

Ogni riga ha: quando è arrivata, il testo scritto dalla persona, la versione dell'app in quel
momento, una riga con dispositivo e dimensioni della finestra, e — se chi ha scritto stava
giocando — le ultime 15 mosse della partita in corso (utile per capire cosa stava succedendo,
come già facevano le vecchie email).

## Se in futuro serve ripulire le segnalazioni vecchie

Non c'è nessuna pulizia automatica per questa tabella (a differenza di `pulisci_tavoli()`, che
gira ogni notte per i tavoli online): le segnalazioni sono poche e a bassissimo volume, quindi
per ora si tengono tutte. Se dovessero accumularsi troppe, una query manuale come questa le
cancella oltre i 6 mesi:

```sql
delete from segnalazioni where creato_a < now() - interval '6 months';
```
