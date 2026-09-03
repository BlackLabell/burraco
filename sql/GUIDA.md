# Metriche contro il Pro — cosa eseguire sul tuo Supabase

Un solo script, stesso metodo di sempre: pannello Supabase, SQL Editor, incolla, Run.

## Passo 1 — `01-metriche-pro.sql`

1. Apri il pannello Supabase del progetto **burraco**.
2. Vai su **SQL Editor** → **New query**.
3. Incolla tutto il contenuto di `01-metriche-pro.sql`.
4. **Run**.

Cosa fa: crea una tabella nuova `metriche_pro` (indipendente da tutto il resto — non tocca
`partite`, `mosse`, `chat`, `profili`, `statistiche`) e una funzione, `manda_metrica_pro`, che
l'app chiama da sola a fine partita. Nessuna delle tabelle o funzioni esistenti viene toccata.

## Dopo aver eseguito lo script

Nessun riavvio da fare: appena pubblichi il codice di questo zip (`src/rete.js`, `src/ui.js`),
ogni volta che tu (o chi gioca con l'app) finisce una partita **1 contro 1, offline, contro il
livello Pro** (il più forte), l'app manda da sola un piccolo riepilogo — punteggio, chi ha
vinto, quante volte il Pro ha preso dal monte scarti invece che dal tallone. Non succede per
nessun'altra combinazione (non online, non contro gli altri tre livelli, non in 2v2 per ora) e
non blocca né rallenta mai la partita: se manca la rete, la metrica si perde in silenzio, non
succede niente di visibile.

## Come guardare i dati raccolti

Non c'è una schermata nell'app apposta (con poche partite alla volta non serve): apri **SQL
Editor** → **New query** sul pannello Supabase e incolla una query come questa:

```sql
select creata, nome, punti_umano, punti_computer, vincitore,
       turni_totali, prese_monte_computer, prese_tallone_computer, versione
from public.metriche_pro
order by creata desc
limit 50;
```

Un colpo d'occhio utile — quante volte su dieci il Pro vince, e quanto prende dal monte in
media:

```sql
select
  count(*) as partite,
  round(100.0 * count(*) filter (where vincitore = 'computer') / count(*), 1) as pro_vince_pct,
  round(avg(prese_monte_computer), 1) as prese_monte_medie,
  round(avg(prese_monte_computer::float / nullif(prese_monte_computer + prese_tallone_computer, 0)) * 100, 1) as pct_prese_dal_monte
from public.metriche_pro;
```

## Se vuoi tornare indietro

`drop table public.metriche_pro;` cancella tutto (tabella e dati). Non serve normalmente, ma è
lì se serve.
