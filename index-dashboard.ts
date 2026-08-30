// Burraco — edge function "tavolo": l'arbitro sul server.
//
// File UNICO, pensato per essere incollato così com'è nell'editor del
// Dashboard di Supabase (Edge Functions → Deploy a new function → Via
// Editor), senza bisogno di CLI né di più file.
//
// Contiene, in ordine: 1) il motore di gioco (identico a src/engine.js,
// 65 test, invariato) — 2) la logica dell'arbitro (chi vede cosa, chi può
// giocare) — 3) il ponte con Postgres e con la rete.
//
// Il client manda un'azione: "apri" (apre un tavolo nuovo, pesca le
// carte) oppure "mossa" (pesca / cala / scarta). Per GUARDARE il tavolo
// e per FAR ENTRARE il secondo giocatore si usano invece due funzioni
// SQL più leggere, già pronte: vedi_tavolo (già esistente) e
// entra_tavolo (nuova, vedi la guida).

// ============================================================
// PARTE 1 — motore di gioco (src/engine.js, non modificato)
// ============================================================

/* ============================================================
   BURRACO — motore di gioco (regole ufficiali italiane)
   Nessuna dipendenza. Usato sia da Node (test) sia dal browser.
   ============================================================ */

/* ---------- Carte ---------- */
// r: 0 = jolly, 2..14 (11=J, 12=Q, 13=K, 14=A)
// s: 'C','Q','F','P'  (cuori, quadri, fiori, picche) — 'J' per il jolly
const SUITS = ['C', 'Q', 'F', 'P'];
const SUIT_SYM = { C: '♥', Q: '♦', F: '♣', P: '♠', J: '★' };
const SUIT_RED = { C: true, Q: true, F: false, P: false, J: false };
const RANK_LABEL = { 0: 'Jolly', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

function cardValue(c) {
  if (c.r === 0) return 30;   // jolly
  if (c.r === 2) return 20;   // pinella
  if (c.r === 14) return 15;  // asso
  if (c.r >= 8) return 10;    // 8,9,10,J,Q,K
  return 5;                   // 3..7
}
function isJolly(c) { return c.r === 0; }
function isPinella(c) { return c.r === 2; }
/** Una carta può fare da matta: jolly sempre, 2 quando non è in posizione naturale. */
function canBeWild(c) { return c.r === 0 || c.r === 2; }
function cardLabel(c) { return c.r === 0 ? 'Jolly' : RANK_LABEL[c.r] + SUIT_SYM[c.s]; }

function buildDeck() {
  const deck = [];
  let id = 0;
  for (let d = 0; d < 2; d++) {
    for (const s of SUITS) for (let r = 2; r <= 14; r++) deck.push({ id: id++, r, s });
    deck.push({ id: id++, r: 0, s: 'J' });
    deck.push({ id: id++, r: 0, s: 'J' });
  }
  return deck; // 108 carte
}

/* ---------- RNG deterministico (per i test e per il replay) ---------- */
function makeRng(seed) {
  let x = (seed >>> 0) || 123456789;
  return function () {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ============================================================
   VALIDAZIONE COMBINAZIONI
   Un gioco è una SCALA (3+ carte consecutive stesso seme) o un
   TRIS (3+ carte di uguale valore). Ogni gioco può contenere al
   massimo UNA matta; la pinella in posizione naturale non conta
   come matta.
   Il solver ricalcola l'assetto migliore ogni volta che si
   aggiungono carte: questo realizza automaticamente lo
   spostamento della matta quando arriva la carta che rappresenta.
   ============================================================ */

const MAX_SET = 8;   // massimo 8 carte uguali
const MAX_SEQ = 13;  // massimo 13 carte in scala

/** Posizione di una carta naturale in scala. pos 1 = Asso basso, 14 = Asso alto. */
function naturalRankAt(pos) { return pos === 1 || pos === 14 ? 14 : pos; }

/**
 * Prova a comporre una SCALA con tutte le carte fornite.
 * Ritorna {type:'seq', suit, start, slots:[{card, pos, wild}], matte} oppure null.
 */
function solveSeq(cards) {
  const n = cards.length;
  if (n < 3 || n > MAX_SEQ) return null;
  let best = null;

  for (const suit of SUITS) {
    // scarto rapido: ogni carta deve essere del seme, oppure poter fare da matta.
    // nello stesso giro calcoliamo l'intervallo di partenze possibili: ogni carta
    // naturale occupa una posizione fissa, quindi start ∈ [pos-n+1, pos].
    let ok = true, loStart = 1, hiStart = 15 - n;
    for (const c of cards) {
      if (c.s !== suit) { if (!canBeWild(c)) { ok = false; break; } continue; }
      if (c.r === 0) continue;
      if (c.r === 14) continue;              // l'asso sta a 1 oppure a 14
      if (c.r === 2 && c.s === suit) continue; // il 2 può essere naturale o matta
      const p = c.r;
      if (p - n + 1 > loStart) loStart = p - n + 1;
      if (p < hiStart) hiStart = p;
    }
    if (!ok || loStart > hiStart) continue;
    if (loStart < 1) loStart = 1;

    for (let start = loStart; start <= hiStart; start++) {
      const used = new Array(n).fill(false);
      const slots = new Array(n).fill(null);

      const rec = (i, matte) => {
        if (matte > 1) return false;
        if (i === n) return true;
        const pos = start + i;
        const wantR = naturalRankAt(pos);
        // A) carta naturale
        for (let k = 0; k < n; k++) {
          if (used[k]) continue;
          const c = cards[k];
          if (c.r === wantR && c.s === suit) {
            used[k] = true; slots[i] = { card: c, pos, wild: false };
            if (rec(i + 1, matte)) return true;
            used[k] = false; slots[i] = null;
          }
        }
        // B) matta (jolly o pinella fuori posizione)
        if (matte === 0) {
          for (let k = 0; k < n; k++) {
            if (used[k]) continue;
            const c = cards[k];
            if (!canBeWild(c)) continue;
            if (c.r === wantR && c.s === suit) continue; // sarebbe naturale, già provato
            used[k] = true; slots[i] = { card: c, pos, wild: true };
            if (rec(i + 1, matte + 1)) return true;
            used[k] = false; slots[i] = null;
          }
        }
        return false;
      };

      if (rec(0, 0)) {
        let matte = 0;
        for (const s of slots) if (s.wild) matte++;
        const cand = {
          type: 'seq', suit, start, matte,
          lo: start, hi: start + n - 1,
          slots: slots.slice(),
          cards: slots.map(s => s.card),
        };
        if (!best || cand.matte < best.matte) best = cand;
        if (matte === 0) return best; // non si fa meglio
      }
    }
  }
  return best;
}

/**
 * Prova a comporre un TRIS con tutte le carte fornite.
 * Ritorna {type:'set', rank, slots:[{card, wild}], matte} oppure null.
 */
function solveSet(cards) {
  const n = cards.length;
  if (n < 3 || n > MAX_SET) return null;
  // un tris ammette al massimo una carta fuori valore: il rango candidato è
  // per forza quello della prima o della seconda carta non jolly.
  let cand1 = 0, cand2 = 0;
  for (const c of cards) {
    if (c.r === 0) continue;
    if (!cand1) cand1 = c.r;
    else if (c.r !== cand1 && !cand2) { cand2 = c.r; break; }
  }
  let best = null;
  for (const R of [cand1, cand2]) {
    if (!R) continue;
    let nat = 0, wild = null, bad = false;
    for (const c of cards) {
      if (c.r === R) { nat++; continue; }
      if (!canBeWild(c) || wild) { bad = true; break; }
      wild = c;
    }
    if (bad || nat < 2) continue;
    const slots = [];
    for (const c of cards) if (c.r === R) slots.push({ card: c, wild: false });
    if (wild) slots.push({ card: wild, wild: true });
    const cd = { type: 'set', rank: R, slots, matte: wild ? 1 : 0, cards: slots.map(s => s.card) };
    if (!best || cd.matte < best.matte) best = cd;
    if (!cd.matte) break;
  }
  return best;
}

/**
 * Test rapido: questa carta PUÒ agganciarsi a questo gioco?
 * Non sostituisce solveMeld (che resta l'autorità), ma evita di ricomporre
 * il gioco per ogni carta durante le valutazioni dell'IA.
 */
function canAttach(m, c) {
  if (m.type === 'set') {
    if (m.slots.length >= MAX_SET) return false;
    if (c.r === m.rank) return true;
    return canBeWild(c) && m.matte === 0;
  }
  if (m.slots.length >= MAX_SEQ) return false;
  const room = m.lo > 1 || m.hi < 14;
  // una pinella del seme può passare da naturale a matta e viceversa:
  // in quel caso il gioco si può riorganizzare e serve il solver vero.
  let flex = false;
  for (const s of m.slots) if (s.card.r === 2 && s.card.s === m.suit) { flex = true; break; }

  if (canBeWild(c)) {
    if (m.matte === 0 && room) return true;
    if (c.r === 2 && c.s === m.suit) return true; // pinella naturale: può liberare la matta
    return flex;
  }
  if (c.s !== m.suit) return false;
  if (m.matte === 1 || flex) return true;
  // gioco tutto naturale e contiguo: ci si aggancia solo a un'estremità
  if (c.r === 14) return m.lo === 2 || m.hi === 13;
  return c.r === m.lo - 1 || c.r === m.hi + 1;
}

/**
 * Una matta già sul tavolo si sposta solo a certe condizioni.
 *  - se sta a un'estremità del gioco è "libera": può scivolare per far posto
 *    a una carta più alta o più bassa;
 *  - se è chiusa fra due carte è "imprigionata": si sposta soltanto se cali
 *    proprio la carta che rappresenta, che va a prendere il suo posto.
 * Nei tris la posizione non conta, quindi non c'è niente da proteggere.
 */
function spostamentoLecito(vecchio, nuovo, aggiunte) {
  if (vecchio.type !== 'seq' || nuovo.type !== 'seq') return true;
  const prima = vecchio.slots.find(s => s.wild);
  if (!prima) return true;
  const dopo = nuovo.slots.find(s => s.card.id === prima.card.id);
  if (!dopo) return true;
  if (dopo.wild && dopo.pos === prima.pos) return true;                  // non si è mossa
  if (prima.pos === vecchio.lo || prima.pos === vecchio.hi) return true; // era libera
  const serve = naturalRankAt(prima.pos);
  return aggiunte.some(c => c.r === serve && c.s === vecchio.suit);
}

/** La carta che una matta imprigionata pretende per lasciare il posto. */
function cartaCheServe(vecchio) {
  const prima = vecchio.slots.find(s => s.wild);
  if (!prima) return null;
  return RANK_LABEL[naturalRankAt(prima.pos)] + SUIT_SYM[vecchio.suit];
}

/** Carte di un gioco, memorizzate alla prima richiesta (utile dopo un ricaricamento). */
function meldCards(m) {
  if (!m.cards) m.cards = m.slots.map(s => s.card);
  return m.cards;
}
/** Ricompone il gioco con una o più carte in più. */
function solveWith(m, extra, preferType) {
  return solveMeld(meldCards(m).concat(extra), preferType || m.type);
}

/** Cerca il miglior assetto valido, con eventuale preferenza di tipo. */
function solveMeld(cards, preferType) {
  const a = solveSeq(cards);
  const b = solveSet(cards);
  if (preferType === 'seq' && a) return a;
  if (preferType === 'set' && b) return b;
  if (a && b) return a.matte <= b.matte ? a : b;
  return a || b;
}

/** Classificazione del burraco: null | 'sporco' | 'semipulito' | 'pulito' */
function burracoType(meld) {
  const n = meld.slots.length;
  if (n < 7) return null;
  if (meld.matte === 0) return 'pulito';
  if (n >= 8) {
    if (meld.type === 'set') return 'semipulito';
    const first = meld.slots[0].wild, last = meld.slots[n - 1].wild;
    if (first || last) return 'semipulito';
  }
  return 'sporco';
}
const BURRACO_POINTS = { pulito: 200, semipulito: 150, sporco: 100 };
const BONUS_CHIUSURA = 100;
const MALUS_POZZETTO = 100;

function meldPoints(meld) {
  return meld.slots.reduce((t, s) => t + cardValue(s.card), 0);
}

/* ============================================================
   STATO DI GIOCO
   ============================================================ */

const SEAT_NAMES_1V1 = ['Tu', 'Computer'];
const SEAT_NAMES_2V2 = ['Tu', 'Est', 'Nord', 'Ovest'];

/**
 * mode: '1v1' | '2v2'
 * Squadre: 1v1 -> [0],[1] ; 2v2 -> [0,2] (tu+Nord) e [1,3] (Est+Ovest)
 */
function newGame(mode, opts = {}) {
  const nP = mode === '2v2' ? 4 : 2;
  const g = {
    mode, nPlayers: nP,
    target: opts.target || 2005,
    seed: opts.seed || (Date.now() & 0x7fffffff),
    names: mode === '2v2' ? [...SEAT_NAMES_2V2] : [...SEAT_NAMES_1V1],
    teamOf: mode === '2v2' ? [0, 1, 0, 1] : [0, 1],
    matchScore: [0, 0],
    dealer: 0,
    handNo: 0,
    finished: false,
    winner: null,
    log: [],
  };
  startHand(g);
  return g;
}

function startHand(g) {
  const rng = makeRng((g.seed + g.handNo * 7919) >>> 0);
  const deck = shuffle(buildDeck(), rng);
  g.handNo++;
  g.hands = [];
  for (let p = 0; p < g.nPlayers; p++) g.hands.push(deck.splice(0, 11).sort(sortCards));
  g.pozzetti = [deck.splice(0, 11), deck.splice(0, 11)];
  g.stock = deck;
  // Art. 4 del codice di gara: "il mazziere scoprirà la prima carta dal tallone".
  // Il monte scarti non parte mai vuoto: chi apre può già prenderlo.
  g.discard = [g.stock.shift()];
  g.teams = [0, 1].map(() => ({ melds: [], pozzetto: false }));
  g.meldSeq = 0;
  g.turn = (g.dealer + 1) % g.nPlayers;
  g.phase = 'draw';
  g.turni = 0;
  g.handOver = false;
  g.result = null;
  g.tookPileThisTurn = false;
  g.mosse = [];                 // registro della mano: vedi "REGISTRO DELLE MOSSE"
  g.puntiInizioMano = [...g.matchScore];   // per rigiocare la mano senza contare due volte
  g.log.push({ t: 'hand', n: g.handNo });
  return g;
}

function sortCards(a, b) {
  if (a.r !== b.r) return (a.r === 0 ? 99 : a.r) - (b.r === 0 ? 99 : b.r);
  return SUITS.indexOf(a.s) - SUITS.indexOf(b.s);
}

function teamMelds(g, p) { return g.teams[g.teamOf[p]].melds; }
function hasBurraco(g, team) { return g.teams[team].melds.some(m => burracoType(m) !== null); }

/* ---------- Azioni ---------- */

function draw(g, p, source) {
  if (g.handOver) return err('Mano conclusa.');
  if (g.turn !== p) return err('Non è il tuo turno.');
  if (g.phase !== 'draw') return err('Hai già pescato.');
  if (source === 'pile') {
    if (g.discard.length === 0) return err('Il monte degli scarti è vuoto.');
    g.hands[p].push(...g.discard.splice(0, g.discard.length));
    g.hands[p].sort(sortCards);
    g.tookPileThisTurn = true;
    g.mosse.push({ t: 'p', p, s: 'pile' });
    g.log.push({ t: 'draw', p, src: 'pile' });
  } else {
    if (g.stock.length === 0) return err('Il tallone è esaurito: devi prendere gli scarti.');
    g.hands[p].push(g.stock.shift());
    g.hands[p].sort(sortCards);
    g.tookPileThisTurn = false;
    g.mosse.push({ t: 'p', p, s: 'stock' });
    g.log.push({ t: 'draw', p, src: 'stock' });
  }
  g.phase = 'meld';
  return ok();
}

function findCards(g, p, ids) {
  const hand = g.hands[p];
  const out = [];
  for (const id of ids) {
    const c = hand.find(x => x.id === id);
    if (!c || out.includes(c)) return null;
    out.push(c);
  }
  return out;
}

/** Controlla se svuotare la mano è lecito; se serve, prende il pozzetto. */
function afterHandEmpty(g, p, viaDiscard) {
  const team = g.teamOf[p];
  if (g.hands[p].length > 0) return { closed: false };
  if (!g.teams[team].pozzetto) {
    const idx = g.teams[0].pozzetto ? 1 : (g.teams[1].pozzetto ? 0 : team);
    g.hands[p] = g.pozzetti[idx].splice(0, 11).sort(sortCards);
    g.teams[team].pozzetto = true;
    g.log.push({ t: 'pozzetto', p, volo: !viaDiscard });
    return { closed: false, pozzetto: true, volo: !viaDiscard };
  }
  // pozzetto già preso: si può chiudere solo con almeno un burraco
  if (hasBurraco(g, team)) { endHand(g, p); return { closed: true }; }
  return { closed: false, illegal: true };
}

/** Restare senza carte SCARTANDO: o si va a pozzetto, o si chiude. */
function canEmptyHand(g, p) {
  const team = g.teamOf[p];
  return !g.teams[team].pozzetto || hasBurraco(g, team);
}

/**
 * Restare senza carte CALANDO: lecito solo per andare a pozzetto.
 * La chiusura passa sempre dallo scarto — Art. 17: "ha ultimato tutte le carte
 * scartandone una". Quindi con il pozzetto già preso una carta va tenuta.
 */
function canMeldToZero(g, p) {
  return !g.teams[g.teamOf[p]].pozzetto;
}

/**
 * Quante carte devono restare in mano dopo aver calato, perché il turno si
 * possa chiudere con uno scarto lecito.
 *   0 → pozzetto non ancora preso: si può finire tutto e andare a pozzetto
 *   1 → pozzetto preso e burraco fatto: quella carta è lo scarto di chiusura
 *   2 → pozzetto preso ma niente burraco: non si può chiudere, quindi dopo lo
 *       scarto una carta deve restare in mano
 *
 * Il conto va fatto sulla situazione DOPO la calata: spesso è proprio quella
 * calata a creare il burraco. `nuovo` è il gioco che sta per finire sul tavolo,
 * `sostituisce` l'id del gioco che rimpiazza (per gli attacchi).
 */
function minimoDaTenere(g, p, nuovo, sostituisce) {
  const team = g.teamOf[p];
  if (!g.teams[team].pozzetto) return 0;
  return burracoDopo(g, team, nuovo, sostituisce) ? 1 : 2;
}

function burracoDopo(g, team, nuovo, sostituisce) {
  if (nuovo && burracoType(nuovo)) return true;
  for (const m of g.teams[team].melds) {
    if (sostituisce != null && m.id === sostituisce) continue;
    if (burracoType(m)) return true;
  }
  return false;
}

/** Messaggio adatto al motivo per cui la calata lascerebbe il giocatore senza mosse. */
function erroreTroppePocheCarte(min) {
  return min === 1
    ? 'Devi tenere una carta da scartare: la chiusura si fa scartando l\'ultima carta.'
    : 'Senza burraco non puoi chiudere, quindi dopo lo scarto una carta deve restarti in mano: tienine almeno due.';
}

/**
 * Evita il vicolo cieco: restare con la sola matta in mano quando si potrebbe
 * chiudere. Non si chiude scartando una matta, e non si può nemmeno calarla:
 * il giocatore resterebbe senza mosse. Meglio impedire la calata che ci porta.
 */
function vicoloCieco(g, p, restanti, nuovo, sostituisce) {
  if (restanti.length !== 1 || !canBeWild(restanti[0])) return false;
  const team = g.teamOf[p];
  return g.teams[team].pozzetto && burracoDopo(g, team, nuovo, sostituisce);
}

function meldNew(g, p, ids) {
  if (g.handOver) return err('Mano conclusa.');
  if (g.turn !== p || g.phase !== 'meld') return err('Azione non consentita ora.');
  const cards = findCards(g, p, ids);
  if (!cards) return err('Carte non valide.');
  const sol = solveMeld(cards);
  if (!sol) return err('Combinazione non valida: serve una scala dello stesso seme o un tris, con al massimo una matta.');
  const restanti = g.hands[p].filter(c => !cards.includes(c));
  const min = minimoDaTenere(g, p, sol, null);
  if (restanti.length < min) return err(erroreTroppePocheCarte(min));
  if (vicoloCieco(g, p, restanti, sol, null)) {
    return err('Ti resterebbe in mano solo una matta, che non si può scartare per chiudere. Tieni un\'altra carta.');
  }
  g.hands[p] = g.hands[p].filter(c => !cards.includes(c));
  sol.id = ++g.meldSeq;
  sol.team = g.teamOf[p];
  teamMelds(g, p).push(sol);
  g.mosse.push({ t: 'c', p, ids: cards.map(c => c.id) });
  g.log.push({ t: 'meld', p, n: cards.length });
  const r = afterHandEmpty(g, p, false);
  return ok(r);
}

function addToMeld(g, p, meldId, ids) {
  if (g.handOver) return err('Mano conclusa.');
  if (g.turn !== p || g.phase !== 'meld') return err('Azione non consentita ora.');
  const melds = teamMelds(g, p);
  const m = melds.find(x => x.id === meldId);
  if (!m) return err('Gioco non trovato.');
  const cards = findCards(g, p, ids);
  if (!cards) return err('Carte non valide.');
  const sol = solveWith(m, cards);
  if (!sol) return err('Attacco non valido su questo gioco.');
  if (!spostamentoLecito(m, sol, cards)) {
    return err(`La matta è chiusa fra due carte: per spostarla devi calare il ${cartaCheServe(m)}, che ne prende il posto.`);
  }
  const restanti = g.hands[p].filter(c => !cards.includes(c));
  const min = minimoDaTenere(g, p, sol, m.id);
  if (restanti.length < min) return err(erroreTroppePocheCarte(min));
  if (vicoloCieco(g, p, restanti, sol, m.id)) {
    return err('Ti resterebbe in mano solo una matta, che non si può scartare per chiudere. Tieni un\'altra carta.');
  }
  g.hands[p] = g.hands[p].filter(c => !cards.includes(c));
  sol.id = m.id; sol.team = m.team;
  melds[melds.indexOf(m)] = sol;
  g.mosse.push({ t: 'a', p, m: sol.id, ids: cards.map(c => c.id) });
  g.log.push({ t: 'add', p, n: cards.length });
  const r = afterHandEmpty(g, p, false);
  return ok(r);
}

function discard(g, p, id) {
  if (g.handOver) return err('Mano conclusa.');
  if (g.turn !== p || g.phase !== 'meld') return err('Devi prima pescare.');
  const c = g.hands[p].find(x => x.id === id);
  if (!c) return err('Carta non in mano.');
  const last = g.hands[p].length === 1;
  if (last) {
    if (canBeWild(c) && g.teams[g.teamOf[p]].pozzetto && hasBurraco(g, g.teamOf[p])) {
      return err('Non si può chiudere scartando una matta.');
    }
    if (!canEmptyHand(g, p)) return err('Non puoi restare senza carte: ti serve almeno un burraco per chiudere.');
  }
  g.hands[p] = g.hands[p].filter(x => x !== c);
  g.discard.unshift(c);
  g.mosse.push({ t: 's', p, id: c.id });
  g.log.push({ t: 'discard', p, c: cardLabel(c) });
  const r = afterHandEmpty(g, p, true);
  if (r.closed) return ok(r);
  nextTurn(g);
  return ok(r);
}

function nextTurn(g) {
  g.turn = (g.turn + 1) % g.nPlayers;
  g.phase = 'draw';
  g.tookPileThisTurn = false;
  // Valvola di sicurezza, non una regola: se nessuno pesca mai dal tallone la mano
  // potrebbe girare all'infinito. Una mano vera ne dura una quarantina di turni.
  g.turni = (g.turni || 0) + 1;
  if (g.turni > 400) { endHand(g, null); return; }
  // Art. 17: le ultime due carte del tallone non sono giocabili. La mano finisce
  // con lo scarto di chi ha pescato la terzultima, e non si prosegue col monte scarti.
  if (g.stock.length <= 2) endHand(g, null);
}

/* ---------- Fine mano e punteggi ---------- */

function endHand(g, closerP) {
  g.handOver = true;
  g.phase = 'end';
  const detail = [0, 1].map(t => ({
    melds: 0, burrachi: [], hand: 0, chiusura: 0, pozzetto: 0, total: 0,
  }));
  for (const t of [0, 1]) {
    const d = detail[t];
    for (const m of g.teams[t].melds) {
      d.melds += meldPoints(m);
      const b = burracoType(m);
      if (b) d.burrachi.push(b);
    }
    for (let p = 0; p < g.nPlayers; p++) {
      if (g.teamOf[p] !== t) continue;
      d.hand += g.hands[p].reduce((s, c) => s + cardValue(c), 0);
    }
    if (!g.teams[t].pozzetto) d.pozzetto = -MALUS_POZZETTO;
    if (closerP !== null && g.teamOf[closerP] === t) d.chiusura = BONUS_CHIUSURA;
    const bp = d.burrachi.reduce((s, b) => s + BURRACO_POINTS[b], 0);
    d.burracoPoints = bp;
    d.total = d.melds + bp + d.chiusura + d.pozzetto - d.hand;
  }
  g.matchScore[0] += detail[0].total;
  g.matchScore[1] += detail[1].total;
  g.result = { detail, closer: closerP };
  g.log.push({ t: 'end', closer: closerP, pts: [detail[0].total, detail[1].total] });
  if (g.matchScore[0] >= g.target || g.matchScore[1] >= g.target) {
    if (g.matchScore[0] !== g.matchScore[1]) {
      g.finished = true;
      g.winner = g.matchScore[0] > g.matchScore[1] ? 0 : 1;
    }
  }
  return g;
}

function nextHand(g) {
  if (g.finished) return g;
  g.dealer = (g.dealer + 1) % g.nPlayers;
  return startHand(g);
}

/* ============================================================
   REGISTRO DELLE MOSSE
   Ogni azione riuscita finisce in g.mosse in forma minima. Con il
   seme del mazzo, il numero della mano e questo registro la mano si
   ricostruisce carta per carta: nessuno stato da spedire.
   Serve a due cose:
     · gioco online — si spedisce la mossa (poche decine di byte),
       non il tavolo, e ogni giocatore la applica con questo stesso
       motore, che resta l'unico arbitro;
     · annulla — si rigioca la mano fino a un istante prima.
   Il registro riparte a ogni mano: una mano sola basta a tutte e due.
   ============================================================ */

/** Traduce una mossa del registro in una chiamata al motore. */
function applicaMossa(g, m) {
  if (m.t === 'p') return draw(g, m.p, m.s);
  if (m.t === 'c') return meldNew(g, m.p, m.ids);
  if (m.t === 'a') return addToMeld(g, m.p, m.m, m.ids);
  if (m.t === 's') return discard(g, m.p, m.id);
  return err('Mossa sconosciuta: ' + m.t);
}

/** La stessa mano appena distribuita: stesso seme, stesso mazziere. */
function inizioMano(g) {
  const i = g.log.map(x => x.t).lastIndexOf('hand');
  const b = {
    mode: g.mode, nPlayers: g.nPlayers, target: g.target, seed: g.seed,
    names: [...g.names], teamOf: [...g.teamOf],
    matchScore: [...(g.puntiInizioMano || g.matchScore)], dealer: g.dealer, handNo: g.handNo - 1,
    finished: false, winner: null,
    log: i >= 0 ? g.log.slice(0, i) : [],
  };
  startHand(b);
  return b;
}

/** Rigioca la mano dall'inizio con le mosse date. Non tocca g. */
function rigiocaMano(g, mosse) {
  const b = inizioMano(g);
  for (const m of mosse) {
    const r = applicaMossa(b, m);
    if (!r.ok) return null;   // registro incoerente: meglio non toccare niente
  }
  return b;
}

/**
 * Annulla l'ultima calata o l'ultimo attacco del giocatore, dentro il suo
 * turno. La pescata non si annulla (rivelerebbe il tallone) e dopo lo scarto
 * il turno è chiuso: lì non c'è più niente da annullare.
 */
function annullabile(g, p) {
  if (g.handOver || g.turn !== p || g.phase !== 'meld') return false;
  const u = (g.mosse || []).length - 1;
  return u >= 0 && g.mosse[u].p === p && (g.mosse[u].t === 'c' || g.mosse[u].t === 'a');
}

function annulla(g, p) {
  if (!annullabile(g, p)) return null;
  return rigiocaMano(g, g.mosse.slice(0, -1));
}

function ok(x) { return { ok: true, ...(x || {}) }; }
function err(m) { return { ok: false, error: m }; }

/* ============================================================
   INTELLIGENZA ARTIFICIALE
   ============================================================ */

/** Tutte le combinazioni nuove che si possono formare da un insieme di carte. */
function findNewMelds(cards) {
  const out = [];
  const naturals = cards.filter(c => !canBeWild(c));
  const wilds = cards.filter(c => canBeWild(c));

  // TRIS naturali
  const byRank = {};
  for (const c of naturals) (byRank[c.r] = byRank[c.r] || []).push(c);
  for (const r in byRank) {
    const grp = byRank[r];
    if (grp.length >= 3) out.push(grp.slice(0, MAX_SET));
    else if (grp.length === 2 && wilds.length) out.push([...grp, wilds[0]]);
  }
  // Tris di pinelle naturali
  const twos = cards.filter(c => c.r === 2);
  if (twos.length >= 3) out.push(twos.slice(0, MAX_SET));

  // SCALE
  for (const s of SUITS) {
    const inSuit = naturals.filter(c => c.s === s);
    const seen = new Map();
    for (const c of inSuit) if (!seen.has(c.r)) seen.set(c.r, c);
    const pin = cards.find(c => c.r === 2 && c.s === s);
    if (pin) seen.set(2, pin);
    const pos = [];
    for (const [r, c] of seen) pos.push({ p: r === 14 ? 14 : r, c });
    if (seen.has(14)) pos.push({ p: 1, c: seen.get(14) });
    pos.sort((a, b) => a.p - b.p);
    // corse consecutive naturali
    let run = [];
    for (let i = 0; i < pos.length; i++) {
      if (run.length && pos[i].p !== run[run.length - 1].p + 1) {
        if (run.length >= 3) out.push(run.slice(0, MAX_SEQ).map(x => x.c));
        else if (run.length === 2 && wilds.length) out.push([...run.map(x => x.c), wilds[0]]);
        run = [];
      }
      run.push(pos[i]);
    }
    if (run.length >= 3) out.push(run.slice(0, MAX_SEQ).map(x => x.c));
    else if (run.length === 2 && wilds.length) out.push([...run.map(x => x.c), wilds[0]]);

    // buco singolo colmato da una matta: X, _, X+2
    if (wilds.length) {
      for (let i = 0; i + 1 < pos.length; i++) {
        if (pos[i + 1].p === pos[i].p + 2) {
          const cand = [pos[i].c, wilds[0], pos[i + 1].c];
          if (i + 2 < pos.length && pos[i + 2].p === pos[i + 1].p + 1) cand.push(pos[i + 2].c);
          if (i > 0 && pos[i - 1].p === pos[i].p - 1) cand.unshift(pos[i - 1].c);
          if (cand.length >= 3) out.push(cand);
        }
      }
    }
  }
  // tieni solo quelle davvero valide
  return out.filter(g => solveMeld(g) !== null);
}

/**
 * UNA sola mossa di calata o attacco. Ritorna quel che ha fatto, oppure null.
 * Spezzare il turno in mosse singole serve all'interfaccia, che le mostra
 * una alla volta invece di far comparire tutto insieme.
 */
function aiOneMeld(g, p) {
  // 1) attacca una carta a un gioco già aperto della squadra
  for (const m of teamMelds(g, p)) {
    for (const c of [...g.hands[p]]) {
      if (canBeWild(c) && m.matte > 0) continue;           // una sola matta per gioco
      if (canBeWild(c) && burracoType(m) === null && m.slots.length < 6) continue; // non sprecare matte
      if (!canAttach(m, c)) continue;
      const test = solveWith(m, c);
      if (!test) continue;
      if (test.matte > m.matte && !canBeWild(c)) continue;
      if (addToMeld(g, p, m.id, [c.id]).ok) return { t: 'add', meld: m.id, n: 1 };
    }
  }
  // 2) altrimenti cala una combinazione nuova: la più lunga, con meno matte
  const cands = findNewMelds(g.hands[p]);
  cands.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.filter(canBeWild).length - b.filter(canBeWild).length;
  });
  for (const cand of cands) {
    if (meldNew(g, p, cand.map(c => c.id)).ok) return { t: 'meld', n: cand.length };
  }
  return null;
}

/** Punteggio di utilità di una carta rispetto al resto della mano. */
function cardUtility(g, p, c) {
  const hand = g.hands[p].filter(x => x !== c);
  if (canBeWild(c)) return 100;
  let u = 0;
  for (const o of hand) {
    if (o.r === c.r) u += 6;
    if (o.s === c.s && Math.abs(o.r - c.r) === 1) u += 5;
    if (o.s === c.s && Math.abs(o.r - c.r) === 2) u += 2;
  }
  // carte che si attaccano ai propri giochi
  for (const m of teamMelds(g, p)) if (canAttach(m, c)) u += 7;
  // carte che regalano punti agli avversari
  for (const m of g.teams[1 - g.teamOf[p]].melds) if (canAttach(m, c)) u -= 4;
  return u - cardValue(c) / 10;
}

/** La pesca: dal tallone, o tutto il monte scarti se conviene. */
function aiDraw(g, p) {
  if (g.phase !== 'draw') return null;
  let takePile = false;
  if (g.discard.length > 0) {
    const before = g.hands[p].length;
    const withPile = g.hands[p].concat(g.discard);
    const nuoviGiochi = findNewMelds(withPile);
    const gain = nuoviGiochi.length - findNewMelds(g.hands[p]).length;
    const melds = teamMelds(g, p);
    let attachable = 0;
    for (const c of g.discard) if (melds.some(m => canAttach(m, c))) attachable++;
    // con il pozzetto preso e senza burraco vanno tenute due carte: un gioco che
    // svuoterebbe la mano non è calabile, e prendere il monte sarebbe inutile
    const min = minimoDaTenere(g, p, null, null);
    const giocabile = attachable > 0 || nuoviGiochi.some(c => withPile.length - c.length >= min);
    const value = g.discard.reduce((s, c) => s + cardValue(c), 0);
    // conviene se il monte è ricco o sblocca giochi, ma non se ingolfa la mano
    if ((gain >= 1 && giocabile && g.discard.length <= 12) || attachable >= 2 || (g.discard.length >= 4 && value >= 60 && g.discard.length <= 10)) takePile = true;
    if (g.stock.length === 0) takePile = true;
    if (before > 16) takePile = false;
  }
  let r = draw(g, p, takePile ? 'pile' : 'stock');
  if (!r.ok) r = draw(g, p, takePile ? 'stock' : 'pile');
  if (!r.ok) { nextTurn(g); return null; }
  return takePile ? 'pile' : 'stock';
}

/** Lo scarto: la carta meno utile che sia lecito scartare. */
function aiDiscard(g, p) {
  const scored = g.hands[p].map(c => ({ c, u: cardUtility(g, p, c) }));
  scored.sort((a, b) => a.u - b.u);
  for (const x of scored) {
    const r = discard(g, p, x.c.id);
    if (r.ok) return x.c;
  }
  nextTurn(g);   // caso limite: nessuno scarto possibile
  return null;
}

/** Turno completo, tutto in una volta (usato dai test e dalle simulazioni). */
function aiTurn(g, p) {
  if (g.handOver || g.turn !== p) return;
  if (g.phase === 'draw') aiDraw(g, p);
  if (g.handOver || g.turn !== p) return;
  let guard = 0;
  while (guard++ < 45 && aiOneMeld(g, p)) if (g.handOver) return;
  if (g.handOver) return;
  if (g.hands[p].length === 0) return;   // pozzetto preso al volo
  aiDiscard(g, p);
}

/* ---------- Export ---------- */
const ENGINE = {
  SUITS, SUIT_SYM, SUIT_RED, RANK_LABEL, BURRACO_POINTS, BONUS_CHIUSURA, MALUS_POZZETTO,
  cardValue, cardLabel, isJolly, isPinella, canBeWild, buildDeck, makeRng, shuffle,
  solveSeq, solveSet, solveMeld, solveWith, meldCards, canAttach, burracoType, meldPoints,
  spostamentoLecito, cartaCheServe,
  newGame, startHand, nextHand, endHand, draw, meldNew, addToMeld, discard, nextTurn,
  teamMelds, hasBurraco, canEmptyHand, canMeldToZero, minimoDaTenere, findNewMelds, sortCards,
  aiTurn, aiDraw, aiOneMeld, aiDiscard,
  applicaMossa, inizioMano, rigiocaMano, annullabile, annulla,
};

// ============================================================
// PARTE 2 — l'arbitro: chi vede cosa, chi può giocare
// ============================================================

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
     { codice, nomi: [a,b], segreti: [s0,s1], stato: <G dell'engine>, creato, vista }

   Principio guida: il client manda un'INTENZIONE (pesca, cala, scarta),
   mai lo stato. Il server tiene l'unica verità (g.stato) e restituisce a
   ciascun posto solo quello che gli spetta: la propria mano, mai quella
   dell'altro, mai il tallone, mai i pozzetti non presi. È la stessa
   `engine.js` di sempre (65 test), riusata identica: qui non si
   reinventano le regole, si decide solo chi vede cosa. */


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

async function apri(db, { modo, target, nome }) {
  const stato = ENGINE.newGame(modo === '2v2' ? '2v2' : '1v1', { target: target || 2005 });
  const codice = await codiceLibero(db);
  const riga = {
    codice,
    nomi: [String(nome || '').slice(0, 14), ''],
    segreti: [segretoNuovo(), null],
    stato,
    versione: 0,   // sale di uno a ogni mossa accettata: il client capisce se è cambiato qualcosa senza confrontare tutto l'oggetto
    creato: new Date().toISOString(),
    vista: new Date().toISOString(),
  };
  await db.crea(riga);
  return { codice, segreto: riga.segreti[0], versione: riga.versione, ...vistaPer(stato, 0, riga.nomi) };
}

async function entra(db, { codice, nome }) {
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

async function vedi(db, { codice, posto, segreto }) {
  const riga = await db.leggi(String(codice || '').trim().toUpperCase());
  if (!riga) throw erroreConCodice('tavolo non trovato', 404);
  controllaSegreto(riga, posto, segreto);
  return { versione: riga.versione || 0, ...vistaPer(riga.stato, posto, riga.nomi) };
}

async function mossa(db, { codice, posto, segreto, mossa: intenzione }) {
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



// ============================================================
// PARTE 3 — ponte con Postgres e con la rete
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL_PROGETTO = Deno.env.get('SUPABASE_URL');
const CHIAVE_SERVIZIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// Le due variabili sopra sono automatiche: Supabase le passa da sole a ogni
// edge function del progetto, non vanno impostate a mano.

const supabase = createClient(URL_PROGETTO, CHIAVE_SERVIZIO);

/** La tabella è `tavoli` (già esistente nel tuo progetto, con le colonne
    giuste: segreti, stato, versione). */
const db = {
  async leggi(codice) {
    const { data, error } = await supabase.from('tavoli').select('*').eq('codice', codice).maybeSingle();
    if (error) throw error;
    return data;
  },
  async crea(riga) {
    const { error } = await supabase.from('tavoli').insert({
      codice: riga.codice,
      modo: riga.stato.mode,
      target: riga.stato.target,
      seme: Math.floor(Math.random() * 2147483647),
      nomi: riga.nomi,
      segreti: riga.segreti,
      stato: riga.stato,
      versione: riga.versione,
      creato: riga.creato,
      vista: riga.vista,
    });
    if (error) throw error;
  },
  async aggiorna(codice, campi) {
    const { error } = await supabase.from('tavoli').update(campi).eq('codice', codice);
    if (error) throw error;
  },
};

const AZIONI = { apri, mossa };
// "entra" e "vedi" passano dalle funzioni SQL entra_tavolo / vedi_tavolo:
// sono più leggere (nessun avvio di funzione) e non hanno bisogno del
// motore di gioco.

Deno.serve(async (req) => {
  const intestazioni = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { ...intestazioni, 'access-control-allow-headers': 'authorization, content-type, apikey' } });
  }
  try {
    const corpo = await req.json();
    const azione = AZIONI[corpo && corpo.azione];
    if (!azione) return new Response(JSON.stringify({ errore: 'azione sconosciuta' }), { status: 400, headers: intestazioni });
    const risultato = await azione(db, corpo);
    return new Response(JSON.stringify(risultato), { status: 200, headers: intestazioni });
  } catch (e) {
    const status = (e && e.codiceHttp) || 500;
    return new Response(JSON.stringify({ errore: (e && e.message) || 'errore del server' }), { status, headers: intestazioni });
  }
});
