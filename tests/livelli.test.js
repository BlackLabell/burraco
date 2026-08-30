/* Test dei tre livelli del computer (Facile/Medio/Pro). Non "il livello 3
   vince di più" (che si vede con la simulazione, tools/simula-livelli.js),
   ma le singole regole descritte da Fabio, isolate una per una. */
import { test } from 'node:test';
import E from '../src/engine.js';

const t = (nome, fn) => test(nome, fn);
function assert(c, m) { if (!c) throw new Error(m || 'condizione non verificata'); }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ` atteso ${JSON.stringify(b)}, ottenuto ${JSON.stringify(a)}`); }

let uid = 5000;
const C = (r, s) => ({ id: uid++, r, s });
const JOLLY = () => ({ id: uid++, r: 0, s: 'J' });

/** Un tavolo pulito, pronto per essere manipolato a mano: stessa tecnica
    usata in engine.test.js. */
function tavolo(livelli) {
  const g = E.newGame('1v1', { seed: 9001 });
  if (livelli) g.livelli = livelli;
  g.turn = 0; g.phase = 'meld';
  return g;
}

console.log('--- Livello: chi decide cosa ---');

t('senza scelta, il livello è Medio (2)', () => {
  const g = tavolo();
  eq(E.livelloComputer(g, 0), 2);
  eq(E.livelloComputer(g, 1), 2);
});

t('il livello si legge da g.livelli, posto per posto', () => {
  const g = tavolo([null, 3]);
  eq(E.livelloComputer(g, 0), 2, 'null non è un livello valido: ripiega su Medio');
  eq(E.livelloComputer(g, 1), 3);
});

t('g.livelli sopravvive a inizioMano (serve solo alla UI dopo un annulla)', () => {
  const g = E.newGame('2v2', { seed: 42, livelli: [null, 1, 2, 3] });
  const b = E.inizioMano(g);
  eq(JSON.stringify(b.livelli), JSON.stringify([null, 1, 2, 3]));
});

console.log('--- Livello 2 e 3: non sprecare una matta su un burraco già pulito ---');

function burracoPulito(g) {
  // 4♣ 5♣ 6♣ 7♣ 8♣ 9♣ 10♣ — sette carte naturali, nessuna matta: pulito.
  const carte = [4, 5, 6, 7, 8, 9, 10].map(r => C(r, 'F'));
  g.hands[0] = [...carte, C(2, 'P')]; // una carta in più, per non restare a mano vuota
  const r = E.meldNew(g, 0, carte.map(c => c.id));
  assert(r.ok, r.error);
  return g.teams[0].melds[0];
}

t('livello 1 usa la matta anche su un burraco già pulito (non ci pensa)', () => {
  const g = tavolo([1, null]);
  const m = burracoPulito(g);
  g.hands[0] = [JOLLY()];
  const mossa = E.calataComputer(g, 0);
  assert(mossa && mossa.t === 'add', 'il livello 1 doveva attaccare la matta');
  eq(g.teams[0].melds.find(x => x.id === m.id).matte, 1);
});

t('livello 2 NON usa la matta su un burraco già pulito', () => {
  const g = tavolo([2, null]);
  const m = burracoPulito(g);
  g.hands[0] = [JOLLY()];
  const mossa = E.calataComputer(g, 0);
  assert(!mossa, 'il livello 2 non doveva trovare mosse: solo la matta in mano, e non conviene giocarla');
  eq(g.teams[0].melds.find(x => x.id === m.id).matte, 0, 'il burraco doveva restare pulito');
  eq(g.hands[0].length, 1, 'la matta doveva restare in mano');
});

t('livello 3 NON usa la matta su un burraco già pulito, fuori dall\'inseguimento del pozzetto', () => {
  const g = tavolo([3, null]);
  burracoPulito(g);
  g.teams[0].pozzetto = true; // già preso: niente "al volo" da inseguire
  g.hands[0] = [JOLLY(), C(9, 'P')]; // due carte, così non si tocca canEmptyHand/vicoloCieco
  const mossa = E.calataComputer(g, 0);
  assert(!mossa, 'il livello 3 non doveva toccare un burraco già pulito senza un buon motivo');
});

console.log('--- Livello 2 e 3: aspettare la carta naturale se è ancora viva ---');

t('livello 2 aspetta se il naturale che completerebbe il burraco è ancora tutto da vedere', () => {
  const g = tavolo([2, null]);
  // 4♣..9♣: sei carte, zero matte. Manca il 10♣ (o il 3♣) per arrivare a 7.
  const carte = [4, 5, 6, 7, 8, 9].map(r => C(r, 'F'));
  g.hands[0] = [...carte, C(2, 'P')];
  const r = E.meldNew(g, 0, carte.map(c => c.id));
  assert(r.ok, r.error);
  g.hands[0] = [JOLLY()];
  const mossa = E.calataComputer(g, 0);
  assert(!mossa, 'il 10♣ (o il 3♣) non è ancora uscito da nessuna parte: conveniva aspettare');
});

t('livello 2 usa la matta se il naturale che manca è ormai introvabile', () => {
  const g = tavolo([2, null]);
  const carte = [4, 5, 6, 7, 8, 9].map(r => C(r, 'F'));
  g.hands[0] = [...carte, C(2, 'P')];
  let r = E.meldNew(g, 0, carte.map(c => c.id));
  assert(r.ok, r.error);
  // entrambe le copie del 10♣ e del 3♣ sono già uscite (finite nel monte scarti):
  // aspettare non serve più a niente, tanto vale chiudere subito con la matta.
  g.discard = [C(10, 'F'), C(10, 'F'), C(3, 'F'), C(3, 'F'), ...g.discard];
  g.hands[0] = [JOLLY()];
  const mossa = E.calataComputer(g, 0);
  assert(mossa && mossa.t === 'add', 'con il naturale ormai introvabile, la matta andava usata');
});

console.log('--- Livello 2: non apre due combinazioni deboli nello stesso turno ---');

t('livello 2 non apre una seconda combinazione debole nello stesso turno', () => {
  const g = tavolo([2, null]);
  // 5♠ _ 7♠ con un jolly a fare da 6: tris/scala di 3 carte con una matta, "debole".
  const deboli = [C(5, 'P'), JOLLY(), C(7, 'P')];
  g.hands[0] = deboli;
  const giaUnaAperta = { aperte: 1 }; // come se il computer avesse già aperto una combinazione debole prima
  const mossa = E.calataComputer(g, 0, giaUnaAperta);
  assert(!mossa, 'una seconda combinazione debole nello stesso turno non doveva partire');
});

t('livello 2 apre comunque una combinazione solida (4+ carte) anche a turno pieno', () => {
  const g = tavolo([2, null]);
  const solida = [C(5, 'P'), JOLLY(), C(7, 'P'), C(8, 'P')]; // 4 carte: non è "debole"
  g.hands[0] = solida;
  const giaUnaAperta = { aperte: 1 };
  const mossa = E.calataComputer(g, 0, giaUnaAperta);
  assert(mossa && mossa.t === 'meld', 'una combinazione solida si cala comunque');
});

console.log('--- Livello 3: la matta si tiene passivamente, non bloccando le calate ---');

t('livello 3 cala comunque una combinazione debole con la matta, se conviene calare', () => {
  const g = tavolo([3, null]);
  // Nessun gioco già aperto: la sola mossa possibile è aprirne uno nuovo con
  // la matta. Provato empiricamente (tools/simula-livelli.js): un blocco
  // attivo per "risparmiare" questa matta fa perdere più partite di quante
  // ne faccia vincere, quindi il livello 3 la gioca.
  g.hands[0] = [JOLLY(), C(5, 'P'), C(7, 'P'), C(9, 'C')]; // niente combinazioni SENZA la matta
  const mossa = E.calataComputer(g, 0);
  assert(mossa && mossa.t === 'meld', 'la combinazione con la matta doveva partire');
});

t('livello 3 gioca la matta se è l\'ultima carta in mano (deve pur scartare o chiudere)', () => {
  const g = tavolo([3, null]);
  const carte = [4, 5, 6, 7, 8, 9].map(r => C(r, 'F'));
  g.hands[0] = [...carte, C(13, 'P')];
  let r = E.meldNew(g, 0, carte.map(c => c.id));
  assert(r.ok, r.error);
  g.hands[0] = [JOLLY()]; // una sola carta, proprio la matta
  const mossa = E.calataComputer(g, 0);
  assert(mossa && mossa.t === 'add', 'con una sola carta in mano, quella si gioca');
});

t('nessun livello scarta una matta se ha alternative (riserva passiva)', () => {
  const g = tavolo([3, null]);
  g.hands[0] = [JOLLY(), C(9, 'C')];
  const scartata = E.scartaComputer(g, 0);
  assert(scartata && scartata.r === 9, 'doveva scartare il 9♣, non la matta');
  assert(g.hands[0].length === 1 && g.hands[0][0].r === 0, 'la matta doveva restare in mano');
});

console.log('--- Livello 3: il pozzetto al volo ---');

t('puoUscireCalando riconosce quando si può restare senza carte', () => {
  const g = tavolo();
  const carte = [4, 5, 6].map(r => C(r, 'F'));
  g.hands[0] = carte;
  eq(E.puoUscireCalando(g, 0), true);
});

t('puoUscireCalando è sempre falso se il pozzetto è già stato preso', () => {
  const g = tavolo();
  g.teams[0].pozzetto = true;
  g.hands[0] = [4, 5, 6].map(r => C(r, 'F'));
  eq(E.puoUscireCalando(g, 0), false, 'niente "al volo" da inseguire: il pozzetto è già suo');
});

console.log('--- Livello 3: osserva il monte scarti (informazione pubblica) ---');

t('g.preseDalMonte registra chi prende il monte, e cosa c\'era dentro', () => {
  const g = E.newGame('1v1', { seed: 3 });
  g.turn = 0; g.phase = 'draw';
  const presa = C(9, 'C');
  g.discard = [presa];
  const r = E.draw(g, 0, 'pile');
  assert(r.ok, r.error);
  eq(g.preseDalMonte.length, 1);
  eq(g.preseDalMonte[0].p, 0);
  eq(g.preseDalMonte[0].carte.length, 1);
  eq(g.preseDalMonte[0].carte[0].r, 9);
  eq(g.preseDalMonte[0].carte[0].s, 'C');
});

t('g.preseDalMonte riparte vuoto a ogni mano nuova', () => {
  let g = E.newGame('1v1', { seed: 3 });
  g.turn = 0; g.phase = 'draw';
  g.discard = [C(9, 'C')];
  E.draw(g, 0, 'pile');
  assert(g.preseDalMonte.length === 1);
  g = E.nextHand({ ...g, matchScore: [0, 0], finished: false, dealer: g.dealer });
  eq(g.preseDalMonte.length, 0);
});

console.log('--- Livello 2 e 3: non scartare la carta pericolosa se c\'è un\'alternativa ---');
// Bug reale, trovato da Fabio giocando: `utilitaCarta` alzava il rischio con
// `u -= peso` invece di `u += peso`. Siccome scartaComputer scarta sempre la
// carta con `u` più basso, il segno sbagliato faceva scartare PRIMA proprio
// le carte più pericolose per l'avversario — il contrario di quello che
// doveva succedere. Questi test isolano proprio quel caso.

/** Mette una combinazione sul tavolo per la squadra dell'avversario di 0
    (posto 1), senza toccare il turno di 0 dopo. */
function meldAvversario(g, carte) {
  const prevTurn = g.turn, prevPhase = g.phase;
  g.turn = 1; g.phase = 'meld';
  g.hands[1] = carte.slice();
  const r = E.meldNew(g, 1, carte.map(c => c.id));
  assert(r.ok, r.error);
  g.turn = prevTurn; g.phase = prevPhase;
  return g.teams[g.teamOf[1]].melds[g.teams[g.teamOf[1]].melds.length - 1];
}

t('livello 2 scarta la carta neutra, non quella che regala punti all\'avversario', () => {
  const g = tavolo([2, null]);
  meldAvversario(g, [4, 5, 6].map(r => C(r, 'C'))); // 4♥ 5♥ 6♥ sul tavolo, dell'avversario
  const pericolosa = C(7, 'C');  // si aggancia alla scala avversaria
  const neutra = C(9, 'P');      // non serve a nessuno dei due giochi
  g.hands[0] = [pericolosa, neutra];
  const scartata = E.scartaComputer(g, 0);
  assert(scartata && scartata.id === neutra.id, 'doveva scartare la carta neutra, non quella pericolosa per l\'avversario');
});

t('livello 3 scarta la carta neutra, non quella che regala punti all\'avversario', () => {
  const g = tavolo([3, null]);
  meldAvversario(g, [4, 5, 6].map(r => C(r, 'C')));
  const pericolosa = C(3, 'C');  // si aggancia dall'altro lato della stessa scala
  const neutra = C(11, 'P');
  g.hands[0] = [pericolosa, neutra];
  const scartata = E.scartaComputer(g, 0);
  assert(scartata && scartata.id === neutra.id, 'doveva scartare la carta neutra, non quella pericolosa per l\'avversario');
});

console.log('--- Livello 2 e 3: prendere il monte per una sola carta utile ---');
// Bug reale segnalato da Fabio: il Pro non ha preso un monte che gli avrebbe
// allungato una scala da 4 a 5 carte, perché serviva ALMENO due carte
// agganciabili (`attachable >= 2`). Corretto una prima volta rendendolo
// sempre sufficiente; Fabio stesso ha fatto notare che così era anche
// meglio ma un po' troppo permissivo: a inizio mano va benissimo prendere
// anche per una carta sola (c'è tempo per smaltirla), ma in fondo alla
// mano conviene tornare a essere più selettivi e aspettare un'occasione
// migliore — a meno che non sia già un'occasione "d'oro" (vicina al
// burraco), quella vale sempre.

t('livello 2 prende il monte per una sola carta utile a inizio mano', () => {
  const g = tavolo([2, null]); // partita appena iniziata: tallone quasi pieno
  const carte = [4, 5, 6, 7].map(r => C(r, 'F')); // 4♣ 5♣ 6♣ 7♣, un proprio gioco da 4 carte
  g.hands[0] = [...carte, C(9, 'P')];
  let r = E.meldNew(g, 0, carte.map(c => c.id));
  assert(r.ok, r.error);
  g.hands[0] = [C(10, 'P'), C(2, 'Q')]; // due carte qualunque, non legate al gioco
  g.discard = [C(3, 'F')]; // allungherebbe 4♣..7♣ a 3♣..7♣: cinque carte
  g.phase = 'draw';
  const fonte = E.pescaComputer(g, 0);
  eq(fonte, 'pile', 'a inizio mano doveva prendere il monte anche per una sola carta utile');
});

t('livello 2 aspetta un\'occasione migliore per una sola carta utile, in fondo alla mano', () => {
  const g = tavolo([2, null]);
  g.stock = g.stock.slice(0, 15); // tallone quasi esaurito: siamo in fondo alla mano
  const carte = [4, 5, 6, 7].map(r => C(r, 'F')); // gioco da 4 carte, allungarlo a 5 non è ancora "oro"
  g.hands[0] = [...carte, C(9, 'P')];
  let r = E.meldNew(g, 0, carte.map(c => c.id));
  assert(r.ok, r.error);
  g.hands[0] = [C(10, 'P'), C(2, 'Q')];
  g.discard = [C(3, 'F')]; // una sola carta utile
  g.phase = 'draw';
  const fonte = E.pescaComputer(g, 0);
  eq(fonte, 'stock', 'in fondo alla mano, con una sola carta utile e niente di urgente, doveva pescare dal tallone');
});

t('livello 2 prende comunque il monte in fondo alla mano se la carta porta il gioco vicino al burraco', () => {
  const g = tavolo([2, null]);
  g.stock = g.stock.slice(0, 15); // tallone quasi esaurito
  const carte = [3, 4, 5, 6, 7].map(r => C(r, 'F')); // già a 5 carte: allungarlo diventa un'occasione "d'oro"
  g.hands[0] = [...carte, C(9, 'P')];
  let r = E.meldNew(g, 0, carte.map(c => c.id));
  assert(r.ok, r.error);
  g.hands[0] = [C(10, 'P'), C(2, 'Q')];
  g.discard = [C(8, 'F')]; // lo porta a 6 carte, a un passo dal burraco
  g.phase = 'draw';
  const fonte = E.pescaComputer(g, 0);
  eq(fonte, 'pile', 'un\'occasione vicina al burraco vale il monte anche in fondo alla mano');
});

console.log('--- Nessun livello guarda la mano di un altro posto ---');

t('carteVisibili non include mai la mano di un altro posto', () => {
  const g = E.newGame('2v2', { seed: 77 });
  const segrete = new Set(g.hands[1].map(c => c.id).concat(g.hands[2].map(c => c.id)).concat(g.hands[3].map(c => c.id)));
  const viste = E.carteVisibili(g, 0);
  for (const c of viste) assert(!segrete.has(c.id), 'una carta di un altro posto è finita fra le carte visibili a 0');
});
