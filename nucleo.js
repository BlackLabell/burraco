/* ============================================================
   BURRACO — nucleo dell'arbitro (server-side)
   ============================================================
   Logica pura, senza dipendenze da Deno o da Supabase: la stessa
   funzione gira sia nella edge function vera (index.ts la importa)
   sia nei test locali con un database finto (vedi nucleo.test.js).
   Chi la chiama deve passare un oggetto `db` con questi quattro metodi:

     db.leggi(codice)              -> riga o null
     db.crea(riga)                 -> niente (lancia se il codice esiste già)
     db.aggiorna(codice, campi)    -> niente
     db.tavoloOccupato è deciso qui dentro, non nel db

   La riga salvata ha la forma:
     { codice, nomi: [a,b], segreti: [s0,s1], stato: <G dell'engine>, creata, vista }

   Principio guida: il client manda un'INTENZIONE (pesca, cala, scarta),
   mai lo stato. Il server tiene l'unica verità (g.stato) e restituisce a
   ciascun posto solo quello che gli spetta: la propria mano, mai quella
   dell'altro, mai il tallone, mai i pozzetti non presi. È la stessa
   `engine.js` di sempre (65 test), riusata identica: qui non si
   reinventano le regole, si decide solo chi vede cosa. */

import ENGINE from './engine.js';

const LETTERE = 'ABCDEFGHJKLMNPRSTVWXYZ'; // le stesse 22 lettere di sempre (via I,O,Q,U)

function codiceCasuale() {
  let c = '';
  for (let i = 0; i < 4; i++) c += LETTERE[Math.floor(Math.random() * LETTERE.length)];
  return c;
}

async function codiceLibero(db) {
  for (let giro = 0; giro < 40; giro++) {
    const c = codiceCasuale();
    if (!(await db.leggi(c))) return c;
  }
  throw new Error('non trovo un codice libero');
}

function segretoNuovo() {
  // 2 UUID incollati: più che sufficiente, e funziona identico in Deno e in Node
  return crypto.randomUUID() + crypto.randomUUID();
}

function erroreConCodice(messaggio, codice) {
  const e = new Error(messaggio);
  e.codiceHttp = codice;
  return e;
}

/** Quello che un posto ha diritto di vedere: mai le carte degli altri, mai il
    tallone, mai i pozzetti non presi. Il resto (scarti, calate, cronaca) è
    già pubblico per regolamento — si vede sul tavolo vero allo stesso modo. */
function vistaPer(stato, posto, nomi) {
  return {
    nomi,
    posto,
    turno: stato.turn,
    fase: stato.phase,
    manoNumero: stato.handNo,
    punteggio: stato.matchScore,
    target: stato.target,
    modo: stato.mode,
    finita: stato.finished,
    vincitore: stato.winner,
    tallone: stato.stock.length,
    scarti: stato.discard,
    squadre: stato.teams,
    carteInMano: stato.hands.map(h => h.length),
    mano: stato.hands[posto],
    cronaca: stato.log.slice(-30),
  };
}

function controllaSegreto(riga, posto, segreto) {
  if (posto !== 0 && posto !== 1) throw erroreConCodice('posto non valido', 400);
  if (!riga.segreti[posto] || riga.segreti[posto] !== segreto) {
    throw erroreConCodice('non riconosciuto: segreto sbagliato o partita diversa', 403);
  }
}

export async function apri(db, { modo, target, nome }) {
  const stato = ENGINE.newGame(modo === '2v2' ? '2v2' : '1v1', { target: target || 2005 });
  const codice = await codiceLibero(db);
  const riga = {
    codice,
    nomi: [String(nome || '').slice(0, 14), ''],
    segreti: [segretoNuovo(), null],
    stato,
    versione: 0,   // sale di uno a ogni mossa accettata: il client capisce se è cambiato qualcosa senza confrontare tutto l'oggetto
    creata: new Date().toISOString(),
    vista: new Date().toISOString(),
  };
  await db.crea(riga);
  return { codice, segreto: riga.segreti[0], versione: riga.versione, ...vistaPer(stato, 0, riga.nomi) };
}

export async function entra(db, { codice, nome }) {
  const riga = await db.leggi(String(codice || '').trim().toUpperCase());
  if (!riga) throw erroreConCodice('tavolo non trovato', 404);
  // Una volta occupato il secondo posto, un altro "entra" non lo scavalca:
  // chi era già seduto rientra con `vedi`, non richiamando `entra`.
  if (riga.segreti[1]) throw erroreConCodice('il tavolo è già al completo', 409);
  riga.nomi[1] = String(nome || '').slice(0, 14);
  riga.segreti[1] = segretoNuovo();
  riga.vista = new Date().toISOString();
  await db.aggiorna(riga.codice, { nomi: riga.nomi, segreti: riga.segreti, vista: riga.vista });
  return { codice: riga.codice, segreto: riga.segreti[1], versione: riga.versione || 0, ...vistaPer(riga.stato, 1, riga.nomi) };
}

export async function vedi(db, { codice, posto, segreto }) {
  const riga = await db.leggi(String(codice || '').trim().toUpperCase());
  if (!riga) throw erroreConCodice('tavolo non trovato', 404);
  controllaSegreto(riga, posto, segreto);
  return { versione: riga.versione || 0, ...vistaPer(riga.stato, posto, riga.nomi) };
}

export async function mossa(db, { codice, posto, segreto, mossa: intenzione }) {
  const riga = await db.leggi(String(codice || '').trim().toUpperCase());
  if (!riga) throw erroreConCodice('tavolo non trovato', 404);
  controllaSegreto(riga, posto, segreto);

  // Si prova su una copia: se la mossa è respinta, lo stato salvato non si
  // tocca. Il `posto` che conta è quello autenticato dal segreto, mai quello
  // che il client scrive nella mossa — altrimenti chiunque potrebbe giocare
  // al posto dell'altro.
  const copia = structuredClone(riga.stato);
  let esito;
  try {
    esito = ENGINE.applicaMossa(copia, { ...(intenzione || {}), p: posto });
  } catch (e) {
    esito = { ok: false, error: 'mossa malformata' };
  }
  if (!esito || !esito.ok) {
    return {
      ok: false, errore: (esito && esito.error) || 'mossa non valida',
      versione: riga.versione || 0, ...vistaPer(riga.stato, posto, riga.nomi),
    };
  }
  riga.stato = copia;
  riga.versione = (riga.versione || 0) + 1;
  riga.vista = new Date().toISOString();
  await db.aggiorna(riga.codice, { stato: riga.stato, versione: riga.versione, vista: riga.vista });
  return { ok: true, versione: riga.versione, ...vistaPer(riga.stato, posto, riga.nomi) };
}

export const _test = { codiceCasuale, vistaPer };
