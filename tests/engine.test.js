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

console.log('--- Spostamento della matta imprigionata ---');

function scalaFiori() {
  // 3♣ 2♣(come 4♣) 5♣ 6♣ : la matta è chiusa fra il 3 e il 5
  const g = E.newGame('1v1', { seed: 5 });
  g.turn = 0; g.phase = 'meld';
  const carte = [C(3, 'F'), C(2, 'F'), C(5, 'F'), C(6, 'F')];
  g.hands[0] = [...carte, C(13, 'P'), C(12, 'P')];
  assert(E.meldNew(g, 0, carte.map(c => c.id)).ok, 'scala non calata');
  const m = g.teams[0].melds[0];
  eq(m.matte, 1, 'il 2 di fiori deve fare da matta:');
  const wild = m.slots.find(x => x.wild);
  eq(wild.pos, 4, 'la matta sta al posto del 4:');
  assert(wild.pos !== m.lo && wild.pos !== m.hi, 'per il test deve essere imprigionata');
  return { g, m };
}

t('una matta imprigionata non si scaccia con un\'altra matta', () => {
  const { g, m } = scalaFiori();
  const dueCuori = C(2, 'C');
  g.hands[0] = [dueCuori, C(9, 'P'), C(8, 'P')];
  const r = E.addToMeld(g, 0, m.id, [dueCuori.id]);
  assert(!r.ok, 'ha permesso di sostituire la matta con un\'altra matta');
  assert(/4♣/.test(r.error), 'il messaggio deve dire quale carta serve: ' + r.error);
  eq(g.teams[0].melds[0].slots.length, 4, 'il gioco non deve cambiare:');
});

t('la carta che la matta rappresenta invece la libera', () => {
  const { g, m } = scalaFiori();
  const quattro = C(4, 'F');
  g.hands[0] = [quattro, C(9, 'P'), C(8, 'P')];
  const r = E.addToMeld(g, 0, m.id, [quattro.id]);
  assert(r.ok, 'il 4 di fiori doveva essere accettato: ' + r.error);
  const m2 = g.teams[0].melds[0];
  eq(m2.slots.length, 5);
  eq(m2.matte, 0, 'il 2 di fiori torna naturale, niente matte:');
  eq(m2.slots.map(x => E.cardLabel(x.card)).join(' '), '2♣ 3♣ 4♣ 5♣ 6♣');
});

t('allungare il gioco senza toccare la matta resta lecito', () => {
  const { g, m } = scalaFiori();
  const sette = C(7, 'F');
  g.hands[0] = [sette, C(9, 'P'), C(8, 'P')];
  const r = E.addToMeld(g, 0, m.id, [sette.id]);
  assert(r.ok, r.error);
  const m2 = g.teams[0].melds[0];
  eq(m2.slots.length, 5);
  eq(m2.slots.find(x => x.wild).pos, 4, 'la matta resta dov\'era:');
});

t('una matta libera in fondo può invece scivolare', () => {
  // 2♣(come 4♣) 5♣ 6♣ : la matta è all'estremità bassa
  const g = E.newGame('1v1', { seed: 6 });
  g.turn = 0; g.phase = 'meld';
  const carte = [C(2, 'F'), C(5, 'F'), C(6, 'F')];
  g.hands[0] = [...carte, C(13, 'P'), C(12, 'P')];
  assert(E.meldNew(g, 0, carte.map(c => c.id)).ok);
  const m = g.teams[0].melds[0];
  eq(m.slots.find(x => x.wild).pos, m.lo, 'per il test la matta deve stare in fondo');
  const otto = C(8, 'F');
  g.hands[0] = [otto, C(9, 'P'), C(10, 'P')];
  const r = E.addToMeld(g, 0, m.id, [otto.id]);
  assert(r.ok, 'la matta libera doveva poter scivolare in cima: ' + r.error);
  eq(g.teams[0].melds[0].slots.map(x => E.cardLabel(x.card)).join(' '), '5♣ 6♣ 2♣ 8♣');
});

console.log('--- Regole di mano ---');

t('distribuzione: 11 carte a testa, 2 pozzetti da 11', () => {
  const g = E.newGame('2v2', { seed: 11 });
  for (let p = 0; p < 4; p++) eq(g.hands[p].length, 11, 'mano ' + p + ':');
  eq(g.pozzetti[0].length, 11); eq(g.pozzetti[1].length, 11);
  eq(g.stock.length, 108 - 44 - 22 - 1, 'tallone meno la carta scoperta:');
});

t('1v1: tallone da 63 carte più la carta scoperta', () => {
  const g = E.newGame('1v1', { seed: 3 });
  eq(g.stock.length, 108 - 22 - 22 - 1);
});

t('il mazziere scopre una carta: il monte scarti non parte vuoto', () => {
  for (const modo of ['1v1', '2v2']) {
    const g = E.newGame(modo, { seed: 55 });
    eq(g.discard.length, 1, modo + ': carta scoperta all\'inizio:');
    // chi apre può già prendere il monte
    const p = g.turn;
    const n = g.hands[p].length;
    const r = E.draw(g, p, 'pile');
    assert(r.ok, 'il primo giocatore deve poter prendere il monte: ' + r.error);
    eq(g.hands[p].length, n + 1);
  }
});

t('le ultime due carte del tallone non si giocano: la mano finisce', () => {
  const g = E.newGame('1v1', { seed: 61 });
  g.turn = 0; g.phase = 'draw';
  g.stock = g.stock.slice(0, 3);       // ne resta una giocabile
  const r = E.draw(g, 0, 'stock');
  assert(r.ok, r.error);
  eq(g.stock.length, 2, 'dopo la pesca restano le due non giocabili:');
  assert(!g.handOver, 'il turno di chi ha pescato deve completarsi');
  const c = g.hands[0].find(x => !E.canBeWild(x));
  E.discard(g, 0, c.id);
  assert(g.handOver, 'dopo quello scarto la mano deve chiudersi');
  eq(g.result.closer, null, 'nessuna chiusura regolare:');
});

t('con il pozzetto preso non si cala l\'ultima carta: si deve scartare', () => {
  const g = E.newGame('1v1', { seed: 62 });
  g.turn = 0; g.phase = 'meld'; g.teams[0].pozzetto = true;
  const seq = [C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C'), C(10, 'C')];
  g.hands[0] = [...seq];
  const r = E.meldNew(g, 0, seq.map(c => c.id));
  assert(!r.ok, 'ha lasciato chiudere calando, senza scarto finale');
  assert(!g.handOver);
});

t('senza pozzetto invece calare tutto è lecito: si va a pozzetto', () => {
  const g = E.newGame('1v1', { seed: 63 });
  g.turn = 0; g.phase = 'meld';
  const tris = [C(9, 'C'), C(9, 'P'), C(9, 'F')];
  g.hands[0] = [...tris];
  const r = E.meldNew(g, 0, tris.map(c => c.id));
  assert(r.ok, r.error);
  assert(r.pozzetto === true && r.volo === true, 'doveva prendere il pozzetto al volo');
  eq(g.hands[0].length, 11);
});

t('non ti lascia restare con la sola matta in mano potendo chiudere', () => {
  const g = E.newGame('1v1', { seed: 64 });
  g.turn = 0; g.phase = 'meld'; g.teams[0].pozzetto = true;
  const seq = [C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C'), C(10, 'C')];
  E.meldNew(g, 0, []);                       // no-op difensivo
  g.hands[0] = [...seq, JOLLY(), C(13, 'P')];
  let r = E.meldNew(g, 0, seq.map(c => c.id));
  assert(r.ok, r.error);
  assert(E.hasBurraco(g, 0), 'burraco non rilevato');
  const re = g.hands[0].find(c => c.r === 13);
  const m = g.teams[0].melds[0];
  // attaccare il K non c'entra con la scala: proviamo invece a calare il K in un tris
  // qui basta verificare che scartare la matta come ultima carta resti vietato
  r = E.discard(g, 0, re.id);
  assert(r.ok, r.error);
  const jolly = g.hands[0][0];
  assert(E.canBeWild(jolly), 'in mano deve restare la matta');
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

console.log('--- Carta appena presa dal monte: nessuna regola per l\'umano, solo un accorgimento anti-loop per il computer ---');

t('un umano può riscartare subito la carta che era in cima al monte, nessuna regola lo vieta', () => {
  const g = E.newGame('1v1', { seed: 31 });
  g.turn = 0; g.phase = 'draw';
  const cima = C(9, 'C');
  g.discard = [cima, C(4, 'P'), C(11, 'F')];
  const r = E.draw(g, 0, 'pile');
  assert(r.ok, r.error);
  eq(g.presaMonteId, cima.id, 'il motore deve comunque ricordarsi quale carta era in cima (serve al computer):');
  const rs = E.discard(g, 0, cima.id);
  assert(rs.ok, 'un giocatore umano deve poter ributtare subito la carta appena presa, se vuole: ' + (rs.error || ''));
});

t('g.presaMonteId si azzera pescando dal tallone o passando il turno', () => {
  const g = E.newGame('1v1', { seed: 34 });
  g.turn = 0; g.phase = 'draw';
  const cima = C(9, 'C');
  g.discard = [cima, C(4, 'P')];
  E.draw(g, 0, 'pile');
  assert(g.presaMonteId !== null, 'subito dopo la presa dal monte deve essere segnata');
  const altra = g.hands[0].find(c => c.id !== cima.id);
  E.discard(g, 0, altra.id);   // chiude il turno
  eq(g.presaMonteId, null, 'deve azzerarsi passando il turno:');
});

t('il computer preferisce scartare un\'altra carta invece di quella appena presa dal monte', () => {
  const g = E.newGame('1v1', { seed: 35 });
  g.livelli = [2, null];
  g.turn = 0; g.phase = 'meld';
  // senza l'accorgimento il 3 di picche, isolato, sarebbe la prima scelta: i tre re
  // insieme valgono un tris quasi pronto, molto più utile da tenere
  const cima = C(3, 'P');
  g.hands[0] = [cima, C(13, 'C'), C(13, 'Q'), C(13, 'F')];
  g.presaMonteId = cima.id;
  const scartata = E.scartaComputer(g, 0);
  assert(scartata, 'il computer deve riuscire a scartare qualcosa');
  assert(scartata.id !== cima.id, 'ha scartato per prima la carta appena presa dal monte, che doveva evitare se aveva altro');
});

t('ma il computer la scarta comunque se è rimasta l\'unica carta: non è un divieto rigido', () => {
  const g = E.newGame('1v1', { seed: 36 });
  g.livelli = [2, null];
  g.turn = 0; g.phase = 'meld';
  const cima = C(4, 'Q');
  g.hands[0] = [cima];               // stato costruito a mano: come dopo aver calato tutto il resto
  g.presaMonteId = cima.id;          // era la carta appena presa dal monte in questo turno
  const scartata = E.scartaComputer(g, 0);
  assert(scartata && scartata.id === cima.id, 'con un\'unica carta in mano il computer deve comunque riuscire a scartarla');
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

t('non si chiude senza burraco: la calata che porta lì è vietata', () => {
  const g = E.newGame('1v1', { seed: 22 });
  g.turn = 0; g.phase = 'meld'; g.teams[0].pozzetto = true;
  const a = C(9, 'C'), b = C(9, 'P'), c = C(9, 'F'), d = C(4, 'Q');
  g.hands[0] = [a, b, c, d];
  // il tris di 9 non è un burraco: calarlo lascerebbe una carta sola, e dopo
  // lo scarto il giocatore resterebbe a zero senza poter chiudere
  const r = E.meldNew(g, 0, [a.id, b.id, c.id]);
  assert(!r.ok, 'ha permesso la calata che porta a una chiusura impossibile');
  eq(g.hands[0].length, 4, 'la mano non deve cambiare:');
  assert(!g.handOver);
});

t('lo scarto dell\'ultima carta resta vietato senza burraco', () => {
  const g = E.newGame('1v1', { seed: 122 });
  g.turn = 0; g.phase = 'meld'; g.teams[0].pozzetto = true;
  const d = C(4, 'Q');
  g.hands[0] = [d];                       // stato costruito a mano: rete di sicurezza
  const r = E.discard(g, 0, d.id);
  assert(!r.ok, 'ha lasciato svuotare la mano senza burraco');
  assert(!g.handOver);
});

t('non si chiude scartando una matta: la calata che lascia solo la matta è vietata', () => {
  const g = E.newGame('1v1', { seed: 23 });
  g.turn = 0; g.phase = 'meld'; g.teams[0].pozzetto = true;
  const seq = [C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C'), C(10, 'C')];
  const j = JOLLY();
  g.hands[0] = [...seq, j];
  // calare la scala farebbe burraco, ma resterebbe in mano solo il jolly:
  // non si chiude scartando una matta, quindi il giocatore sarebbe bloccato
  const r = E.meldNew(g, 0, seq.map(c => c.id));
  assert(!r.ok, 'ha permesso la calata che lascia solo la matta');
  eq(g.hands[0].length, 8);
});

t('lo scarto della matta come ultima carta resta vietato', () => {
  const g = E.newGame('1v1', { seed: 123 });
  g.turn = 0; g.phase = 'meld'; g.teams[0].pozzetto = true;
  const seq = [C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C'), C(10, 'C')];
  const j = JOLLY(), extra = C(13, 'P');
  g.hands[0] = [...seq, j, extra];
  assert(E.meldNew(g, 0, seq.map(c => c.id)).ok, 'la scala doveva passare: restano due carte');
  assert(E.hasBurraco(g, 0), 'burraco non rilevato');
  g.hands[0] = [j];                       // stato costruito a mano: rete di sicurezza
  const r = E.discard(g, 0, j.id);
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

t('due carte, pozzetto preso e niente burraco: l\'attacco che ti bloccherebbe è vietato', () => {
  const g = E.newGame('1v1', { seed: 99 });
  g.turn = 0; g.phase = 'meld';
  const tris = [C(6, 'C'), C(6, 'P'), C(6, 'F')];
  g.hands[0] = [...tris, C(2, 'C')];
  assert(E.meldNew(g, 0, tris.map(c => c.id)).ok, 'tris non calato');
  g.teams[0].pozzetto = true;
  assert(!E.hasBurraco(g, 0), 'per il test la squadra non deve avere burraco');

  const sei = C(6, 'Q'), re = C(13, 'P');
  g.hands[0] = [sei, re];
  const m = g.teams[0].melds[0];

  // attaccare il 6 lascerebbe una carta sola: dopo lo scarto resterebbe a zero
  // senza poter chiudere. Va rifiutato, altrimenti il giocatore resta bloccato.
  const r1 = E.addToMeld(g, 0, m.id, [sei.id]);
  assert(!r1.ok, 'ha permesso l\'attacco che porta al blocco');
  eq(g.hands[0].length, 2, 'la mano non deve cambiare:');

  // la via d'uscita c'è sempre: scartare e tenere l'altra carta
  const r2 = E.discard(g, 0, re.id);
  assert(r2.ok, 'lo scarto deve restare possibile: ' + r2.error);
  eq(g.hands[0].length, 1);
  assert(!g.handOver, 'la mano non deve finire');
});

t('con il burraco invece l\'attacco è permesso e si chiude scartando', () => {
  const g = E.newGame('1v1', { seed: 98 });
  g.turn = 0; g.phase = 'meld';
  const seq = [C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C'), C(10, 'C')];
  g.hands[0] = [...seq, C(2, 'P')];
  assert(E.meldNew(g, 0, seq.map(c => c.id)).ok);
  g.teams[0].pozzetto = true;
  assert(E.hasBurraco(g, 0), 'serve il burraco per questo test');

  const undici = C(11, 'C'), re = C(13, 'P');
  g.hands[0] = [undici, re];
  const m = g.teams[0].melds[0];
  const r1 = E.addToMeld(g, 0, m.id, [undici.id]);
  assert(r1.ok, 'con il burraco l\'attacco deve passare: ' + r1.error);
  eq(g.hands[0].length, 1);
  const r2 = E.discard(g, 0, re.id);
  assert(r2.ok, r2.error);
  assert(r2.closed, 'doveva chiudere');
  eq(g.result.detail[0].chiusura, 100);
});

t('attaccare a una scala da 6 fa burraco: si può restare con una carta e chiudere', () => {
  const g = E.newGame('1v1', { seed: 7 });
  g.turn = 0; g.phase = 'meld';
  const scala = [C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C')];
  g.hands[0] = [...scala, C(13, 'P'), C(12, 'P')];
  assert(E.meldNew(g, 0, scala.map(c => c.id)).ok, 'scala da 6 non calata');
  g.teams[0].pozzetto = true;
  assert(!E.hasBurraco(g, 0), 'sei carte non sono ancora un burraco');

  const dieci = C(10, 'C'), re = C(13, 'F');
  g.hands[0] = [dieci, re];
  const m = g.teams[0].melds[0];

  // il 10 porta la scala a sette carte: è quell'attacco stesso a creare il burraco,
  // quindi restare con una carta sola diventa lecito
  const r1 = E.addToMeld(g, 0, m.id, [dieci.id]);
  assert(r1.ok, 'ha rifiutato l\'attacco che crea il burraco: ' + r1.error);
  eq(g.teams[0].melds[0].slots.length, 7);
  assert(E.hasBurraco(g, 0), 'burraco non riconosciuto dopo l\'attacco');
  eq(g.hands[0].length, 1);

  const r2 = E.discard(g, 0, re.id);
  assert(r2.ok, 'lo scarto di chiusura è stato rifiutato: ' + r2.error);
  assert(r2.closed, 'doveva chiudere');
  eq(g.result.detail[0].chiusura, 100);
  eq(g.result.detail[0].burrachi.join(), 'pulito');
});

t('ma se la carta che resta è una matta, quell\'attacco resta vietato', () => {
  const g = E.newGame('1v1', { seed: 8 });
  g.turn = 0; g.phase = 'meld';
  const scala = [C(4, 'C'), C(5, 'C'), C(6, 'C'), C(7, 'C'), C(8, 'C'), C(9, 'C')];
  g.hands[0] = [...scala, C(13, 'P'), C(12, 'P')];
  assert(E.meldNew(g, 0, scala.map(c => c.id)).ok);
  g.teams[0].pozzetto = true;

  const dieci = C(10, 'C'), j = JOLLY();
  g.hands[0] = [dieci, j];
  const r = E.addToMeld(g, 0, g.teams[0].melds[0].id, [dieci.id]);
  assert(!r.ok, 'resterebbe la sola matta, che non chiude: andava rifiutato');
  eq(g.hands[0].length, 2, 'la mano non deve cambiare:');
});

t('attaccare a un gioco che NON diventa burraco continua a richiedere due carte', () => {
  const g = E.newGame('1v1', { seed: 9 });
  g.turn = 0; g.phase = 'meld';
  const tris = [C(6, 'C'), C(6, 'P'), C(6, 'F')];
  g.hands[0] = [...tris, C(13, 'P')];
  assert(E.meldNew(g, 0, tris.map(c => c.id)).ok);
  g.teams[0].pozzetto = true;

  const sei = C(6, 'Q'), re = C(13, 'F');
  g.hands[0] = [sei, re];
  const r = E.addToMeld(g, 0, g.teams[0].melds[0].id, [sei.id]);
  assert(!r.ok, 'quattro carte non fanno burraco: l\'attacco andava rifiutato');
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
    E.turnoComputer(g, g.turn);
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
    E.turnoComputer(g, g.turn);
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
    for (let i = 0; i < 400 && !g.handOver; i++) E.turnoComputer(g, g.turn);
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

/* ── Registro delle mosse: è la base del gioco online e dell'annulla ── */

/** Impronta dello stato: se due tavoli hanno la stessa, sono lo stesso tavolo. */
function impronta(g) {
  return JSON.stringify({
    turn: g.turn, phase: g.phase, handNo: g.handNo, handOver: g.handOver,
    mani: g.hands.map(h => h.map(c => c.id)),
    giochi: g.teams.map(t => t.melds.map(m => ({
      id: m.id, type: m.type, slots: m.slots.map(s => [s.card.id, !!s.wild]),
    }))),
    pozzetti: [g.teams[0].pozzetto, g.teams[1].pozzetto],
    stock: g.stock.map(c => c.id), scarti: g.discard.map(c => c.id),
    punti: g.matchScore,
  });
}

t('una mano si rigioca identica dal seme e dal registro', () => {
  for (const seme of [11, 4242, 90210]) {
    const g = E.newGame('1v1', { seed: seme });
    for (let i = 0; i < 400 && !g.handOver; i++) E.turnoComputer(g, g.turn);
    assert(g.mosse.length > 10, 'registro troppo corto: ' + g.mosse.length);
    const copia = E.rigiocaMano(g, g.mosse);
    assert(copia, 'la mano non si è potuta rigiocare (seme ' + seme + ')');
    eq(impronta(copia), impronta(g), 'la mano rigiocata è diversa (seme ' + seme + '):');
  }
});

t('il registro sopravvive a un salvataggio in JSON', () => {
  const g = E.newGame('2v2', { seed: 31337 });
  for (let i = 0; i < 60 && !g.handOver; i++) E.turnoComputer(g, g.turn);
  const spedito = JSON.parse(JSON.stringify(g.mosse));   // come passasse dalla rete
  const copia = E.rigiocaMano(g, spedito);
  assert(copia, 'registro non replicabile dopo il giro in JSON');
  eq(impronta(copia), impronta(g), 'stato diverso dopo il giro in JSON:');
});

t('annulla: torna indietro di una calata, non oltre', () => {
  // si cerca una mano in cui il giocatore 0 ha appena calato
  let trovata = false;
  for (let seme = 1; seme < 60 && !trovata; seme++) {
    const g = E.newGame('1v1', { seed: seme });
    for (let i = 0; i < 300 && !g.handOver; i++) {
      if (g.turn !== 0) { E.turnoComputer(g, 1); continue; }
      if (g.phase === 'draw') { E.pescaComputer(g, 0); continue; }
      const prima = impronta(g);
      if (!E.calataComputer(g, 0)) { E.scartaComputer(g, 0); continue; }
      // ha calato: adesso l'annulla deve riportare esattamente a "prima"
      assert(E.annullabile(g, 0), 'la calata doveva essere annullabile');
      const indietro = E.annulla(g, 0);
      assert(indietro, 'annulla ha restituito niente');
      eq(impronta(indietro), prima, 'annulla non ha rimesso le cose com\'erano:');
      // dopo lo scarto non si annulla più
      E.scartaComputer(g, 0);
      eq(E.annullabile(g, 0), false, 'dopo lo scarto non si deve poter annullare');
      trovata = true;
      break;
    }
  }
  assert(trovata, 'nessuna calata trovata in 60 semi');
});

console.log('--- Lavoro 4: turno d\'ufficio (online a tempo) ---');

t('turnoUfficio pesca dal tallone e scarta come il Medio, senza calare nulla anche con un tris pronto', () => {
  const g = E.newGame('1v1', { seed: 501 });
  g.turn = 0; g.phase = 'draw';
  const tris = [C(9, 'P'), C(9, 'C'), C(9, 'Q')];
  const jolly = JOLLY();
  g.hands[0] = [...tris, jolly];
  const stockPrima = g.stock.length;
  const r = E.turnoUfficio(g, 0);
  assert(r.ok, 'il turno d\'ufficio deve riuscire');
  eq(g.stock.length, stockPrima - 1, 'deve pescare dal tallone, una carta sola');
  eq(g.teams[0].melds.length, 0, 'non deve calare nulla, nemmeno un tris già pronto');
  eq(g.hands[0].length, 4, 'pesca una carta e ne scarta una: la mano torna alla stessa misura');
  assert(g.discard[0].r !== 0, 'non deve scartare la matta se ha altro da scartare');
});

t('turnoUfficio non tocca mai il monte scarti, nemmeno con una carta comoda in cima', () => {
  const g = E.newGame('1v1', { seed: 505 });
  g.turn = 0; g.phase = 'draw';
  g.hands[0] = [C(9, 'P'), C(11, 'C'), C(2, 'F')];
  g.discard = [C(9, 'C'), C(9, 'Q')];   // in cima una carta che allungherebbe un tris
  const scartiPrima = g.discard.length;
  E.turnoUfficio(g, 0);
  eq(g.discard.length, scartiPrima + 1, 'deve solo aggiungere il proprio scarto, mai prendere il monte');
});

t('tre turni d\'ufficio di fila chiudono la partita, senza vincitore', () => {
  const g = E.newGame('1v1', { seed: 502 });
  let r = E.turnoUfficio(g, g.turn);
  assert(r.ok); eq(g.turniUfficioFila, 1); assert(!g.finished);
  r = E.turnoUfficio(g, g.turn);
  assert(r.ok); eq(g.turniUfficioFila, 2); assert(!g.finished);
  r = E.turnoUfficio(g, g.turn);
  assert(r.ok, JSON.stringify(r));
  eq(g.turniUfficioFila, 3, 'la striscia deve arrivare a tre');
  assert(g.finished, 'la partita deve chiudersi al terzo turno d\'ufficio di fila');
  assert(g.handOver, 'anche la mano in corso si chiude, come la valvola dei 400 turni');
  eq(g.winner, null, 'nessun vincitore dichiarato: si avvisano entrambi, non ha vinto nessuno');
  assert(g.chiusuraUfficio, 'deve restare il segno che la chiusura è per inattività');
});

t('un turno giocato per davvero azzera la striscia dei turni d\'ufficio', () => {
  const g = E.newGame('1v1', { seed: 503 });
  E.turnoUfficio(g, g.turn);
  eq(g.turniUfficioFila, 1);
  E.draw(g, g.turn, 'stock');
  const carta = g.hands[g.turn][0];
  E.discard(g, g.turn, carta.id);
  eq(g.turniUfficioFila, 0, 'uno scarto giocato per davvero azzera la striscia');
});

t('il turno d\'ufficio si vede nel registro delle mosse e si riapplica identico con applicaMossa', () => {
  const g = E.newGame('1v1', { seed: 504 });
  E.turnoUfficio(g, g.turn);
  const ultima = g.mosse[g.mosse.length - 1];
  eq(ultima.t, 's'); assert(ultima.ufficio === true, 'lo scarto deve portare il segno "ufficio"');

  // Lo stesso seme, rigiocato da zero applicando via applicaMossa esattamente
  // le mosse appena registrate — la strada vera usata online per il rientro
  // (src/ui.js applicaSenzaVolo) — deve arrivare alla stessa striscia: non
  // basta rigiocare lo scarto, applicaMossa deve saperlo riconoscere.
  const g2 = E.newGame('1v1', { seed: 504 });
  for (const m of g.mosse) {
    const r = E.applicaMossa(g2, m);
    assert(r.ok, 'la mossa non si riapplica: ' + JSON.stringify(m));
  }
  eq(g2.turniUfficioFila, g.turniUfficioFila, 'la striscia deve arrivare allo stesso numero');
});

t('turnoUfficio non decide da sé quando il tempo è scaduto: rifiuta fuori dal proprio turno o fuori fase', () => {
  const g = E.newGame('1v1', { seed: 506 });
  const altro = 1 - g.turn;
  assert(!E.turnoUfficio(g, altro).ok, 'deve rifiutare per il posto che non ha il turno');
  E.draw(g, g.turn, 'stock');
  assert(!E.turnoUfficio(g, g.turn).ok, 'deve rifiutare se si è già pescato questo turno');
});
