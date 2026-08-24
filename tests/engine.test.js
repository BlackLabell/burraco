/* Test del motore di gioco. Nessuna libreria: gira con `npm test`
   (cioè `node --test tests/`), che è incluso in Node. */
import { test } from 'node:test';
import E from '../src/engine.js';

const t = (nome, fn) => test(nome, fn);
function assert(c, m) { if (!c) throw new Error(m || 'condizione non verificata'); }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ` atteso ${b}, ottenuto ${a}`); }

let uid = 1000;
const C = (r, s) => ({ id: uid++, r, s });
const JOLLY = () => ({ id: uid++, r: 0, s: 'J' });

console.log('--- Combinazioni ---');

t('scala semplice 5-6-7 di picche', () => {
  const m = E.solveMeld([C(5, 'P'), C(6, 'P'), C(7, 'P')]);
  assert(m && m.type === 'seq', 'non riconosciuta'); eq(m.matte, 0);
});

t('scala di semi diversi non valida', () => {
  assert(E.solveSeq([C(5, 'P'), C(6, 'C'), C(7, 'P')]) === null);
});

t('tris di re', () => {
  const m = E.solveMeld([C(13, 'P'), C(13, 'C'), C(13, 'Q')]);
  assert(m && m.type === 'set'); eq(m.matte, 0);
});

t('tris con jolly = una matta', () => {
  const m = E.solveMeld([C(13, 'P'), C(13, 'C'), JOLLY()]);
  assert(m && m.type === 'set'); eq(m.matte, 1);
});

t('due matte nello stesso gioco non ammesse', () => {
  assert(E.solveMeld([C(13, 'P'), JOLLY(), JOLLY()]) === null);
  assert(E.solveMeld([C(9, 'P'), C(10, 'P'), JOLLY(), C(2, 'C'), C(13, 'P')]) === null);
});

t('asso alto Q-K-A', () => {
  const m = E.solveMeld([C(12, 'C'), C(13, 'C'), C(14, 'C')]);
  assert(m && m.type === 'seq'); eq(m.start, 12);
});

t('asso basso A-2-3 con pinella naturale', () => {
  const m = E.solveMeld([C(14, 'F'), C(2, 'F'), C(3, 'F')]);
  assert(m && m.type === 'seq', 'A-2-3 non riconosciuta');
  eq(m.matte, 0, 'la pinella in posizione naturale non è una matta:');
});

t('pinella di altro seme usata come matta', () => {
  const m = E.solveMeld([C(5, 'P'), C(2, 'C'), C(7, 'P')]);
  assert(m && m.type === 'seq'); eq(m.matte, 1);
});

t('pinella naturale + jolly nella stessa scala', () => {
  // A♠ 2♠ 3♠ 4♠ 5♠ + jolly al posto del 6♠
  const m = E.solveMeld([C(14, 'P'), C(2, 'P'), C(3, 'P'), C(4, 'P'), C(5, 'P'), JOLLY()]);
  assert(m && m.type === 'seq', 'non riconosciuta'); eq(m.matte, 1);
});

t('scala non può superare 13 carte', () => {
  const cards = [];
  for (let r = 2; r <= 14; r++) cards.push(C(r, 'C'));
  assert(E.solveSeq(cards) !== null, '13 carte devono andare bene');
  cards.push(C(14, 'C'));
  assert(E.solveSeq(cards) === null, '14 carte devono fallire');
});

t('tris non può superare 8 carte', () => {
  const c8 = [], c9 = [];
  for (let i = 0; i < 8; i++) c8.push(C(7, E.SUITS[i % 4]));
  for (let i = 0; i < 9; i++) c9.push(C(7, E.SUITS[i % 4]));
  assert(E.solveSet(c8) !== null); assert(E.solveSet(c9) === null);
});

console.log('--- Burrachi e punteggi ---');

t('burraco pulito = 200', () => {
  const m = E.solveMeld([C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C'), C(10, 'C')]);
  eq(E.burracoType(m), 'pulito'); eq(E.BURRACO_POINTS.pulito, 200);
});

t('burraco sporco = 100 (matta interna)', () => {
  const m = E.solveMeld([C(4, 'C'), C(5, 'C'), C(6, 'C'), JOLLY(), C(8, 'C'), C(9, 'C'), C(10, 'C')]);
  eq(E.burracoType(m), 'sporco');
});

t('burraco semipulito = 150 (matta in coda a 7 naturali)', () => {
  const m = E.solveMeld([C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C'), C(10, 'C'), JOLLY()]);
  eq(E.burracoType(m), 'semipulito');
});

t('6 carte non sono burraco', () => {
  const m = E.solveMeld([C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C')]);
  eq(E.burracoType(m), null);
});

t('valori delle carte', () => {
  eq(E.cardValue(JOLLY()), 30); eq(E.cardValue(C(2, 'C')), 20);
  eq(E.cardValue(C(14, 'C')), 15); eq(E.cardValue(C(13, 'C')), 10);
  eq(E.cardValue(C(8, 'C')), 10); eq(E.cardValue(C(7, 'C')), 5); eq(E.cardValue(C(3, 'C')), 5);
});

t('il mazzo ha 108 carte e 4 jolly', () => {
  const d = E.buildDeck();
  eq(d.length, 108); eq(d.filter(c => c.r === 0).length, 4);
  eq(d.filter(c => c.r === 2).length, 8);
});

console.log('--- Spostamento della matta ---');

t('la carta naturale sposta il jolly in coda', () => {
  const g = E.newGame('1v1', { seed: 5 });
  g.turn = 0; g.phase = 'meld';
  const c5 = C(5, 'P'), c7 = C(7, 'P'), j = JOLLY(), c6 = C(6, 'P');
  g.hands[0] = [c5, c7, j, c6];
  let r = E.meldNew(g, 0, [c5.id, j.id, c7.id]);
  assert(r.ok, r.error);
  const m = g.teams[0].melds[0];
  eq(m.matte, 1); eq(m.slots.length, 3);
  r = E.addToMeld(g, 0, m.id, [c6.id]);
  assert(r.ok, r.error);
  const m2 = g.teams[0].melds[0];
  eq(m2.slots.length, 4);
  eq(m2.matte, 1, 'resta una sola matta:');
  const wildIdx = m2.slots.findIndex(s => s.wild);
  assert(wildIdx === 0 || wildIdx === 3, 'la matta deve spostarsi a un\'estremità, invece è in posizione ' + wildIdx);
});

console.log('--- Regole di mano ---');

t('distribuzione: 11 carte a testa, 2 pozzetti da 11', () => {
  const g = E.newGame('2v2', { seed: 11 });
  for (let p = 0; p < 4; p++) eq(g.hands[p].length, 11, 'mano ' + p + ':');
  eq(g.pozzetti[0].length, 11); eq(g.pozzetti[1].length, 11);
  eq(g.stock.length, 108 - 44 - 22);
});

t('1v1: tallone da 64 carte', () => {
  const g = E.newGame('1v1', { seed: 3 });
  eq(g.stock.length, 108 - 22 - 22);
});

t('non si può calare prima di pescare', () => {
  const g = E.newGame('1v1', { seed: 7 });
  const r = E.meldNew(g, g.turn, [g.hands[g.turn][0].id]);
  assert(!r.ok);
});

t('prendere il monte scarti prende tutte le carte', () => {
  const g = E.newGame('1v1', { seed: 9 });
  g.discard = [C(9, 'C'), C(4, 'P'), C(11, 'F')];
  const p = g.turn; const n = g.hands[p].length;
  const r = E.draw(g, p, 'pile');
  assert(r.ok, r.error); eq(g.hands[p].length, n + 3); eq(g.discard.length, 0);
});

t('svuotare la mano prende il pozzetto, non chiude', () => {
  const g = E.newGame('1v1', { seed: 21 });
  g.turn = 0; g.phase = 'meld';
  const a = C(9, 'C'), b = C(9, 'P'), c = C(9, 'F'), d = C(4, 'Q');
  g.hands[0] = [a, b, c, d];
  let r = E.meldNew(g, 0, [a.id, b.id, c.id]);
  assert(r.ok, r.error);
  r = E.discard(g, 0, d.id);
  assert(r.ok, r.error);
  assert(r.pozzetto === true, 'doveva prendere il pozzetto');
  eq(g.hands[0].length, 11); eq(g.teams[0].pozzetto, true);
  assert(!g.handOver, 'la mano non deve finire');
});

t('non si chiude senza burraco', () => {
  const g = E.newGame('1v1', { seed: 22 });
  g.turn = 0; g.phase = 'meld'; g.teams[0].pozzetto = true;
  const a = C(9, 'C'), b = C(9, 'P'), c = C(9, 'F'), d = C(4, 'Q');
  g.hands[0] = [a, b, c, d];
  let r = E.meldNew(g, 0, [a.id, b.id, c.id]);
  assert(r.ok, r.error);
  r = E.discard(g, 0, d.id);
  assert(!r.ok, 'ha lasciato chiudere senza burraco');
  assert(!g.handOver);
});

t('non si chiude scartando una matta', () => {
  const g = E.newGame('1v1', { seed: 23 });
  g.turn = 0; g.phase = 'meld'; g.teams[0].pozzetto = true;
  const seq = [C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C'), C(10, 'C')];
  const j = JOLLY();
  g.hands[0] = [...seq, j];
  let r = E.meldNew(g, 0, seq.map(c => c.id));
  assert(r.ok, r.error);
  assert(E.hasBurraco(g, 0), 'burraco non rilevato');
  r = E.discard(g, 0, j.id);
  assert(!r.ok, 'ha permesso di chiudere con una matta');
});

t('chiusura valida: pozzetto + burraco + scarto', () => {
  const g = E.newGame('1v1', { seed: 24 });
  g.turn = 0; g.phase = 'meld'; g.teams[0].pozzetto = true;
  const seq = [C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C'), C(10, 'C')];
  const x = C(13, 'P');
  g.hands[0] = [...seq, x];
  let r = E.meldNew(g, 0, seq.map(c => c.id));
  assert(r.ok, r.error);
  r = E.discard(g, 0, x.id);
  assert(r.ok, r.error); assert(r.closed, 'non ha chiuso'); assert(g.handOver);
  const d = g.result.detail;
  eq(d[0].chiusura, 100);
  eq(d[0].burracoPoints, 200);
  eq(d[0].melds, 5 + 5 + 5 + 5 + 10 + 10 + 10);
  eq(d[0].pozzetto, 0);
  eq(d[1].pozzetto, -100, 'malus pozzetto avversario:');
  eq(d[0].total, 50 + 200 + 100);
});

t('le carte in mano si sottraggono', () => {
  const g = E.newGame('1v1', { seed: 25 });
  g.turn = 0; g.phase = 'meld'; g.teams[0].pozzetto = true; g.teams[1].pozzetto = true;
  const seq = [C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C'), C(10, 'C')];
  const x = C(13, 'P');
  g.hands[0] = [...seq, x];
  g.hands[1] = [C(14, 'P'), JOLLY()]; // 15 + 30
  E.meldNew(g, 0, seq.map(c => c.id));
  E.discard(g, 0, x.id);
  eq(g.result.detail[1].hand, 45);
  eq(g.result.detail[1].total, -45);
});

console.log('--- Coerenza del filtro rapido ---');

t('canAttach non scarta mai un attacco legale (fuzz su decine di migliaia di casi)', () => {
  const rng = E.makeRng(20260824);
  let checked = 0, legal = 0;
  for (let iter = 0; iter < 4000; iter++) {
    const deck = E.shuffle(E.buildDeck(), rng);
    const hand = deck.slice(0, 16);
    for (const group of E.findNewMelds(hand)) {
      const m = E.solveMeld(group);
      if (!m) continue;
      for (let k = 0; k < 6; k++) {
        const c = deck[20 + Math.floor(rng() * 60)];
        if (group.includes(c)) continue;
        const real = E.solveWith(m, c) !== null;
        const quick = E.canAttach(m, c);
        checked++;
        if (real) legal++;
        if (real && !quick) {
          throw new Error(`attacco legale scartato dal filtro: gioco ${m.type} ` +
            group.map(E.cardLabel).join(' ') + ' + ' + E.cardLabel(c));
        }
      }
    }
  }
  console.log(`      ${checked} coppie gioco/carta verificate, ${legal} attacchi legali, nessuno perso`);
  assert(checked > 20000 && legal > 2000, 'campione troppo piccolo: ' + checked + '/' + legal);
});

console.log('--- Partite simulate ---');

function simulate(mode, seed, maxTurns = 4000) {
  const g = E.newGame(mode, { seed });
  let turns = 0;
  while (!g.finished && turns < maxTurns) {
    if (g.handOver) { E.nextHand(g); continue; }
    const before = { p: g.turn, phase: g.phase, stock: g.stock.length, hand: g.hands[g.turn].length };
    E.aiTurn(g, g.turn);
    turns++;
    if (!g.handOver && g.turn === before.p && g.phase === before.phase &&
        g.stock.length === before.stock && g.hands[g.turn].length === before.hand) {
      throw new Error('stallo: il turno non avanza (mano ' + g.handNo + ')');
    }
    if (turns > maxTurns) break;
  }
  return { g, turns };
}

for (const mode of ['1v1', '2v2']) {
  for (const seed of [1, 2, 3, 7, 42, 99, 1234, 20260824]) {
    t(`partita completa ${mode} seed=${seed}`, () => {
      const { g, turns } = simulate(mode, seed);
      assert(g.finished, `partita non conclusa dopo ${turns} turni (punteggi ${g.matchScore})`);
      assert(g.matchScore[g.winner] >= g.target, 'vincitore sotto il target');
      // invariante: nessuna carta persa
      let count = g.stock.length + g.discard.length + g.pozzetti[0].length + g.pozzetti[1].length;
      for (const h of g.hands) count += h.length;
      for (const t2 of g.teams) for (const m of t2.melds) count += m.slots.length;
      eq(count, 108, 'carte totali:');
      // invariante: mai più di una matta per gioco
      for (const t2 of g.teams) for (const m of t2.melds) assert(m.matte <= 1, 'gioco con più di una matta');
    });
  }
}

t('nessuna carta duplicata durante una partita', () => {
  const g = E.newGame('2v2', { seed: 777 });
  for (let i = 0; i < 600 && !g.finished; i++) {
    if (g.handOver) { E.nextHand(g); continue; }
    E.aiTurn(g, g.turn);
    const ids = [];
    for (const h of g.hands) ids.push(...h.map(c => c.id));
    for (const t2 of g.teams) for (const m of t2.melds) ids.push(...m.slots.map(s => s.card.id));
    ids.push(...g.stock.map(c => c.id), ...g.discard.map(c => c.id));
    ids.push(...g.pozzetti[0].map(c => c.id), ...g.pozzetti[1].map(c => c.id));
    eq(new Set(ids).size, ids.length, 'id duplicati al turno ' + i + ':');
    eq(ids.length, 108, 'carte totali al turno ' + i + ':');
  }
});

t('statistiche di 40 mani: chiusure e burrachi plausibili', () => {
  let closes = 0, hands = 0, burr = 0;
  for (let s = 0; s < 40; s++) {
    const g = E.newGame('2v2', { seed: 5000 + s });
    for (let i = 0; i < 400 && !g.handOver; i++) E.aiTurn(g, g.turn);
    if (g.handOver) {
      hands++;
      if (g.result.closer !== null) closes++;
      burr += g.result.detail[0].burrachi.length + g.result.detail[1].burrachi.length;
    }
  }
  console.log(`      mani concluse ${hands}/40, con chiusura ${closes}, burrachi totali ${burr}`);
  assert(hands >= 38, 'troppe mani non concluse');
  assert(closes >= 30, 'troppe poche chiusure regolari: ' + closes);
  assert(burr >= 30, 'troppi pochi burrachi: ' + burr);
});
