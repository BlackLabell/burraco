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
    // Livello del computer per ciascun posto: 1 (facile), 2 (medio), 3 (pro).
    // `null`/assente per un posto umano. Vedi "IL COMPUTER" più sotto — sono
    // solo regole, nessun apprendimento: il livello sceglie quali regole
    // applicare, non viene mai dedotto o modificato durante la partita.
    livelli: opts.livelli ? [...opts.livelli] : new Array(nP).fill(null),
    log: [],
    // Online a tempo (Lavoro 4): secondi per turno, scelti da chi apre il
    // tavolo — null/0 vuol dire "nessun limite". Non c'entra niente con la
    // partita contro il computer: lì resta sempre null. Vedi turnoUfficio()
    // più sotto e src/rete.js/src/ui.js per l'orologio vero e proprio (il
    // motore non conosce l'ora: sa solo eseguire il turno d'ufficio quando
    // gli viene chiesto).
    tempo: opts.tempo || null,
    // Quanti turni d'ufficio di fila sono già successi, in tutta la partita
    // (non si azzera a ogni mano, si azzera a ogni turno giocato per davvero
    // — vedi discard()). A tre di fila la partita si chiude da sola.
    turniUfficioFila: 0,
    chiusuraUfficio: false,
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
  // id della carta che era in cima al monte scarti quando è stata presa in
  // questo turno. Non è una regola di gioco: solo un promemoria per
  // scartaComputer, per evitare che il computer la riprenda e la ributti
  // all'infinito. Vedi draw() e scartaComputer().
  g.presaMonteId = null;
  g.mosse = [];                 // registro della mano: vedi "REGISTRO DELLE MOSSE"
  g.puntiInizioMano = [...g.matchScore];   // per rigiocare la mano senza contare due volte
  // Chi ha preso il monte scarti in questa mano, e cosa c'era dentro: informazione
  // già pubblica (chiunque fosse al tavolo l'avrebbe vista), usata dal computer di
  // livello Pro per farsi un'idea di cosa cerca l'avversario. Mai una mano altrui.
  g.preseDalMonte = [];
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
    // presa[0] è la carta che era scoperta in cima — quella che si vedeva sul
    // tavolo prima di prendere tutto il monte. NON è una regola di gioco (né
    // FGB né AICS/FITAB dicono niente in proposito, verificato apposta, e un
    // umano è libero di riscartarla subito se vuole): serve solo a
    // scartaComputer, come promemoria per evitare che il computer la
    // riprenda e la ributti all'infinito — il loop visto succedere in
    // partite vere. Vale solo per questo turno: si azzera in nextTurn().
    const presa = g.discard.splice(0, g.discard.length);
    g.presaMonteId = presa[0].id;
    g.hands[p].push(...presa);
    g.hands[p].sort(sortCards);
    g.tookPileThisTurn = true;
    g.mosse.push({ t: 'p', p, s: 'pile' });
    g.log.push({ t: 'draw', p, src: 'pile' });
    (g.preseDalMonte = g.preseDalMonte || []).push({ p, turno: g.turni || 0, carte: presa.map(c => ({ r: c.r, s: c.s })) });
  } else {
    if (g.stock.length === 0) return err('Il tallone è esaurito: devi prendere gli scarti.');
    g.hands[p].push(g.stock.shift());
    g.hands[p].sort(sortCards);
    g.tookPileThisTurn = false;
    g.presaMonteId = null;
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

function discard(g, p, id, opts) {
  if (g.handOver) return err('Mano conclusa.');
  if (g.turn !== p || g.phase !== 'meld') return err('Devi prima pescare.');
  const c = g.hands[p].find(x => x.id === id);
  if (!c) return err('Carta non in mano.');
  // Nessuna regola vieta di riscartare subito la carta appena presa dal
  // monte: chi gioca è libero di farlo. Il freno anti-loop vive solo
  // dentro scartaComputer, non qui — vedi g.presaMonteId più sopra.
  const last = g.hands[p].length === 1;
  if (last) {
    if (canBeWild(c) && g.teams[g.teamOf[p]].pozzetto && hasBurraco(g, g.teamOf[p])) {
      return err('Non si può chiudere scartando una matta.');
    }
    if (!canEmptyHand(g, p)) return err('Non puoi restare senza carte: ti serve almeno un burraco per chiudere.');
  }
  g.hands[p] = g.hands[p].filter(x => x !== c);
  g.discard.unshift(c);
  // Online a tempo (Lavoro 4): uno scarto "d'ufficio" (vedi turnoUfficio())
  // porta il segno con sé nel registro, così anche chi lo rilegge più tardi
  // (rientro, l'altro telefono) tiene il conto giusto di quanti sono di
  // fila — non solo chi lo esegue nel momento stesso.
  const ufficio = !!(opts && opts.ufficio);
  g.mosse.push({ t: 's', p, id: c.id, ...(ufficio ? { ufficio: true } : {}) });
  g.log.push({ t: 'discard', p, c: cardLabel(c) });
  if (ufficio) {
    g.turniUfficioFila = (g.turniUfficioFila || 0) + 1;
    g.log.push({ t: 'ufficio', p, fila: g.turniUfficioFila });
  } else {
    g.turniUfficioFila = 0;
  }
  const r = afterHandEmpty(g, p, true);
  if (r.closed) return ok(r);
  // Tre turni d'ufficio di fila: come la valvola di sicurezza dei 400 turni,
  // non è una regola di gioco, è una rete per non tenere in ostaggio la
  // partita se uno dei due non c'è più. Chiude la mano dov'è (stesso
  // meccanismo di endHand(g, null) già usato dalla valvola) e chiude la
  // partita senza dichiarare un vincitore: si avvisano entrambi.
  if (ufficio && g.turniUfficioFila >= 3) {
    endHand(g, null);
    g.finished = true;
    g.winner = null;
    g.chiusuraUfficio = true;
    g.log.push({ t: 'chiusuraUfficio' });
    return ok(r);
  }
  nextTurn(g);
  return ok(r);
}

/**
 * Il turno d'ufficio (Lavoro 4, online a tempo): quando il tempo di un turno
 * scade, si pesca dal tallone — mai il monte scarti, non è una scelta da
 * fare — e si scarta la carta meno utile secondo le stesse regole del
 * livello Medio (`utilitaCarta`), senza calare nulla, anche avendo in mano
 * una combinazione pronta. Questa funzione non decide SE il tempo sia
 * scaduto: quello lo sa solo chi tiene l'orologio (src/ui.js, che guarda
 * l'orario del server); qui si esegue solo la mossa, una volta presa la
 * decisione altrove. Vale per qualunque posto, umano o no: online un posto
 * umano ha `g.livelli[p] == null`, che `livelloComputer` legge già come
 * Medio — è la stessa identica classifica di utilità, non ce n'è bisogno
 * di un'altra.
 */
function turnoUfficio(g, p) {
  if (g.handOver) return err('Mano conclusa.');
  if (g.turn !== p) return err('Non è il turno di questo posto.');
  if (g.phase !== 'draw') return err('È già stata pescata la carta questo turno.');
  const rd = draw(g, p, 'stock');
  if (!rd.ok) return rd;
  const scelta = g.hands[p]
    .map(c => ({ c, u: utilitaCarta(g, p, c, 2) }))
    .sort((a, b) => a.u - b.u)[0];
  if (!scelta) return err('Nessuna carta da scartare.');
  return discard(g, p, scelta.c.id, { ufficio: true });
}

function nextTurn(g) {
  g.turn = (g.turn + 1) % g.nPlayers;
  g.phase = 'draw';
  g.tookPileThisTurn = false;
  g.presaMonteId = null;
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
  if (m.t === 's') return discard(g, m.p, m.id, m.ufficio ? { ufficio: true } : undefined);
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
    livelli: g.livelli ? [...g.livelli] : new Array(g.nPlayers).fill(null),
    log: i >= 0 ? g.log.slice(0, i) : [],
    tempo: g.tempo || null,
    turniUfficioFila: g.turniUfficioFila || 0,
    chiusuraUfficio: false,
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
   IL COMPUTER
   Nessun apprendimento automatico, nessuna rete: solo regole, come le
   altre funzioni di questo file. Tre livelli (1 facile, 2 medio, 3 pro),
   scelti da chi apre la partita e mai cambiati durante il gioco.
   Vincolo che vale per tutti e tre, senza eccezioni: ogni funzione qui
   sotto riceve `g` e il posto `p`, e legge SOLO `g.hands[p]` — la
   propria mano. Tutto il resto che un livello più alto usa in più
   (giochi calati, monte scarti, punteggio, chi ha preso cosa dal monte)
   è informazione già pubblica, visibile a chiunque fosse al tavolo:
   mai la mano di un altro posto, compagno di squadra compreso.
   ============================================================ */

const LIVELLI_COMPUTER = { 1: 'Facile', 2: 'Medio', 3: 'Pro', 4: 'Pro 2' };

/** Il livello del posto `p` (1/2/3/4). Se non è stato scelto, Medio. */
function livelloComputer(g, p) {
  const l = g.livelli && g.livelli[p];
  return l === 1 || l === 3 || l === 4 ? l : 2;
}

/** Le soglie che cambiano da un livello all'altro, tutte in un posto solo
    (prima erano sparse dentro `pescaComputer` e `utilitaCarta`) — comodo
    da ritoccare senza andare a caccia nel codice. Per i livelli 1-3 sono
    esattamente gli stessi numeri di prima, solo spostati qui: nessun
    cambiamento di comportamento. Il livello 4 ("Pro 2", vedi più sotto)
    non segue soglie fisse per decidere — usa un punteggio di stato
    dinamico — ma condivide comunque `maxMano` come rete di sicurezza. */
const SOGLIE_LIVELLO = {
  1: { sogliaValore: 60, maxScarti: 12, maxMano: 16, pesoRischio: 4 },
  2: { sogliaValore: 60, maxScarti: 12, maxMano: 16, pesoRischio: 8 },
  3: { sogliaValore: 25, maxScarti: 18, maxMano: 20, pesoRischio: 8 },
  4: { sogliaValore: 15, maxScarti: 18, maxMano: 20, pesoRischio: 8 },
};
function soglie(livello) { return SOGLIE_LIVELLO[livello] || SOGLIE_LIVELLO[2]; }

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

/** Tutte le carte che il posto `p` può contare legittimamente: la propria
    mano, tutti i giochi calati sul tavolo (di entrambe le squadre) e il
    monte scarti attuale. Mai le carte in mano a un altro posto. */
function carteVisibili(g, p) {
  const out = g.hands[p].slice();
  for (const t of [0, 1]) for (const m of g.teams[t].melds) out.push(...meldCards(m));
  out.push(...g.discard);
  return out;
}

/** Quante delle 2 copie (mazzo doppio) di una carta naturale NON sono fra
    le carte visibili al posto `p` — quindi potrebbero ancora arrivare. */
function copieNonViste(g, p, r, s) {
  const viste = carteVisibili(g, p).filter(c => c.r === r && c.s === s).length;
  return Math.max(0, 2 - viste);
}

/**
 * Livello 2 e 3: prima di usare una matta (jolly o 2 fuori posizione) su un
 * gioco della propria squadra, conviene chiedersi se non sia meglio
 * aspettare. Due casi da proteggere:
 *   - il gioco è GIÀ un burraco pulito (200 punti): metterci una matta lo
 *     fa scendere a 150 o 100 — quasi mai conviene.
 *   - il gioco ha 6 carte, nessuna matta: con una matta diventa subito un
 *     burraco, ma sporco (100). Se la carta naturale che servirebbe non è
 *     ancora tutta uscita, aspettarla vale di più — prima o poi arriva un
 *     burraco pulito (200) da solo. Si applica alle scale: per i tris,
 *     dove "la carta che manca" non ha una posizione, non si applica.
 * Fuori da questi due casi, usare la matta va benissimo.
 */
function mattaConviene(g, p, m, c, test) {
  if (burracoType(m) === 'pulito') return false;
  if (m.type === 'seq' && m.slots.length === 6 && m.matte === 0) {
    const slot = test.slots.find(s => s.card.id === c.id);
    if (slot && slot.wild) {
      const rango = naturalRankAt(slot.pos);
      // aspettare ha senso solo se il naturale è ancora del tutto fresco (nessuna
      // delle due copie vista da nessuna parte) e c'è ancora tempo per pescarlo —
      // a tallone quasi finito i 100 punti sicuri di adesso valgono più di una
      // scommessa che potrebbe non pagare mai
      if (g.stock.length > 20 && copieNonViste(g, p, rango, m.suit) === 2) return false;
    }
  }
  return true;
}

/**
 * Livello 2: una combinazione già solida (4 carte o più, oppure 3 tutte
 * naturali senza matta) si cala sempre — non c'è motivo di aspettare, e
 * tenerla in mano costerebbe solo punti se poi non si chiude. Il freno
 * riguarda solo l'apertura debole (3 carte con una matta dentro): di
 * quelle, una a turno è già abbastanza per non svuotare la mano subito e
 * lasciare intuire all'avversario tutto quello che si sta raccogliendo.
 */
function aprireConviene(g, p, cand, giaAperte) {
  if (cand.length >= 4 || !cand.some(canBeWild)) return true;
  if (g.hands[p].length >= 13) return true;                                              // mano piena, va comunque sfoltita
  if (g.teams[g.teamOf[p]].pozzetto && !hasBurraco(g, g.teamOf[p])) return true;          // serve un burraco per poter chiudere
  return giaAperte === 0;
}

/** In base al punteggio partita, il livello 3 decide se conviene chiudere
    presto (in vantaggio o quasi, vicini al traguardo) o inseguire punti
    più grandi (nettamente indietro). */
function strategiaPartita(g, p) {
  const mia = g.teamOf[p], avv = 1 - mia;
  const distanza = g.target - g.matchScore[mia];
  const vantaggio = g.matchScore[mia] - g.matchScore[avv];
  if (distanza <= 500 && vantaggio >= -100) return 'chiudi';
  if (vantaggio <= -500) return 'punta';
  return 'equilibrata';
}

/** Simula, su una copia, la stessa strategia "cala quello che puoi" per
    vedere se la mano arriverebbe a zero carte. Non è un risolutore
    ottimale — è la stessa regola greedy usata davvero in tavolo, solo
    provata prima: se il computer non calerebbe così, non serve saperlo. */
function provaUscita(mani, giochi) {
  let cambiato = true;
  while (cambiato && mani.length) {
    cambiato = false;
    for (const m of giochi) {
      for (let i = 0; i < mani.length; i++) {
        const c = mani[i];
        if (!canAttach(m, c)) continue;
        const test = solveWith(m, c);
        if (!test) continue;
        Object.assign(m, test);
        mani.splice(i, 1);
        cambiato = true;
        break;
      }
      if (cambiato) break;
    }
    if (cambiato) continue;
    const cands = findNewMelds(mani);
    if (cands.length) {
      cands.sort((a, b) => b.length - a.length);
      const cand = cands[0];
      giochi.push(solveMeld(cand));
      const usate = new Set(cand.map(c => c.id));
      for (let i = mani.length - 1; i >= 0; i--) if (usate.has(mani[i].id)) mani.splice(i, 1);
      cambiato = true;
    }
  }
  return mani.length === 0;
}

/** Livello 3: si può restare senza carte SOLO calando, in questo turno?
    (Niente scarto: se il pozzetto non è ancora stato preso, è la mossa
    più forte del gioco — via Art. 17, vale la pena rincorrerla.) */
function puoUscireCalando(g, p) {
  if (g.teams[g.teamOf[p]].pozzetto) return false;   // il pozzetto è già stato preso: non c'è "al volo" da inseguire
  const mani = g.hands[p].slice();
  const giochi = teamMelds(g, p).map(m => ({ ...m, slots: m.slots.slice() }));
  return provaUscita(mani, giochi);
}

/* ============================================================
   LIVELLO 4 — "PRO 2"
   Gli altri tre livelli decidono con soglie scritte a mano (quante carte,
   quanti punti, quante caselle...). Il Pro 2 no: prova davvero una mossa
   su una copia dello stato (`valutaMossa`), guarda con `valoreStato` dove
   porta, e la confronta con le altre — sempre restando dentro il vincolo
   di sempre, come tutto il resto di questa sezione: legge solo la propria
   mano, mai quella di un altro posto. Vedi `claude/piano-computer-online-
   chat.md` per il criterio di accettazione (deve battere nettamente sia
   Medio che Pro) e `claude/offline-livelli-ia.md` per come sono stati
   ritoccati Facile/Medio/Pro — stesso metodo di verifica qui.
   ============================================================ */

/** Copia indipendente dello stato, per provare una mossa senza toccare
    quello vero: `g` è dati puri, un giro in JSON basta (già usato per
    verificare che annulla/rigioca tornino identici, vedi engine.test.js). */
function clonaStato(g) { return JSON.parse(JSON.stringify(g)); }

// Il mazzo di riferimento (108 carte, sempre la stessa composizione):
// costruito una volta sola e riusato, invece di rifarlo a ogni chiamata.
const MAZZO_RIFERIMENTO = buildDeck();

/** Valore medio di una carta ancora nascosta a `p` — non nella sua mano,
    non calata, non nel monte scarti: potrebbe essere nel tallone o in
    mano a chiunque altro. È un calcolo esatto sulla composizione fissa
    del mazzo (108 carte, due copie di ognuna più 4 jolly), non una stima
    a occhio: serve al livello 4 per giudicare quanto vale una pescata dal
    tallone, che — a differenza di prendere il monte — non si può
    simulare davvero (la carta è nascosta anche a lui). */
function valoreMedioNascosto(g, p) {
  const viste = {};
  for (const c of carteVisibili(g, p)) {
    const k = c.r === 0 ? 'J' : c.r + '_' + c.s;
    viste[k] = (viste[k] || 0) + 1;
  }
  let totale = 0, quante = 0;
  const contate = {};
  for (const c of MAZZO_RIFERIMENTO) {
    const k = c.r === 0 ? 'J' : c.r + '_' + c.s;
    contate[k] = (contate[k] || 0) + 1;
    if (contate[k] <= (viste[k] || 0)) continue;   // questa copia è già vista da qualche parte
    totale += cardValue(c);
    quante++;
  }
  return quante ? totale / quante : 8;
}

/**
 * Quanto conviene lo stato attuale alla squadra di `p`, guardando solo
 * quello che `p` può vedere legittimamente: la propria mano, i giochi
 * calati di entrambe le squadre (pubblici), il monte scarti, quante carte
 * ha in mano ciascun altro giocatore (il NUMERO è pubblico, le carte no)
 * e il punteggio di partita. Più alto è, meglio sta la squadra di `p`.
 */
function valoreStato(g, p) {
  const mia = g.teamOf[p], avv = 1 - mia;
  let v = 0;
  // punti calati, più il bonus di burraco già maturato (200/150/100): un
  // gioco a 7 carte pulite vale già 200 in prospettiva, non solo a mano
  // finita — è quello che spinge a completarlo e a non rovinarlo con una
  // matta di troppo, senza bisogno di una regola apposta per quel caso
  // (mattaConviene, che i livelli 2 e 3 usano invece come soglia fissa).
  for (const t of [0, 1]) {
    const segno = t === mia ? 1 : -1;
    for (const m of g.teams[t].melds) v += segno * (meldPoints(m) + (BURRACO_POINTS[burracoType(m)] || 0));
  }
  v += (g.teams[mia].pozzetto ? 40 : -20) - (g.teams[avv].pozzetto ? 40 : -20);
  // le carte in mano sono punti a rischio se la mano finisce prima di
  // calarle: le proprie si conoscono per intero, quelle degli altri solo
  // per numero — il resto si stima con il valore medio di una carta
  // ancora nascosta (vedi sopra).
  v -= g.hands[p].reduce((s, c) => s + cardValue(c), 0);
  // senza altro, la riga sopra farebbe sembrare conveniente scartare
  // sempre la carta di valore più alto (una matta, un asso...): tolto dalla
  // mano, il suo "rischio" sparisce, e basta da solo a farla risultare la
  // scelta migliore — l'esatto contrario di quello che deve succedere.
  // Serve un contrappeso: quanto una carta è utile da TENERE, per la stessa
  // mano e per i propri giochi già aperti (stessa idea di utilitaCarta,
  // incorporata qui invece che in un punteggio a parte, così vale anche
  // per le decisioni di pesca e di calata, non solo per lo scarto).
  for (const c of g.hands[p]) {
    // una matta vale sempre la pena tenersela: il "premio" deve superare il
    // suo stesso valore di carta (30 per il jolly), altrimenti — tolta dalla
    // mano — il sollievo dal suo peso (uguale al premio, per costruzione)
    // la farebbe sembrare comunque la scelta migliore da scartare (bug
    // trovato e corretto, vedi tests/livelli.test.js). Resta comunque
    // meno del doppio del suo valore, così usarla in un gioco buono — che
    // guadagna 2× il suo valore, più il salto di burraco se è quello il
    // caso — continua a convenire di più che tenerla ferma in mano.
    if (canBeWild(c)) { v += 35; continue; }
    for (const o of g.hands[p]) {
      if (o.id === c.id) continue;
      if (o.r === c.r) v += 3;
      if (o.s === c.s && Math.abs(o.r - c.r) === 1) v += 2.5;
      if (o.s === c.s && Math.abs(o.r - c.r) === 2) v += 1;
    }
    for (const m of g.teams[mia].melds) if (canAttach(m, c)) v += 3.5;
  }
  const mediaNascosta = valoreMedioNascosto(g, p);
  for (let q = 0; q < g.nPlayers; q++) {
    if (q === p) continue;
    const segno = g.teamOf[q] === mia ? -1 : 1;
    v += segno * g.hands[q].length * mediaNascosta;
  }
  // la carta scoperta in cima al monte, se aiuta un gioco avversario, è un
  // rischio acceso — vale meno lasciarla lì (o metterla lì scartando)
  if (g.discard.length) {
    const cima = g.discard[0];
    for (const m of g.teams[avv].melds) {
      if (canAttach(m, cima)) v -= 12;
      else if (m.type === 'seq' && m.suit === cima.s && (Math.abs(cima.r - m.lo) <= 2 || Math.abs(cima.r - m.hi) <= 2)) v -= 6;
    }
    for (const presa of (g.preseDalMonte || [])) {
      if (g.teamOf[presa.p] !== avv) continue;
      for (const pc of presa.carte) if (pc.r === cima.r) v -= 3;
    }
  }
  // quanto ha fretta di chiudere, secondo lo stesso giudizio già usato dal
  // livello 3 (strategiaPartita): una mano più leggera vale di più se
  // conviene chiudere presto, un po' meno se conviene inseguire un gioco
  // grosso.
  const fretta = { chiudi: 3, equilibrata: 1.5, punta: 0.5 }[strategiaPartita(g, p)];
  v -= fretta * g.hands[p].length;
  return v;
}

/** Prova una mossa su una copia dello stato e restituisce il valore
    risultante per `p` (vedi valoreStato) — non tocca `g`. `applica`
    riceve la copia e ci fa la mossa vera (draw/meldNew/addToMeld/
    discard...); se non è andata a buon fine, restituisce null. */
function valutaMossa(g, p, applica) {
  const copia = clonaStato(g);
  const r = applica(copia);
  if (!r || r.ok === false) return null;
  return valoreStato(copia, p);
}

/**
 * UNA sola mossa di calata o attacco. Ritorna quel che ha fatto, oppure null.
 * Spezzare il turno in mosse singole serve all'interfaccia, che le mostra
 * una alla volta invece di far comparire tutto insieme.
 */
function calataComputer(g, p, stato) {
  const livello = livelloComputer(g, p);
  if (livello === 4) return calataPro2(g, p, stato);
  const forzaUscita = livello === 3 && puoUscireCalando(g, p);

  // 1) attacca una carta a un gioco già aperto della squadra. Il livello 3
  // lo fa nell'ordine giusto: prima i giochi più vicini al burraco (200/150/
  // 100 punti sono in palio lì, non su un gioco appena iniziato), gli altri
  // livelli nell'ordine in cui li trovano sul tavolo.
  const propriGiochi = livello === 3
    ? teamMelds(g, p).slice().sort((a, b) => b.slots.length - a.slots.length)
    : teamMelds(g, p);
  for (const m of propriGiochi) {
    for (const c of [...g.hands[p]]) {
      if (canBeWild(c) && m.matte > 0) continue;           // una sola matta per gioco
      if (canBeWild(c) && burracoType(m) === null && m.slots.length < 6) continue; // non sprecare matte su un gioco appena iniziato
      if (!canAttach(m, c)) continue;
      const test = solveWith(m, c);
      if (!test) continue;
      if (test.matte > m.matte && !canBeWild(c)) continue;
      if (livello >= 2 && canBeWild(c) && !forzaUscita && !mattaConviene(g, p, m, c, test)) continue;
      // la matta di riserva (livello 3) conta solo per aprire un gioco nuovo, sotto:
      // attaccarla a un gioco già in corso è quasi sempre una buona mossa, mai sprecata.
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
    if (livello === 2 && !forzaUscita && !aprireConviene(g, p, cand, stato ? stato.aperte : 0)) continue;
    // Livello 3 tiene "almeno una matta in mano" — ma solo passivamente:
    // una matta vale sempre 100 in utilitaCarta (mai la prima scartata) e
    // mattaConviene protegge già un burraco pulito. Un blocco attivo qui,
    // che rifiuti di calare pur di risparmiare la matta, è stato provato e
    // scartato: nelle partite simulate (tools/simula-livelli.js) faceva
    // perdere di più il livello 3 di quanto la riserva facesse guadagnare,
    // perché una combinazione in mano non calata è punti regalati
    // all'avversario se la mano finisce prima. Meglio calare.
    if (meldNew(g, p, cand.map(c => c.id)).ok) {
      if (stato) stato.aperte++;
      return { t: 'meld', n: cand.length };
    }
  }
  return null;
}

/** Livello 4: prova ogni attacco e ogni combinazione nuova possibile
    simulandoli (valutaMossa), e fa quello che porta al valore di stato più
    alto — invece delle soglie fisse aprireConviene/mattaConviene degli
    altri livelli. Se nessuna mossa migliora lo stato, non fa niente: torna
    null, il turno passa allo scarto (mai un blocco che tiene tutto e non
    scarta mai — vedi turnoComputer/scartaComputer, sempre garantito).
    Un'eccezione: se si può restare senza carte calando (puoUscireCalando,
    la stessa mossa forte che insegue il livello 3), niente esitazioni —
    quella si fa comunque, anche se il calcolo fine sembrasse indeciso. */
function calataPro2(g, p, stato) {
  const forzaUscita = puoUscireCalando(g, p);
  // Stessa decisività del livello 3 (Pro): attacca sempre ai propri giochi,
  // nell'ordine giusto (prima quelli più vicini al burraco), e cala sempre
  // ogni combinazione nuova possibile, senza il freno aprireConviene del
  // livello 2 — provato e scartato anche lì (vedi sopra): tenersi una
  // combinazione pronta in mano è quasi sempre punti regalati se la mano
  // finisce prima. La differenza dinamica sta in UN punto solo, dove il
  // livello 3 usa una soglia fissa (mattaConviene): qui si prova davvero la
  // mossa (valutaMossa) e si guarda se lo stato risultante è comunque
  // buono, invece di applicare la stessa regola a ogni matta.
  const propriGiochi = teamMelds(g, p).slice().sort((a, b) => b.slots.length - a.slots.length);
  for (const m of propriGiochi) {
    for (const c of [...g.hands[p]]) {
      if (canBeWild(c) && m.matte > 0) continue;
      if (canBeWild(c) && burracoType(m) === null && m.slots.length < 6) continue;
      if (!canAttach(m, c)) continue;
      const test = solveWith(m, c);
      if (!test || (test.matte > m.matte && !canBeWild(c))) continue;
      if (canBeWild(c) && !forzaUscita) {
        const base = valoreStato(g, p);
        const v = valutaMossa(g, p, copia => addToMeld(copia, p, m.id, [c.id]));
        if (v === null || v < base) continue;   // questa matta, qui, conviene di più tenerla
      }
      if (addToMeld(g, p, m.id, [c.id]).ok) return { t: 'add', meld: m.id, n: 1 };
    }
  }
  const cands = findNewMelds(g.hands[p]);
  cands.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.filter(canBeWild).length - b.filter(canBeWild).length;
  });
  for (const cand of cands) {
    if (meldNew(g, p, cand.map(c => c.id)).ok) {
      if (stato) stato.aperte++;
      return { t: 'meld', n: cand.length };
    }
  }
  return null;
}

/** Punteggio di utilità di una carta rispetto al resto della mano. */
function utilitaCarta(g, p, c, livello) {
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
  // carte che regalano punti all'avversario — più attento dal livello 2 in su.
  // Qui `u` è "quanto vale tenersi questa carta": scartaComputer scarta sempre
  // la carta con `u` più basso. Una carta pericolosa deve quindi ALZARE `u`
  // (si scarta per ultima, si preferisce tenerla o giocarla), mai abbassarlo —
  // abbassarlo la fa scartare PRIMA delle altre, cioè il contrario di quello
  // che deve succedere. (Bug reale, trovato da Fabio giocando: il livello Pro
  // scartava proprio le carte più pericolose per l'avversario umano, perché
  // il segno era invertito fin da questa formula precedente il livello 2/3.)
  const avv = g.teams[1 - g.teamOf[p]].melds;
  const peso = soglie(livello).pesoRischio;
  for (const m of avv) if (canAttach(m, c)) u += peso;
  if (livello >= 2) {
    // margine di sicurezza: anche una carta solo vicina a un gioco avversario è rischiosa
    for (const m of avv) {
      if (m.type === 'seq' && m.suit === c.s && (Math.abs(c.r - m.lo) <= 2 || Math.abs(c.r - m.hi) <= 2)) u += peso / 2;
    }
  }
  if (livello >= 3) {
    // livello Pro: ricorda anche cosa l'avversario ha preso dal monte scarti
    // (evento pubblico — non è mai uno sguardo nella sua mano). Solo lo
    // stesso rango: lo stesso seme da solo è un segnale troppo debole e,
    // sommato su più prese nella stessa mano, finiva per far scartare male
    // anche carte innocue (provato con tools/simula-livelli.js: toglierlo
    // ha portato il livello 3 da sotto il 50% a un solido vantaggio).
    for (const presa of (g.preseDalMonte || [])) {
      if (g.teamOf[presa.p] === g.teamOf[p]) continue;
      for (const pc of presa.carte) {
        if (pc.r === c.r) u += 2;
      }
    }
  }
  return u - cardValue(c) / 10;
}

/** La pesca: dal tallone, o tutto il monte scarti se conviene. */
function pescaComputer(g, p) {
  if (g.phase !== 'draw') return null;
  const livello = livelloComputer(g, p);
  if (livello === 4) return pescaPro2(g, p);
  const strategia = livello === 3 ? strategiaPartita(g, p) : 'equilibrata';
  let takePile = false;
  if (g.discard.length > 0) {
    const before = g.hands[p].length;
    const withPile = g.hands[p].concat(g.discard);
    const nuoviGiochi = findNewMelds(withPile);
    const gain = nuoviGiochi.length - findNewMelds(g.hands[p]).length;
    const melds = teamMelds(g, p);
    // attachable: quante carte del monte si agganciano a un proprio gioco.
    // attachableOro: fra quelle, quante lo porterebbero a 6+ carte (a un
    // passo dal burraco o oltre) — un'occasione che vale sempre, anche in
    // fondo alla mano, non solo quando c'è ancora tempo per smaltirla.
    // attachableBurraco: fra le agganciabili, quante completano subito un
    // burraco (gioco a 6 carte che arriva a 7) — 100/150/200 punti in palio
    // sul colpo, il livello 3 non se li lascia scappare per un monte grosso.
    let attachable = 0, attachableOro = 0, attachableBurraco = 0;
    for (const c of g.discard) {
      const m = melds.find(mm => canAttach(mm, c));
      if (m) {
        attachable++;
        if (m.slots.length >= 5) attachableOro++;
        if (m.slots.length === 6) attachableBurraco++;
      }
    }
    // con il pozzetto preso e senza burraco vanno tenute due carte: un gioco che
    // svuoterebbe la mano non è calabile, e prendere il monte sarebbe inutile
    const min = minimoDaTenere(g, p, null, null);
    const giocabile = attachable > 0 || nuoviGiochi.some(c => withPile.length - c.length >= min);
    const value = g.discard.reduce((s, c) => s + cardValue(c), 0);
    // la carta scoperta in cima al monte è una matta (jolly o due): vale
    // quasi sempre la pena prenderla, per Facile e Medio — una matta è
    // rarissima e utile ovunque, non serve aspettare un'occasione migliore
    // per riconoscerne il valore. "Quasi" perché resta comunque soggetta al
    // limite di non riempirsi troppo la mano, più sotto.
    const cimaÈMatta = g.discard.length > 0 && canBeWild(g.discard[0]);
    // il livello 3 gioca in ampiezza: raccoglie molto più volentieri, anche
    // monti meno ricchi o più tenendosi una mano più piena, per avere sempre
    // materiale per il gioco più lungo e più pulito possibile. Provato con
    // tools/simula-livelli.js: è la singola modifica che ha dato al Pro un
    // vantaggio vero su Medio (dal 50% a oltre il 60% di vittorie, con un
    // margine di punteggio medio di oltre 200 punti a partita) — i freni più
    // fini (l'ordine delle calate, non sprecare matte, ecc.) da soli non
    // bastavano: serviva più materiale in mano per farne uso. Soglie in
    // `soglie(livello)` (vedi sopra "IL COMPUTER"): stessi numeri di prima.
    let { sogliaValore, maxScarti, maxMano } = soglie(livello);
    if (strategia === 'punta') { sogliaValore = Math.min(sogliaValore, 40); maxScarti = Math.max(maxScarti, 16); }  // insegue punti: più disposto a ingolfarsi per un gioco grosso
    if (strategia === 'chiudi') { maxMano = Math.min(maxMano, 13); }                                                // vuole chiudere: non si appesantisce
    if (livello === 1) {
      // meno selettivo: non controlla se il monte è davvero giocabile subito
      if ((gain >= 1 && g.discard.length <= 14) || attachable >= 1 || cimaÈMatta) takePile = true;
    } else {
      // a inizio/metà mano c'è tutto il tempo per smaltire quello che si
      // prende, quindi basta anche una sola carta che allunghi un proprio
      // gioco; verso la fine (tallone sotto le 20 carte, come in
      // mattaConviene) conviene invece essere più selettivi e aspettare
      // un'occasione migliore — a meno che non sia già "d'oro" (vicina al
      // burraco), quella vale sempre.
      const prestoNellaMano = g.stock.length > 20;
      const sogliaAttach = prestoNellaMano ? 1 : 2;
      if ((gain >= 1 && giocabile && g.discard.length <= maxScarti) ||
          (attachable >= sogliaAttach && g.discard.length <= maxScarti) ||
          (attachableOro >= 1 && g.discard.length <= maxScarti) ||
          (livello === 2 && cimaÈMatta) ||
          (g.discard.length >= 4 && value >= sogliaValore && g.discard.length <= 10)) takePile = true;
    }
    if (g.stock.length === 0) takePile = true;
    if (before > maxMano) takePile = false;
    // il livello 3 non rinuncia mai a un monte che chiude subito un burraco,
    // nemmeno se la mano è già piena: 100-200 punti sul colpo valgono più di
    // qualche carta di scorta in mano, ed è comunque la stessa mossa che
    // farebbe un giocatore vero.
    if (livello === 3 && attachableBurraco >= 1 && g.discard.length <= 20) takePile = true;
  }
  let r = draw(g, p, takePile ? 'pile' : 'stock');
  if (!r.ok) r = draw(g, p, takePile ? 'stock' : 'pile');
  if (!r.ok) { nextTurn(g); return null; }
  return takePile ? 'pile' : 'stock';
}

/** Livello 4: prendere il monte è l'unica delle due pescate che si può
    davvero simulare (si sa esattamente cosa contiene) — si confronta il
    valore di stato risultante con una stima di cosa varrebbe pescare dal
    tallone (valoreMedioNascosto: quella carta resta nascosta anche al
    livello 4, non si sbircia). Niente soglie fisse su quante carte, quanto
    valgono, quanto piena è la mano: solo maxMano resta come rete di
    sicurezza, condivisa con gli altri livelli. */
function pescaPro2(g, p) {
  const { sogliaValore, maxScarti, maxMano } = soglie(4);
  const strategia = strategiaPartita(g, p);
  let takePile = false;
  if (g.discard.length > 0) {
    const before = g.hands[p].length;
    const withPile = g.hands[p].concat(g.discard);
    const melds = teamMelds(g, p);
    // Le stesse tre spie che usa il livello 3, ma con soglie ancora più
    // larghe (vedi soglie(4) sopra) — "gioca in ampiezza" è la singola
    // regola che si è rivelata più efficace di ogni raffinatezza, quindi
    // qui si spinge ancora oltre invece di reinventarla.
    let attachable = 0, attachableOro = 0, attachableBurraco = 0;
    for (const c of g.discard) {
      const m = melds.find(mm => canAttach(mm, c));
      if (m) {
        attachable++;
        if (m.slots.length >= 5) attachableOro++;
        if (m.slots.length === 6) attachableBurraco++;
      }
    }
    const nuoviGiochi = findNewMelds(withPile);
    const gain = nuoviGiochi.length - findNewMelds(g.hands[p]).length;
    const min = minimoDaTenere(g, p, null, null);
    const giocabile = attachable > 0 || nuoviGiochi.some(c => withPile.length - c.length >= min);
    const value = g.discard.reduce((s, c) => s + cardValue(c), 0);
    const cimaÈMatta = canBeWild(g.discard[0]);
    const prestoNellaMano = g.stock.length > 20;
    const sogliaAttach = prestoNellaMano ? 1 : 2;
    let sv = sogliaValore, ms = maxScarti;
    if (strategia === 'punta') { sv = Math.min(sv, 30); ms = Math.max(ms, 18); }
    if ((gain >= 1 && giocabile && g.discard.length <= ms) ||
        (attachable >= sogliaAttach && g.discard.length <= ms) ||
        (attachableOro >= 1 && g.discard.length <= ms) ||
        cimaÈMatta ||
        (g.discard.length >= 4 && value >= sv && g.discard.length <= 12)) takePile = true;
    // rifinitura dinamica: quando le spie sopra non bastano a decidere,
    // si prova davvero la mossa e si guarda dove porta (valutaMossa),
    // contro una stima di cosa varrebbe una pescata alla cieca dal tallone
    // (valoreMedioNascosto — quella carta resta nascosta anche qui).
    if (!takePile) {
      const conMonte = valutaMossa(g, p, copia => draw(copia, p, 'pile'));
      if (conMonte !== null) {
        const stimaPescata = valoreStato(g, p) - valoreMedioNascosto(g, p);
        if (conMonte > stimaPescata + 4) takePile = true;   // margine: solo se è chiaramente meglio
      }
    }
    if (g.stock.length === 0) takePile = true;
    if (before > maxMano) takePile = false;
    if (attachableBurraco >= 1 && g.discard.length <= 24) takePile = true;
  }
  let r = draw(g, p, takePile ? 'pile' : 'stock');
  if (!r.ok) r = draw(g, p, takePile ? 'stock' : 'pile');
  if (!r.ok) { nextTurn(g); return null; }
  return takePile ? 'pile' : 'stock';
}

/** Lo scarto: la carta meno utile che sia lecito scartare. */
function scartaComputer(g, p) {
  const livello = livelloComputer(g, p);
  if (livello === 4) return scartaPro2(g, p);
  const scored = g.hands[p].map(c => ({ c, u: utilitaCarta(g, p, c, livello) }));
  scored.sort((a, b) => a.u - b.u);
  // Non è una regola del gioco: è solo un accorgimento per il computer, per
  // evitare che riprenda dal monte una carta e la ributti lì all'infinito
  // (il loop visto succedere in partite vere). La carta appena presa non è
  // esclusa dagli scarti possibili, viene solo messa in fondo alla lista dei
  // tentativi: il computer la sceglie comunque se non ha niente di meglio.
  if (g.presaMonteId != null && scored.length > 1) {
    const i = scored.findIndex(x => x.c.id === g.presaMonteId);
    if (i >= 0) scored.push(scored.splice(i, 1)[0]);
  }
  for (const x of scored) {
    const r = discard(g, p, x.c.id);
    if (r.ok) return x.c;
  }
  nextTurn(g);   // caso limite: nessuno scarto possibile
  return null;
}

/** Livello 4: prova a scartare ogni carta in mano, simulando (valutaMossa)
    e guardando lo stato che ne risulta — invece di ordinare per un
    punteggio di utilità calcolato a priori (utilitaCarta). Include già da
    solo il rischio di regalare punti all'avversario (valoreStato guarda la
    carta scoperta in cima al monte dopo lo scarto) e il "non sprecare un
    burraco pulito", senza bisogno di pesi a parte. */
function scartaPro2(g, p) {
  const candidati = g.hands[p]
    .map(c => ({ c, v: valutaMossa(g, p, copia => discard(copia, p, c.id)) }))
    .filter(x => x.v !== null);
  candidati.sort((a, b) => b.v - a.v);
  // stesso accorgimento anti-loop degli altri livelli (vedi g.presaMonteId
  // più sopra, non è una regola del gioco): la carta appena presa dal
  // monte va in fondo alla lista dei tentativi.
  if (g.presaMonteId != null && candidati.length > 1) {
    const i = candidati.findIndex(x => x.c.id === g.presaMonteId);
    if (i >= 0) candidati.push(candidati.splice(i, 1)[0]);
  }
  for (const x of candidati) {
    const r = discard(g, p, x.c.id);
    if (r.ok) return x.c;
  }
  nextTurn(g);   // caso limite: nessuno scarto possibile
  return null;
}

/** Turno completo, tutto in una volta (usato dai test e dalle simulazioni). */
function turnoComputer(g, p) {
  if (g.handOver || g.turn !== p) return;
  if (g.phase === 'draw') pescaComputer(g, p);
  if (g.handOver || g.turn !== p) return;
  const stato = { aperte: 0 };
  let guard = 0;
  while (guard++ < 45 && calataComputer(g, p, stato)) if (g.handOver) return;
  if (g.handOver) return;
  if (g.hands[p].length === 0) return;   // pozzetto preso al volo
  scartaComputer(g, p);
}

/* ---------- Export ---------- */
const ENGINE = {
  SUITS, SUIT_SYM, SUIT_RED, RANK_LABEL, BURRACO_POINTS, BONUS_CHIUSURA, MALUS_POZZETTO,
  cardValue, cardLabel, isJolly, isPinella, canBeWild, buildDeck, makeRng, shuffle,
  solveSeq, solveSet, solveMeld, solveWith, meldCards, canAttach, burracoType, meldPoints,
  spostamentoLecito, cartaCheServe,
  newGame, startHand, nextHand, endHand, draw, meldNew, addToMeld, discard, nextTurn, turnoUfficio,
  teamMelds, hasBurraco, canEmptyHand, canMeldToZero, minimoDaTenere, findNewMelds, sortCards,
  LIVELLI_COMPUTER, livelloComputer, carteVisibili, puoUscireCalando, strategiaPartita,
  turnoComputer, pescaComputer, calataComputer, scartaComputer,
  valoreStato, valoreMedioNascosto,
  applicaMossa, inizioMano, rigiocaMano, annullabile, annulla,
};
export default ENGINE;
