/* Prova, giocando, se i quattro livelli del computer sono ordinati come
   devono essere: Pro 2 batte Pro, Pro batte Medio, Medio batte Facile —
   non solo sulla carta. Nessuna libreria, gira in pochi secondi/minuti a
   seconda di N (il livello 4 è più lento degli altri: simula davvero le
   mosse prima di sceglierle, vedi src/engine.js "LIVELLO 4").
   Uso: node tools/simula-livelli.js [quante-partite-per-confronto] */
import E from '../src/engine.js';

const N = Number(process.argv[2]) || 200;
const NOMI = { 1: 'Facile', 2: 'Medio', 3: 'Pro', 4: 'Pro 2' };

/** Una partita 1v1 fra due livelli, fino al traguardo (o a un tetto di
    sicurezza, così una simulazione che si impianta non gira per sempre). */
function partita(livA, livB, seed) {
  let g = E.newGame('1v1', { seed, target: 2005, livelli: [livA, livB] });
  let turni = 0;
  while (!g.finished && turni < 6000) {
    E.turnoComputer(g, g.turn);
    turni++;
    if (g.handOver && !g.finished) g = E.nextHand(g);
  }
  return { finita: g.finished, punti: g.matchScore, mani: g.handNo, turni };
}

function confronto(livA, livB) {
  let vinteA = 0, vinteB = 0, pari = 0, nonFinite = 0;
  let puntiA = 0, puntiB = 0, maniTot = 0;
  for (let i = 0; i < N; i++) {
    const r = partita(livA, livB, 100000 + i);
    if (!r.finita) { nonFinite++; continue; }
    puntiA += r.punti[0]; puntiB += r.punti[1]; maniTot += r.mani;
    if (r.punti[0] > r.punti[1]) vinteA++;
    else if (r.punti[1] > r.punti[0]) vinteB++;
    else pari++;
  }
  const finite = N - nonFinite;
  console.log(
    `${NOMI[livA]} vs ${NOMI[livB]}: ` +
    `${NOMI[livB]} vince ${vinteB}/${finite} (${(100 * vinteB / finite).toFixed(0)}%), ` +
    `punti medi ${Math.round(puntiA / finite)} vs ${Math.round(puntiB / finite)}, ` +
    `mani medie a partita ${(maniTot / finite).toFixed(1)}` +
    (nonFinite ? ` — ${nonFinite} partite non concluse entro il tetto di sicurezza` : '')
  );
  return { vinteA, vinteB, finite };
}

console.log(`Simulo ${N} partite per confronto (1v1, a 2005 punti)...\n`);
const r12 = confronto(1, 2);
const r23 = confronto(2, 3);
const r13 = confronto(1, 3);
const r24 = confronto(2, 4);
const r34 = confronto(3, 4);
const r14 = confronto(1, 4);

console.log('\n--- Verdetto ---');
const dice = (r, chiA, chiB, soglia) => {
  const pct = 100 * r.vinteB / r.finite;
  const ok = soglia ? pct >= soglia : r.vinteB > r.vinteA;
  return `${ok ? '' : 'NON '}${chiB} batte ${soglia ? `nettamente (≥${soglia}%) ` : ''}` +
    `${chiA} in pratica (${pct.toFixed(1)}%)${ok ? ' — come deve essere.' : ' — da rivedere.'}`;
};
console.log(dice(r12, 'Facile', 'Medio'));
console.log(dice(r23, 'Medio', 'Pro'));
console.log(dice(r13, 'Facile', 'Pro'));
console.log(dice(r24, 'Medio', 'Pro 2', 65));
console.log(dice(r34, 'Pro', 'Pro 2', 60));
console.log(dice(r14, 'Facile', 'Pro 2'));
