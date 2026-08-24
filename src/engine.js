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
  g.discard = [];
  g.teams = [0, 1].map(() => ({ melds: [], pozzetto: false }));
  g.meldSeq = 0;
  g.turn = (g.dealer + 1) % g.nPlayers;
  g.phase = 'draw';
  g.handOver = false;
  g.result = null;
  g.tookPileThisTurn = false;
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
    g.log.push({ t: 'draw', p, src: 'pile' });
  } else {
    if (g.stock.length === 0) return err('Il tallone è esaurito: devi prendere gli scarti.');
    g.hands[p].push(g.stock.shift());
    g.hands[p].sort(sortCards);
    g.tookPileThisTurn = false;
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

function canEmptyHand(g, p) {
  const team = g.teamOf[p];
  return !g.teams[team].pozzetto || hasBurraco(g, team);
}

function meldNew(g, p, ids) {
  if (g.handOver) return err('Mano conclusa.');
  if (g.turn !== p || g.phase !== 'meld') return err('Azione non consentita ora.');
  const cards = findCards(g, p, ids);
  if (!cards) return err('Carte non valide.');
  const sol = solveMeld(cards);
  if (!sol) return err('Combinazione non valida: serve una scala dello stesso seme o un tris, con al massimo una matta.');
  if (cards.length === g.hands[p].length && !canEmptyHand(g, p)) {
    return err('Non puoi calare tutte le carte: ti serve almeno un burraco per chiudere.');
  }
  g.hands[p] = g.hands[p].filter(c => !cards.includes(c));
  sol.id = ++g.meldSeq;
  sol.team = g.teamOf[p];
  teamMelds(g, p).push(sol);
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
  if (cards.length === g.hands[p].length && !canEmptyHand(g, p)) {
    return err('Non puoi calare tutte le carte: ti serve almeno un burraco per chiudere.');
  }
  g.hands[p] = g.hands[p].filter(c => !cards.includes(c));
  sol.id = m.id; sol.team = m.team;
  melds[melds.indexOf(m)] = sol;
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
  // tallone esaurito e monte scarti vuoto: mano bloccata
  if (g.stock.length === 0 && g.discard.length === 0) endHand(g, null);
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
      if (g.hands[p].length === 1 && !canEmptyHand(g, p)) continue;
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
    if (cand.length === g.hands[p].length && !canEmptyHand(g, p)) continue;
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
    const gain = findNewMelds(withPile).length - findNewMelds(g.hands[p]).length;
    const melds = teamMelds(g, p);
    let attachable = 0;
    for (const c of g.discard) if (melds.some(m => canAttach(m, c))) attachable++;
    const value = g.discard.reduce((s, c) => s + cardValue(c), 0);
    // conviene se il monte è ricco o sblocca giochi, ma non se ingolfa la mano
    if ((gain >= 1 && g.discard.length <= 12) || attachable >= 2 || (g.discard.length >= 4 && value >= 60 && g.discard.length <= 10)) takePile = true;
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
  newGame, startHand, nextHand, endHand, draw, meldNew, addToMeld, discard, nextTurn,
  teamMelds, hasBurraco, canEmptyHand, findNewMelds, sortCards,
  aiTurn, aiDraw, aiOneMeld, aiDiscard,
};
export default ENGINE;
