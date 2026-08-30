/* Prova, giocando, se i tre livelli del computer sono ordinati come devono
   essere: Pro batte Medio, Medio batte Facile — non solo sulla carta.
   Nessuna libreria, gira in pochi secondi.
   Uso: node tools/simula-livelli.js [quante-partite-per-confronto] */
import E from '../src/engine.js';

const N = Number(process.argv[2]) || 200;
const NOMI = { 1: 'Facile', 2: 'Medio', 3: 'Pro' };

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
    `${NOMI[livA]} vince ${vinteA}/${finite} (${(100 * vinteA / finite).toFixed(0)}%), ` +
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

console.log('\n--- Verdetto ---');
const dice = (r, chiA, chiB) => r.vinteB > r.vinteA
  ? `${chiB} batte davvero ${chiA} (come deve essere).`
  : `${chiB} NON batte ${chiA} in pratica — da rivedere.`;
console.log(dice(r12, 'Facile', 'Medio'));
console.log(dice(r23, 'Medio', 'Pro'));
console.log(dice(r13, 'Facile', 'Pro'));
