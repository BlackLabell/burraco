/* ============================================================
   BURRACO — interfaccia
   ============================================================ */
import E from './engine.js';

const $ = id => document.getElementById(id);

let G = null;
let sel = new Set();
let msg = '', msgErr = false;
let busy = false, dealing = false;
let sortMode = 'rank';
let handOrder = [];   // ordine scelto a mano dal giocatore
let dealCount = null;     // quante carte sono già state distribuite (null = distribuzione finita)
let pozzettoAnim = null;  // {p, n}: le carte del pozzetto che stanno arrivando in mano a p
const HUMAN = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Persistenza (best effort) ---------- */
const SAVE = 'burraco.stato.v1';
function save() {
  try { localStorage.setItem(SAVE, JSON.stringify({ g: G, sortMode, handOrder })); } catch (e) { }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d && d.g && d.g.hands) {
      sortMode = d.sortMode || 'rank';
      handOrder = Array.isArray(d.handOrder) ? d.handOrder : [];
      return d.g;
    }
  } catch (e) { }
  return null;
}
function loadTheme() {
  try { return localStorage.getItem('burraco.tema'); } catch (e) { return null; }
}

/* ---------- Carte ─────────────────────────────────────────────
   Taglio classico: indice (valore sopra, seme sotto) nell'angolo in
   alto a sinistra, ripetuto capovolto in basso a destra, e il segno
   grande al centro. Le figure mostrano la lettera incorniciata.     */
function cardHTML(c, extra = '', i = 0) {
  if (c.r === 0) {
    return `<div class="card jolly ${extra}" style="--i:${i}" data-id="${c.id}" title="Jolly">
      <span class="idx"><b>★</b></span>
      <span class="mid"><span class="pip">★</span><span class="nome">JOLLY</span></span>
      <span class="idx giu"><b>★</b></span>
    </div>`;
  }
  const red = E.SUIT_RED[c.s] ? 'red' : '';
  const R = E.RANK_LABEL[c.r], S = E.SUIT_SYM[c.s];
  const stretta = c.r === 10 ? 'dieci' : '';
  const figura = c.r >= 11 && c.r <= 13;
  const centro = figura
    ? `<span class="mid"><span class="figura">${R}</span></span>`
    : `<span class="mid"><span class="pip ${c.r === 14 ? 'asso' : ''}">${S}</span></span>`;
  const idx = `<b>${R}</b><i>${S}</i>`;
  return `<div class="card ${red} ${stretta} ${extra}" style="--i:${i}" data-id="${c.id}" title="${E.cardLabel(c)}">
    <span class="idx">${idx}</span>${centro}<span class="idx giu">${idx}</span>
  </div>`;
}
function backHTML() { return `<div class="card back"></div>`; }
function slotHTML() { return `<div class="slot"></div>`; }

/** Le scale si posano in verticale, i tris in orizzontale, come sul tavolo vero. */
function meldHTML(m, clickable) {
  const cards = m.slots.map(s => cardHTML(s.card, s.wild ? 'wild' : '')).join('');
  const b = E.burracoType(m);
  const classi = [
    'meld',
    m.type === 'seq' ? 'scala' : 'tris',
    b ? 'burraco ' + b : '',
    clickable ? 'target' : '',
  ].join(' ');
  const punti = b ? `<span class="punti">+${E.BURRACO_POINTS[b]}</span>` : '';
  return `<div class="${classi}" data-meld="${m.id}"><div class="row">${cards}</div>${punti}</div>`;
}

function ordina(h) {
  if (sortMode === 'suit') {
    h.sort((a, b) => {
      const sa = a.r === 0 ? 9 : E.SUITS.indexOf(a.s), sb = b.r === 0 ? 9 : E.SUITS.indexOf(b.s);
      if (sa !== sb) return sa - sb;
      return (a.r === 0 ? 99 : a.r) - (b.r === 0 ? 99 : b.r);
    });
  } else h.sort(E.sortCards);
  return h;
}

/**
 * La mano nell'ordine scelto dal giocatore. Le carte nuove (pescate o
 * arrivate col pozzetto) si accodano ordinate, senza scombinare il resto.
 */
function manoOrdinata() {
  const resto = new Map(G.hands[HUMAN].map(c => [c.id, c]));
  const out = [];
  for (const id of handOrder) {
    const c = resto.get(id);
    if (c) { out.push(c); resto.delete(id); }
  }
  out.push(...ordina([...resto.values()]));
  handOrder = out.map(c => c.id);
  return out;
}

/* ---------- Render ---------- */

function teamChips(team) {
  const out = [];
  if (G.teams[team].pozzetto) out.push(`<span class="chip on">pozzetto preso</span>`);
  if (E.hasBurraco(G, team)) out.push(`<span class="chip on">burraco</span>`);
  return out.join(' ');
}

/** La mano coperta di un altro giocatore, a ventaglio. */
function seatHTML(p) {
  let n = G.hands[p].length;
  if (dealCount !== null) n = Math.min(n, dealCount);
  if (pozzettoAnim && pozzettoAnim.p === p) n = pozzettoAnim.n;
  const gioca = G.turn === p && !G.handOver && dealCount === null;
  const mostrate = Math.min(n, 13);
  let fan = '';
  for (let i = 0; i < mostrate; i++) {
    const rot = (i - (mostrate - 1) / 2) * 3.4;
    fan += `<div class="card back" style="transform:rotate(${rot.toFixed(1)}deg)"></div>`;
  }
  return `<div class="seat ${gioca ? 'now' : ''}">
    <div class="fan ${n ? '' : 'empty'}">${fan}</div>
    <div class="who"><b>${G.names[p]}</b> · ${n} ${n === 1 ? 'carta' : 'carte'}${gioca ? ' · gioca' : ''}</div>
  </div>`;
}
function seatsOf(team) {
  const out = [];
  for (let p = 0; p < G.nPlayers; p++) if (G.teamOf[p] === team && p !== HUMAN) out.push(seatHTML(p));
  return out.join('');
}

/**
 * I giochi di una squadra, riordinati (prima i tris, poi le scale, per valore)
 * e rimpiccioliti man mano che il tavolo si riempie, così restano tutti in vista.
 */
function meldsHTML(team, clickable) {
  const melds = [...G.teams[team].melds].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'set' ? -1 : 1;
    return (a.type === 'set' ? a.rank : a.lo) - (b.type === 'set' ? b.rank : b.lo);
  });
  const carte = melds.reduce((s, m) => s + m.slots.length, 0);
  const stretto = window.innerWidth < 620;
  let cw = carte <= 14 ? 44 : carte <= 24 ? 39 : carte <= 34 ? 34 : carte <= 46 ? 30 : 27;
  if (stretto) cw = Math.round(cw * 0.82);
  return {
    cw,
    html: melds.map(m => meldHTML(m, clickable(m))).join(''),
  };
}

function render() {
  const myTurn = !busy && !G.handOver && G.turn === HUMAN;
  // carte scelte, e cosa ci si può fare davvero
  const scelte = G.hands[HUMAN].filter(c => sel.has(c.id));
  const puoAgire = myTurn && G.phase === 'meld' && scelte.length > 0;
  const calataValida = puoAgire && scelte.length >= 3 && E.solveMeld(scelte) !== null;
  const accetta = m => puoAgire && E.solveWith(m, scelte) !== null;

  /* — avversari — */
  const oppM = meldsHTML(1, () => false);
  const oppMelds = G.teams[1].melds.length
    ? oppM.html
    : `<p class="empty-note">Non hanno ancora calato niente.</p>`;

  /* — centro — */
  const canDraw = myTurn && G.phase === 'draw';
  const scartaQui = myTurn && G.phase === 'meld' && scelte.length === 1;

  // il monte scarti si vede tutto: le ultime carte a ventaglio, la più recente in cima
  const MOSTRA = window.innerWidth < 620 ? 6 : 9;
  const visibili = G.discard.slice(0, MOSTRA).reverse();
  const nascoste = G.discard.length - visibili.length;
  const montaggio = visibili.length
    ? `<div class="scarti">${nascoste ? `<span class="altre">+${nascoste}</span>` : ''}${visibili.map(c => cardHTML(c)).join('')}</div>`
    : slotHTML();

  const center = `
    <div class="state">
      <div class="now">${G.handOver ? 'Mano finita' : G.turn === HUMAN ? 'Tocca a te' : 'Turno di ' + G.names[G.turn]}</div>
    </div>
    <div class="piles">
      <div class="pile ${canDraw && G.stock.length ? 'click' : ''} ${G.stock.length ? '' : 'dim'}" data-act="stock">
        <div class="pilewrap">${G.stock.length ? backHTML() : slotHTML()}<span class="count">${G.stock.length}</span></div>
        <div class="cap">Tallone</div>
      </div>
      <div class="pile scartiera ${canDraw && G.discard.length ? 'click' : ''} ${scartaQui ? 'click bersaglio' : ''} ${G.discard.length ? '' : 'dim'}" data-act="pile">
        <div class="pilewrap">${montaggio}<span class="count">${G.discard.length}</span></div>
        <div class="cap">${scartaQui ? 'Scarta qui' : 'Monte scarti'}</div>
      </div>
    </div>
    <div class="pozzetti">
      <div class="pile ${G.teams[0].pozzetto ? 'dim' : ''}">
        <div class="pilewrap">${G.pozzetti[0].length ? backHTML() : slotHTML()}</div>
        <div class="cap">Pozzetto vostro<b>${G.teams[0].pozzetto ? 'preso' : G.pozzetti[0].length}</b></div>
      </div>
      <div class="pile ${G.teams[1].pozzetto ? 'dim' : ''}">
        <div class="pilewrap">${G.pozzetti[1].length ? backHTML() : slotHTML()}</div>
        <div class="cap">Pozzetto loro<b>${G.teams[1].pozzetto ? 'preso' : G.pozzetti[1].length}</b></div>
      </div>
    </div>`;

  /* — nostri giochi: è anche la zona dove si cala — */
  const myM = meldsHTML(0, accetta);
  let myMelds = myM.html;
  if (calataValida) {
    myMelds += `<div class="drop-note">Clicca qui per calare le ${scelte.length} carte scelte</div>`;
  }

  /* — mano — */
  let mano = manoOrdinata();
  if (dealCount !== null) mano = mano.slice(0, dealCount);
  if (pozzettoAnim && pozzettoAnim.p === HUMAN) mano = mano.slice(0, pozzettoAnim.n);
  const hand = mano.map((c, i) => cardHTML(c, sel.has(c.id) ? 'sel' : '', i)).join('');

  /* — azioni — */
  const canMeld = calataValida;
  const canDiscard = scartaQui;
  const quantiAccettano = G.teams[0].melds.filter(accetta).length;
  let hint = msg;
  if (!hint) {
    if (dealCount !== null) hint = 'Distribuzione in corso…';
    else if (G.handOver) hint = 'Mano conclusa.';
    else if (busy || G.turn !== HUMAN) hint = `Gioca ${G.names[G.turn]}…`;
    else if (G.phase === 'draw') hint = 'Clicca il tallone per pescare una carta, o il monte scarti per prenderlo tutto.';
    else if (calataValida) hint = 'Clicca la zona di calata per aprire il gioco.';
    else if (scelte.length >= 3) hint = 'Queste carte non formano una scala né un tris.';
    else if (scelte.length === 1) hint = quantiAccettano
      ? 'Clicca il monte scarti per scartarla, o il gioco evidenziato per attaccarla.'
      : 'Clicca il monte scarti per scartarla.';
    else if (scelte.length === 2) hint = 'Servono almeno 3 carte per aprire un gioco nuovo.';
    else hint = 'Scegli le carte dalla mano. Trascinale per riordinarle.';
  }

  const nMano = G.hands[HUMAN].length;
  $('board').className = 'panel board' + (myTurn && dealCount === null ? ' turno' : '');
  $('board').innerHTML = `
    <section class="zone">
      <div class="seat-label">${G.mode === '2v2' ? 'Avversari' : 'Avversario'} ${teamChips(1)}</div>
      <div class="seats">${seatsOf(1)}</div>
    </section>
    <section class="zone">
      <div class="seat-label">I loro giochi</div>
      <div class="melds" style="--cw:${oppM.cw}px">${oppMelds}</div>
    </section>

    <section class="zone mid"><div class="center">${center}</div></section>

    <section class="zone">
      <div class="seat-label">I vostri giochi ${teamChips(0)}</div>
      <div class="melds zona ${calataValida ? 'armata' : ''}" id="my-melds" style="--cw:${myM.cw}px">${myMelds}</div>
      ${G.mode === '2v2' ? `<div class="seats" style="margin-top:12px">${seatsOf(0)}</div>` : ''}
    </section>

    <section class="zone mano">
      <div class="seat-label">La tua mano <b>${nMano} ${nMano === 1 ? 'carta' : 'carte'}</b>
        ${sel.size ? `<span class="chip on">${sel.size} scelte</span>` : ''}
        <span class="chip">trascina per riordinare</span></div>
      <div class="hand ${dealing ? 'deal' : ''}" id="hand">${hand}</div>
      <div class="actions">
        <button class="btn primary" data-a="meld" ${canMeld ? '' : 'disabled'}>Cala</button>
        <button class="btn" data-a="discard" ${canDiscard ? '' : 'disabled'}>Scarta</button>
        <button class="btn ghost" data-a="sort">Riordina per ${sortMode === 'rank' ? 'seme' : 'valore'}</button>
        <span class="hint ${msgErr ? 'err' : ''}">${hint}</span>
      </div>
    </section>`;

  renderScore();
  renderLog();
}

function renderScore() {
  const t = G.target;
  const rows = [0, 1].map(i => {
    const label = G.mode === '2v2' ? (i === 0 ? 'Noi (Tu &amp; Nord)' : 'Loro (Est &amp; Ovest)') : (i === 0 ? 'Tu' : 'Computer');
    const pct = Math.max(0, Math.min(100, G.matchScore[i] / t * 100));
    return `<tr><td>${label}<div class="bar"><i style="width:${pct}%"></i></div></td>
      <td class="n">${G.matchScore[i]}</td></tr>`;
  }).join('');
  $('score').innerHTML = `<table><tr><th>Squadra</th><th style="text-align:right">Punti</th></tr>${rows}</table>
    <div class="goal">Partita a ${t} punti · mano n. ${G.handNo}</div>`;
  $('hand-no').textContent = G.mode === '2v2' ? 'a coppie' : 'uno contro uno';
}

function logLine(e) {
  const n = p => G.names[p];
  switch (e.t) {
    case 'hand': return { c: 'hi', h: `<b>Mano ${e.n}</b> — carte distribuite` };
    case 'draw': return { h: `${n(e.p)} ${e.src === 'pile' ? 'prende il monte scarti' : 'pesca dal tallone'}` };
    case 'meld': return { h: `${n(e.p)} cala ${e.n} carte` };
    case 'add': return { h: `${n(e.p)} attacca ${e.n} ${e.n === 1 ? 'carta' : 'carte'}` };
    case 'pozzetto': return { c: 'hi', h: `<b>${n(e.p)} va a pozzetto</b>${e.volo ? ' al volo' : ''}` };
    case 'discard': return { h: `${n(e.p)} scarta ${e.c}` };
    case 'end': return { c: 'hi', h: `<b>Mano chiusa</b> — ${e.pts[0] >= 0 ? '+' : ''}${e.pts[0]} / ${e.pts[1] >= 0 ? '+' : ''}${e.pts[1]}` };
  }
  return { h: '' };
}
let lastLogLen = -1;
function renderLog() {
  if (G.log.length === lastLogLen) return; // la cronaca cambia solo quando cambia il gioco
  lastLogLen = G.log.length;
  const out = [];
  for (let i = G.log.length - 1, n = 0; i >= 0 && n < 45; i--, n++) {
    const l = logLine(G.log[i]);
    if (l.h) out.push(`<div class="${l.c || ''}">${l.h}</div>`);
  }
  $('log').innerHTML = out.join('');
}

/* ---------- Interazioni (un solo ascoltatore, delegato) ---------- */
function scegli(id) {
  if (sel.has(id)) sel.delete(id); else sel.add(id);
  msg = ''; render();
}

function bindOnce() {
  const board = $('board');

  board.addEventListener('click', ev => {
    const pile = ev.target.closest('.pile[data-act]');
    if (pile) {
      const mio = !busy && !G.handOver && G.turn === HUMAN && dealCount === null;
      // una carta scelta + clic sul monte scarti = la scarti
      if (pile.dataset.act === 'pile' && mio && G.phase === 'meld' && sel.size === 1) doDiscard();
      else doDraw(pile.dataset.act);
      return;
    }
    const meld = ev.target.closest('#my-melds .meld.target');
    if (meld) { doAttack(+meld.dataset.meld); return; }
    const zona = ev.target.closest('#my-melds.armata');
    if (zona) { doMeld(); return; }
    const btn = ev.target.closest('button[data-a]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.a === 'meld') doMeld();
    else if (btn.dataset.a === 'discard') doDiscard();
    else {
      sortMode = sortMode === 'rank' ? 'suit' : 'rank';
      handOrder = [];               // l'ordinamento automatico ha la precedenza
      save(); render();
    }
  });

  /* Trascinamento delle carte in mano: funziona con mouse e con il dito.
     Se il dito non si muove, vale come selezione. */
  let trascina = null;

  board.addEventListener('pointerdown', ev => {
    if (ev.button > 0) return;
    const card = ev.target.closest('#hand .card');
    if (!card) return;
    trascina = { id: +card.dataset.id, x0: ev.clientX, y0: ev.clientY, el: card, mosso: false, ghost: null };
    try { card.setPointerCapture(ev.pointerId); } catch (e) { }
  });

  board.addEventListener('pointermove', ev => {
    if (!trascina) return;
    const dx = ev.clientX - trascina.x0, dy = ev.clientY - trascina.y0;
    if (!trascina.mosso) {
      if (Math.hypot(dx, dy) < 9) return;
      trascina.mosso = true;
      const r = trascina.el.getBoundingClientRect();
      const g = trascina.el.cloneNode(true);
      g.classList.add('ghost'); g.classList.remove('sel');
      g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
      document.body.appendChild(g);
      trascina.ghost = g;
      trascina.el.classList.add('dragging');
    }
    ev.preventDefault();
    trascina.ghost.style.left = ev.clientX + 'px';
    trascina.ghost.style.top = ev.clientY + 'px';
    segnaposto(ev);
  });

  const fine = ev => {
    if (!trascina) return;
    const t = trascina; trascina = null;
    if (t.ghost) t.ghost.remove();
    t.el.classList.remove('dragging');
    if (t.mosso) {
      const i = posizioneInserimento(ev, t.id);
      const ids = handOrder.filter(x => x !== t.id);
      ids.splice(i, 0, t.id);
      handOrder = ids;
      save(); render();
    } else {
      scegli(t.id);
    }
  };
  board.addEventListener('pointerup', fine);
  board.addEventListener('pointercancel', () => {
    if (!trascina) return;
    if (trascina.ghost) trascina.ghost.remove();
    trascina.el.classList.remove('dragging');
    trascina = null;
    render();
  });

  /** Mostra dove finirà la carta, aprendo un varco fra le altre. */
  function segnaposto(ev) {
    const carte = [...$('hand').querySelectorAll('.card')];
    carte.forEach(c => c.classList.remove('gap-before'));
    const i = posizioneInserimento(ev, trascina.id);
    const altre = carte.filter(c => +c.dataset.id !== trascina.id);
    if (altre[i]) altre[i].classList.add('gap-before');
  }

  /** Indice di inserimento: carta più vicina al puntatore, prima o dopo il suo centro. */
  function posizioneInserimento(ev, id) {
    const altre = [...$('hand').querySelectorAll('.card')].filter(c => +c.dataset.id !== id);
    if (!altre.length) return 0;
    let vicina = null, dist = Infinity, indice = 0;
    altre.forEach((c, k) => {
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // la distanza verticale pesa il doppio: così le righe non si confondono
      const d = Math.hypot(ev.clientX - cx, (ev.clientY - cy) * 2);
      if (d < dist) { dist = d; vicina = cx; indice = k; }
    });
    return ev.clientX > vicina ? indice + 1 : indice;
  }
}

function say(text, isErr) { msg = text || ''; msgErr = !!isErr; }

function after(r) {
  if (!r.ok) { say(r.error, true); render(); return false; }
  sel.clear(); dealing = false;
  if (r.pozzetto) say(r.volo ? 'Pozzetto preso al volo: continua il turno.' : 'Pozzetto preso.');
  else say('');
  save();
  return true;
}

function doDraw(src) {
  if (busy || G.turn !== HUMAN || G.phase !== 'draw') return;
  const r = E.draw(G, HUMAN, src);
  if (!after(r)) return;
  dealing = false; render();
}

async function doMeld() {
  const r = E.meldNew(G, HUMAN, [...sel]);
  if (!after(r)) return;
  render();
  if (r.pozzetto) await animaPozzetto(HUMAN);
  if (G.handOver) { finishHand(); return; }
  render();
}

async function doAttack(meldId) {
  const r = E.addToMeld(G, HUMAN, meldId, [...sel]);
  if (!after(r)) return;
  render();
  if (r.pozzetto) await animaPozzetto(HUMAN);
  if (G.handOver) { finishHand(); return; }
  render();
}

async function doDiscard() {
  const id = [...sel][0];
  const r = E.discard(G, HUMAN, id);
  if (!after(r)) return;
  render();
  if (r.pozzetto) await animaPozzetto(HUMAN);
  if (G.handOver) { finishHand(); return; }
  await runAI();
}

/** Il pozzetto: le 11 carte entrano in mano una alla volta, non di colpo. */
async function animaPozzetto(p) {
  const eraOccupato = busy;
  busy = true;
  const tot = G.hands[p].length;
  pozzettoAnim = { p, n: 0 };
  render();
  await sleep(200);
  for (let k = 1; k <= tot; k++) {
    pozzettoAnim.n = k;
    render();
    await sleep(105);
  }
  await sleep(280);
  pozzettoAnim = null;
  busy = eraOccupato;
  render();
}

/** Distribuzione: le carte arrivano una alla volta, come al tavolo. */
async function distribuisci() {
  busy = true;
  dealCount = 0;
  render();
  for (let k = 1; k <= 11; k++) {
    dealCount = k;
    render();
    await sleep(85);
  }
  await sleep(220);
  dealCount = null;
  dealing = false;
  busy = false;
  render();
}

/** Il turno del computer, mostrato mossa per mossa invece che tutto insieme. */
async function turnoComputer(p) {
  const squadra = G.teamOf[p];
  // se dopo una mossa la squadra è andata a pozzetto, mostralo carta per carta
  const controllaPozzetto = async prima => {
    if (!prima && G.teams[squadra].pozzetto && G.hands[p].length > 1) {
      say(`${G.names[p]} va a pozzetto`);
      await animaPozzetto(p);
    }
  };

  say(`${G.names[p]} pesca…`);
  render();
  await sleep(420);
  E.aiDraw(G, p);
  render();
  await sleep(430);

  let guard = 0;
  while (guard++ < 45) {
    const prima = G.teams[squadra].pozzetto;
    const mossa = E.aiOneMeld(G, p);
    if (!mossa) break;
    say(mossa.t === 'add' ? `${G.names[p]} attacca una carta` : `${G.names[p]} cala ${mossa.n} carte`);
    render();
    await sleep(380);
    await controllaPozzetto(prima);
    if (G.handOver) return;
  }
  if (G.handOver || G.hands[p].length === 0) return;

  say(`${G.names[p]} scarta…`);
  render();
  await sleep(300);
  const prima = G.teams[squadra].pozzetto;
  E.aiDiscard(G, p);
  render();
  await sleep(320);
  await controllaPozzetto(prima);
}

async function runAI() {
  busy = true;
  while (!G.handOver && G.turn !== HUMAN) {
    const p = G.turn;
    await turnoComputer(p);
    if (G.turn === p && !G.handOver) break;   // sicurezza: il turno non avanza
  }
  busy = false;
  say('');
  save();
  render();
  if (G.handOver) finishHand();
}

/* ---------- Finestre ---------- */
function closeModal() { $('overlay').innerHTML = ''; }
function modal(title, sub, body, footer) {
  $('overlay').innerHTML = `<div class="veil"><div class="modal" role="dialog" aria-modal="true">
    <div class="mh"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
    <div class="mb">${body}</div><div class="mf">${footer}</div></div></div>`;
}

function finishHand() {
  const d = G.result.detail;
  const row = (label, f) => `<tr><td>${label}</td><td>${f(d[0])}</td><td>${f(d[1])}</td></tr>`;
  const sign = v => (v > 0 ? '+' : '') + v;
  const burr = x => x.burrachi.length
    ? x.burrachi.map(b => b[0].toUpperCase() + b.slice(1)).join(', ') + ` (+${x.burracoPoints})`
    : '—';
  const head = G.mode === '2v2' ? ['Noi', 'Loro'] : ['Tu', 'Computer'];
  const body = `<table class="sheet">
    <tr><th>Voce</th><th>${head[0]}</th><th>${head[1]}</th></tr>
    ${row('Carte calate', x => x.melds)}
    <tr><td>Burrachi</td><td>${burr(d[0])}</td><td>${burr(d[1])}</td></tr>
    ${row('Bonus chiusura', x => x.chiusura ? '+100' : '—')}
    ${row('Pozzetto non preso', x => x.pozzetto ? '−100' : '—')}
    ${row('Carte in mano', x => x.hand ? '−' + x.hand : '—')}
    <tr class="tot"><td>Totale mano</td><td>${sign(d[0].total)}</td><td>${sign(d[1].total)}</td></tr>
    <tr><td>Punteggio partita</td><td>${G.matchScore[0]}</td><td>${G.matchScore[1]}</td></tr>
  </table>`;

  if (G.finished) {
    const won = G.winner === 0;
    modal(won ? 'Partita vinta' : 'Partita persa',
      `${G.matchScore[0]} a ${G.matchScore[1]} — traguardo ${G.target} punti.`,
      body, `<button class="btn primary" id="m-new">Nuova partita</button>`);
    $('m-new').onclick = () => { closeModal(); newGameDialog(); };
  } else {
    const closer = G.result.closer;
    const sub = closer === null
      ? 'Carte esaurite: la mano finisce senza chiusura.'
      : `Ha chiuso ${G.names[closer]}.`;
    modal(`Fine mano ${G.handNo}`, sub, body,
      `<button class="btn primary" id="m-next">Mano successiva</button>`);
    $('m-next').onclick = async () => {
      closeModal();
      E.nextHand(G); sel.clear(); say(''); dealing = true; lastLogLen = -1; handOrder = [];
      save();
      await distribuisci();
      if (G.turn !== HUMAN) await runAI();
    };
  }
}

function newGameDialog() {
  const body = `<div class="opts">
    <label class="opt"><input type="radio" name="mode" value="1v1" checked>
      <span><b>Uno contro uno</b><small>Tu contro il computer. Due pozzetti, uno per parte.</small></span></label>
    <label class="opt"><input type="radio" name="mode" value="2v2">
      <span><b>A coppie, 2 contro 2</b><small>Tu e Nord contro Est e Ovest, come al circolo.</small></span></label>
    <label class="opt" style="margin-top:6px"><input type="radio" name="goal" value="2005" checked>
      <span><b>Partita a 2005 punti</b><small>Il traguardo classico: più mani, rimonte possibili.</small></span></label>
    <label class="opt"><input type="radio" name="goal" value="1005">
      <span><b>Partita a 1005 punti</b><small>Più breve, due o tre mani.</small></span></label>
  </div>`;
  modal('Nuova partita', 'Scegli modalità e traguardo.', body,
    `<button class="btn ghost" id="m-cancel">Annulla</button><button class="btn primary" id="m-go">Distribuisci</button>`);
  $('m-cancel').onclick = closeModal;
  $('m-go').onclick = async () => {
    const mode = document.querySelector('input[name=mode]:checked').value;
    const goal = +document.querySelector('input[name=goal]:checked').value;
    closeModal();
    G = E.newGame(mode, { target: goal });
    sel.clear(); say(''); dealing = true; lastLogLen = -1; handOrder = [];
    save();
    await distribuisci();
    if (G.turn !== HUMAN) await runAI();
  };
}

const RULES_HTML = `
<p>Si gioca con <b>due mazzi francesi più 4 jolly</b>, 108 carte in tutto. A ogni giocatore vanno
<b>11 carte</b>; si formano due <b>pozzetti</b> da 11 carte, uno per squadra; il resto è il tallone.</p>
<h3 style="font-size:14px;margin:14px 0 4px">Il turno</h3>
<ul>
  <li>Peschi <b>una carta dal tallone</b> oppure prendi <b>tutte le carte del monte scarti</b>.</li>
  <li>Puoi calare giochi nuovi e attaccare carte ai giochi già aperti della tua squadra.</li>
  <li>Chiudi il turno <b>scartando una carta</b>.</li>
</ul>
<h3 style="font-size:14px;margin:14px 0 4px">I giochi</h3>
<ul>
  <li><b>Scala</b>: 3 o più carte consecutive dello stesso seme, fino a 13. L'asso vale sopra il re o sotto il due.</li>
  <li><b>Tris</b>: 3 o più carte dello stesso valore, fino a 8.</li>
  <li>Jolly e pinelle (i 2) fanno da <b>matta</b>. Ogni gioco può contenere <b>una sola matta</b>.</li>
  <li>Il 2 del seme della scala, messo al suo posto naturale, <b>non</b> è una matta.</li>
  <li>Quando arriva la carta che la matta rappresenta, la matta si sposta automaticamente a un'estremità del gioco.</li>
</ul>
<h3 style="font-size:14px;margin:14px 0 4px">Pozzetto e chiusura</h3>
<ul>
  <li>Chi finisce le carte prende gli 11 del pozzetto della propria squadra. Se le finisce senza scartare, il pozzetto si prende <b>al volo</b> e il turno continua.</li>
  <li>Per chiudere servono tre cose: pozzetto preso, <b>almeno un burraco</b>, e nessuna carta in mano.</li>
  <li>Non si può chiudere scartando un jolly o una pinella.</li>
</ul>
<h3 style="font-size:14px;margin:14px 0 4px">Punteggi</h3>
<ul>
  <li>Jolly 30 · pinella (2) 20 · asso 15 · dal 8 al re 10 · dal 3 al 7 cinque punti.</li>
  <li><b>Burraco</b> = gioco di almeno 7 carte. <b>Pulito</b> (senza matte) 200 · <b>semipulito</b> (matta in coda ad almeno 7 carte naturali) 150 · <b>sporco</b> 100.</li>
  <li>Bonus di <b>chiusura</b>: 100. <b>Pozzetto non preso</b>: −100.</li>
  <li>Le carte calate si sommano, quelle rimaste in mano si sottraggono. Vince chi arriva prima al traguardo.</li>
</ul>`;

function rulesDialog() {
  modal('Regolamento', 'Burraco italiano, regole ufficiali.', RULES_HTML,
    `<button class="btn primary" id="m-ok">Chiudi</button>`);
  $('m-ok').onclick = closeModal;
}

/* ---------- Avvio ---------- */
bindOnce();
// ridisegna quando cambia la larghezza: le carte si adattano allo schermo
let ridisegno = null;
window.addEventListener('resize', () => {
  clearTimeout(ridisegno);
  ridisegno = setTimeout(() => { if (G) render(); }, 150);
});
$('btn-rules').onclick = rulesDialog;
$('btn-new').onclick = newGameDialog;
$('btn-theme').onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('burraco.tema', next); } catch (e) { }
};
const savedTheme = loadTheme();
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

$('subtitle').textContent = 'Regole ufficiali italiane · contro il computer';
G = load();
if (G) {
  // partita ripresa: niente distribuzione, si riparte da dov'era
  render();
  if (!G.handOver && G.turn !== HUMAN) runAI();
} else {
  G = E.newGame('1v1', { target: 2005 });
  dealing = true;
  distribuisci().then(() => { if (!G.handOver && G.turn !== HUMAN) runAI(); });
}

/* Aggancio per i test automatici (non serve al gioco). */
window.__burraco = {
  engine: E,
  stato: () => G,
  seleziona: ids => { sel = new Set(ids); msg = ''; render(); },
  disegna: () => render(),
  turnoIA: () => E.aiTurn(G, G.turn),
  sbloccaIA: () => { busy = false; },
  fineMano: () => finishHand(),
};
