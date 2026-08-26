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

/* Disposizione dei semi come sulle carte vere: tre colonne
   (sinistra, centro, destra) e sette righe, dalla 0 in alto alla 6 in
   basso. I semi della metà bassa sono capovolti, come stampati davvero. */
const COL = { l: 38, c: 50, r: 62 };
const SEMI = {
  2: [['c', 0], ['c', 6]],
  3: [['c', 0], ['c', 3], ['c', 6]],
  4: [['l', 0], ['r', 0], ['l', 6], ['r', 6]],
  5: [['l', 0], ['r', 0], ['c', 3], ['l', 6], ['r', 6]],
  6: [['l', 0], ['r', 0], ['l', 3], ['r', 3], ['l', 6], ['r', 6]],
  7: [['l', 0], ['r', 0], ['c', 1.5], ['l', 3], ['r', 3], ['l', 6], ['r', 6]],
  8: [['l', 0], ['r', 0], ['c', 1.5], ['l', 3], ['r', 3], ['c', 4.5], ['l', 6], ['r', 6]],
  9: [['l', 0], ['r', 0], ['l', 2], ['r', 2], ['c', 3], ['l', 4], ['r', 4], ['l', 6], ['r', 6]],
  10: [['l', 0], ['r', 0], ['c', 1], ['l', 2], ['r', 2], ['l', 4], ['r', 4], ['c', 5], ['l', 6], ['r', 6]],
};
function semiHTML(r, S) {
  const posti = SEMI[r];
  if (!posti) return '';
  const pips = posti.map(([col, riga]) => {
    const y = 16 + riga * (68 / 6);
    const giu = riga > 3 ? ' scale(-1)' : '';
    return `<i style="left:${COL[col]}%; top:${y.toFixed(2)}%; transform:translate(-50%,-50%)${giu}">${S}</i>`;
  }).join('');
  return `<span class="semi">${pips}</span>`;
}

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
  // il segno grande serve quando la carta è piccola (giochi calati);
  // la disposizione a semi compare solo dove c'è spazio per leggerla
  const semi = semiHTML(c.r, S);
  const centro = figura
    ? `<span class="mid"><span class="figura">${R}</span></span>`
    : `<span class="mid"><span class="pip ${c.r === 14 ? 'asso' : ''}">${S}</span>${semi}</span>`;
  const idx = `<b>${R}</b><i>${S}</i>`;
  return `<div class="card ${red} ${stretta} ${semi ? 'apip' : ''} ${extra}" style="--i:${i}" data-id="${c.id}" title="${E.cardLabel(c)}">
    <span class="idx">${idx}</span>${centro}<span class="idx giu">${idx}</span>
  </div>`;
}
function backHTML() { return `<div class="card back"></div>`; }
function slotHTML() { return `<div class="slot"></div>`; }

/** Le scale si posano in verticale, i tris in orizzontale, come sul tavolo vero. */
function meldHTML(m, clickable) {
  const n = m.slots.length;
  /* Un gioco resta sempre in una colonna sola: un burraco spezzato in due non
     si riconosce più. Quando è lungo si comprime, come quando al tavolo stringi
     le carte: si lasciano scoperte solo quelle che servono davvero a leggerlo —
     la prima, l'ultima, e la matta con la carta che le sta sopra, così si vede
     dov'è. Le altre restano una striscia sottile: in una scala pulita i valori
     in mezzo si sanno già, vanno dalla prima all'ultima. */
  const scoperta = new Array(n).fill(n <= 6);
  scoperta[0] = true;
  m.slots.forEach((s, i) => {
    if (!s.wild) return;
    scoperta[i] = true;
    if (i > 0) scoperta[i - 1] = true;
  });
  const carte = m.slots.map((s, i) => cardHTML(
    s.card,
    (s.wild ? 'wild ' : '') + (i > 0 && !scoperta[i - 1] ? 'stretta' : '')
  ));
  const cards = `<div class="col">${carte.join('')}</div>`;
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

/* ---------- Il volo delle carte ─────────────────────────────
   Ogni mossa si vede: la carta parte da dove sta e arriva dove va.
   I rettangoli si misurano PRIMA di toccare lo stato, così la partenza
   è la posizione vera; poi si ridisegna, a volo finito.            */

const senzaMoto = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rett = el => (el ? el.getBoundingClientRect() : null);

const elMazzo = () => document.querySelector('.pile[data-act="stock"] .pilewrap');
const elScarti = () => document.querySelector('.pile.scartiera .pilewrap');
const elGiochiDi = team => document.querySelector(team === HUMAN
  ? '#my-melds' : '.zone.giochi:not(.mia) .melds');
const elPosto = p => document.querySelector(`.seat[data-p="${p}"] .fan`);

/** Il punto della mano dove una carta nuova si va a posare. */
function postoInMano() {
  const h = $('hand');
  if (!h) return null;
  const r = h.getBoundingClientRect();
  const c = h.querySelector('.card');
  const w = c ? c.getBoundingClientRect().width : 60;
  return { left: r.left + r.width / 2 - w / 2, top: r.top, width: w, height: w * 1.42 };
}

/** Il centro di una zona, con la misura di una carta di quella zona. */
function postoIn(el, largh) {
  const r = rett(el);
  if (!r) return null;
  const c = el.querySelector('.card');
  const w = largh || (c ? c.getBoundingClientRect().width : 40);
  return { left: r.left + r.width / 2 - w / 2, top: r.top + 8, width: w, height: w * 1.42 };
}

/**
 * Manda in volo dei cloni di carta da un rettangolo all'altro.
 * `pezzi` è un elenco di { html, da, a }: partono a scaletta, non tutti
 * insieme, così si contano anche quando sono parecchie.
 */
function vola(pezzi, ms = 280) {
  pezzi = pezzi.filter(x => x && x.da && x.a);
  if (senzaMoto() || !pezzi.length) return Promise.resolve();
  const passo = 45;
  const cloni = pezzi.map(({ html, da, a }, i) => {
    const box = document.createElement('div');
    box.innerHTML = html;
    const el = box.firstElementChild;
    el.className = el.className.replace(/\bsel\b/g, '') + ' in-volo';
    el.style.cssText += `;left:${da.left}px; top:${da.top}px;` +
      `width:${da.width}px; height:${da.height}px;` +
      `--dx:${a.left - da.left}px; --dy:${a.top - da.top}px;` +
      `--sc:${(a.width / da.width).toFixed(3)};` +
      `animation-duration:${ms}ms; animation-delay:${i * passo}ms`;
    document.body.appendChild(el);
    return el;
  });
  return sleep(ms + (pezzi.length - 1) * passo + 30)
    .then(() => cloni.forEach(e => e.remove()));
}

/** Le carte scelte che stanno per lasciare la mano: da dove partono. */
function partenzeDallaMano(ids) {
  return ids.map(id => {
    const el = document.querySelector(`#hand .card[data-id="${id}"]`);
    if (!el) return null;
    el.style.visibility = 'hidden';      // non si vede due volte la stessa carta
    return { el, da: rett(el) };
  }).filter(Boolean);
}

/* ---------- Render ---------- */

/** La mano coperta di un altro giocatore, a ventaglio. */
function seatHTML(p) {
  let n = G.hands[p].length;
  if (dealCount !== null) n = Math.min(n, dealCount);
  if (pozzettoAnim && pozzettoAnim.p === p) n = pozzettoAnim.n;
  const gioca = G.turn === p && !G.handOver && dealCount === null;
  // su schermo stretto bastano pochi dorsi: il numero è scritto di fianco
  const mostrate = Math.min(n, window.innerWidth < 480 ? 6 : 13);
  let fan = '';
  for (let i = 0; i < mostrate; i++) {
    const rot = (i - (mostrate - 1) / 2) * 3.4;
    fan += `<div class="card back" style="transform:rotate(${rot.toFixed(1)}deg)"></div>`;
  }
  return `<div class="seat ${gioca ? 'now' : ''}" data-p="${p}">
    <div class="fan ${n ? '' : 'empty'}">${fan}</div>
    <div class="who"><b>${G.names[p]}</b><span class="sep"> · </span>${n}<span class="unita"> ${n === 1 ? 'carta' : 'carte'}</span>${gioca ? '<span class="gioca"> · gioca</span>' : ''}</div>
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
  // Misura di partenza generosa: tanto è adattaGiochi() a cercare, misurando,
  // la più grande che ci sta davvero nella fascia. Qui si dice solo "non oltre".
  const cw = 56;
  return {
    cw,
    html: melds.map(m => meldHTML(m, clickable(m))).join(''),
  };
}

/**
 * Mano a ventaglio: se le carte non stanno tutte in una riga si sovrappongono
 * quel tanto che basta, come quando le tieni davvero in mano. Vale a ogni
 * misura di schermo: la mano non va mai a capo e non fa scorrere la pagina.
 * Si misura dopo aver disegnato, perché solo il browser sa quanto spazio c'è.
 */
function adattaMano() {
  const el = $('hand');
  if (!el) return;
  el.classList.remove('ventaglio');
  el.style.removeProperty('--passo');
  const n = el.children.length;
  if (n < 2) return;
  // si guarda il risultato vero: se le carte sono finite su più di una riga,
  // allora vanno sovrapposte, qualunque conto si potesse fare prima
  // offsetTop e non getBoundingClientRect: durante l'animazione di distribuzione
  // le carte sono spostate da una trasformazione, ma la riga vera è una sola
  const righe = new Set([...el.children].map(c => c.offsetTop));
  if (righe.size <= 1) return;
  const cw = el.firstElementChild.getBoundingClientRect().width;
  const spazio = el.clientWidth;
  const passo = Math.max(cw * 0.30, (spazio - cw) / (n - 1));
  el.classList.add('ventaglio');
  el.style.setProperty('--passo', passo.toFixed(1) + 'px');
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

  /* Il suggerimento sta sotto "Tocca a te", nella banda centrale: è lì che
     si guarda per capire di chi è il turno, e sotto la mano si guadagna una riga. */
  const quantiAccettano = G.teams[0].melds.filter(accetta).length;
  let hint = msg;
  if (!hint) {
    if (dealCount !== null) hint = 'Distribuzione in corso…';
    else if (G.handOver) hint = 'Mano conclusa.';
    else if (busy || G.turn !== HUMAN) hint = '';
    else if (G.phase === 'draw') hint = 'Pesca dal tallone o prendi il monte.';
    else if (calataValida) hint = 'Tocca la tua zona per calare.';
    else if (scelte.length >= 3) hint = 'Non fanno né scala né tris.';
    else if (scelte.length === 1) hint = quantiAccettano
      ? 'Scarta sul monte, o attacca al gioco acceso.'
      : 'Tocca il monte per scartarla.';
    else if (scelte.length === 2) hint = 'Servono almeno 3 carte.';
    else hint = 'Scegli le carte. Trascina per riordinare.';
  }

  // il monte scarti si vede tutto: le ultime carte a ventaglio, la più recente in cima
  const visibili = G.discard.slice(0, 3).reverse();
  const nascoste = G.discard.length - visibili.length;
  const montaggio = visibili.length
    ? `<div class="scarti">${nascoste ? `<span class="altre">+${nascoste}</span>` : ''}${visibili.map(c => cardHTML(c)).join('')}</div>`
    : slotHTML();

  /* I mazzi stanno in una colonna di fianco al tavolo, non più in una fascia
     in mezzo: la fascia mangiava altezza a tutti e due i giochi calati. */
  /* Ordine dall'alto: il pozzetto loro sta dalla loro parte, il vostro dalla
     vostra, e in mezzo tallone e scarti — ben staccati, perché è lì che si tocca
     a ogni turno e sbagliare mazzo costa il turno. */
  const mazzi = `
    <div class="pile pozzetto ${G.teams[1].pozzetto ? 'dim' : ''}">
      <div class="pilewrap">${G.pozzetti[1].length ? backHTML() : slotHTML()}</div>
      <div class="cap">Loro<b>${G.teams[1].pozzetto ? 'preso' : G.pozzetti[1].length}</b></div>
    </div>
    <div class="pile ${canDraw && G.stock.length ? 'click' : ''} ${G.stock.length ? '' : 'dim'}" data-act="stock">
      <div class="pilewrap">${G.stock.length ? backHTML() : slotHTML()}<span class="count">${G.stock.length}</span></div>
      <div class="cap">Tallone</div>
    </div>
    <div class="pile scartiera ${canDraw && G.discard.length ? 'click' : ''} ${scartaQui ? 'click bersaglio' : ''} ${G.discard.length ? '' : 'dim'}" data-act="pile">
      <div class="pilewrap">${montaggio}<span class="count">${G.discard.length}</span></div>
      <div class="cap">${scartaQui ? 'Scarta qui' : 'Scarti'}</div>
    </div>
    <div class="pile pozzetto ${G.teams[0].pozzetto ? 'dim' : ''}">
      <div class="pilewrap">${G.pozzetti[0].length ? backHTML() : slotHTML()}</div>
      <div class="cap">Vostro<b>${G.teams[0].pozzetto ? 'preso' : G.pozzetti[0].length}</b></div>
    </div>`;

  const stato = `
    <div class="state">
      <div class="now">${G.handOver ? 'Mano finita' : G.turn === HUMAN ? 'Tocca a te' : 'Turno di ' + G.names[G.turn]}</div>
      ${hint ? `<div class="hint ${msgErr ? 'err' : ''}">${hint}</div>` : ''}
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

  const nMano = G.hands[HUMAN].length;
  // a coppie i quattro posti stanno a croce: Nord è il compagno, Est e Ovest
  // gli avversari ai lati del tavolo, tu a Sud con la mano in basso
  const croce = G.mode === '2v2';
  $('board').className = 'panel board' + (croce ? ' croce4' : '') + (myTurn && dealCount === null ? ' turno' : '');
  $('board').innerHTML = `
    <div class="tavolo">
      ${croce ? `<div class="posto-lato">${seatHTML(3)}</div>` : ''}
      <div class="campo">
        <section class="zone posti">
          <div class="seats">${croce ? seatHTML(2) : seatsOf(1)}</div>
          ${stato}
        </section>
        <section class="zone giochi">
          <div class="melds" style="--cw:${oppM.cw}px">${oppMelds}</div>
        </section>
        <section class="zone giochi mia">
          <div class="melds zona ${calataValida ? 'armata' : ''}" id="my-melds" style="--cw:${myM.cw}px">${myMelds}</div>
        </section>
      </div>
      ${croce ? `<div class="posto-lato">${seatHTML(1)}</div>` : ''}
      <div class="mazzi">${mazzi}</div>
    </div>
    <section class="zone mano">
      <div class="seat-label mano-h"><b>${nMano} ${nMano === 1 ? 'carta' : 'carte'}</b>
        ${sel.size ? `<span class="chip on">${sel.size} scelte</span>` : ''}
        <button class="btn ghost mini" data-a="sort" title="Cambia l'ordine della mano">Per ${sortMode === 'rank' ? 'seme' : 'valore'}</button>
        <button class="btn ghost mini" data-a="punti" title="Punteggio e cronaca">Punti</button>
        <button class="btn ghost mini" data-a="menu" title="Menu" aria-label="Menu">☰</button></div>
      <div class="hand ${dealing ? 'deal' : ''}" id="hand">${hand}</div>
    </section>`;

  adattaMano();
  adattaGiochi();
}

/**
 * Nessun gioco tagliato a metà: se la scala più lunga non ci sta nella sua
 * fascia, le carte di quella fascia rimpiccioliscono quel tanto che basta.
 * Si misura dopo aver disegnato, perché solo il browser sa quanto spazio c'è.
 */
function adattaGiochi() {
  for (const el of document.querySelectorAll('.zone.giochi .melds')) {
    if (!el.clientHeight || !el.children.length) continue;
    const tetto = parseFloat(el.style.getPropertyValue('--cw')) || 44;
    // vero quando tutti i giochi, comprese le righe che vanno a capo, stanno
    // dentro la fascia: nessuno viene tagliato dal bordo
    const ciSta = c => {
      el.style.setProperty('--cw', c + 'px');
      return el.scrollHeight <= el.clientHeight;
    };
    // ricerca per dimezzamenti: pochi passaggi per trovare la misura più
    // grande che ci sta ancora tutta
    const cerca = () => {
      if (ciSta(tetto)) return true;
      let basso = 15, alto = tetto;
      while (alto - basso > 1) {
        const mezzo = Math.floor((alto + basso) / 2);
        if (ciSta(mezzo)) basso = mezzo; else alto = mezzo;
      }
      return ciSta(basso);
    };
    el.classList.remove('infila');
    if (cerca()) continue;
    // se nemmeno alla misura minima ci stanno tutti in colonne che vanno a capo,
    // si mettono in fila unica e la fascia scorre di lato: meglio scorrere che
    // vedere un gioco tagliato a metà dal bordo
    el.classList.add('infila');
    cerca();
  }
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
/* ---------- Interazioni (un solo ascoltatore, delegato) ---------- */
function scegli(id) {
  if (sel.has(id)) sel.delete(id); else sel.add(id);
  msg = ''; render();
}

function bindOnce() {
  const board = $('board');
  let attesa = null, ispezionato = false;

  board.addEventListener('click', ev => {
    if (ispezionato) { ispezionato = false; return; }
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
    const a = btn.dataset.a;
    if (a === 'meld') doMeld();
    else if (a === 'discard') doDiscard();
    else if (a === 'punti') punteggioDialog();
    else if (a === 'menu') menuDialog();
    else if (a === 'sort') {
      sortMode = sortMode === 'rank' ? 'suit' : 'rank';
      handOrder = [];               // l'ordinamento automatico ha la precedenza
      save(); render();
    }
  });

  /* Pressione lunga sul monte scarti: si apre l'elenco di tutte le carte,
     dalla più recente in fondo. Serve quando il monte cresce e sotto non si
     vede più niente. */
  const annullaAttesa = () => { clearTimeout(attesa); attesa = null; };
  board.addEventListener('pointerdown', ev => {
    if (ev.button > 0) return;
    if (!ev.target.closest('.pile.scartiera')) return;
    annullaAttesa();
    attesa = setTimeout(() => { attesa = null; ispezionato = true; scartiDialog(); }, 450);
  });
  board.addEventListener('pointermove', ev => {
    if (attesa && ev.movementX * ev.movementX + ev.movementY * ev.movementY > 25) annullaAttesa();
  });
  board.addEventListener('pointerup', annullaAttesa);
  board.addEventListener('pointercancel', annullaAttesa);
  board.addEventListener('contextmenu', ev => {
    if (ev.target.closest('.pile.scartiera')) { ev.preventDefault(); scartiDialog(); }
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

async function doDraw(src) {
  if (busy || G.turn !== HUMAN || G.phase !== 'draw') return;
  const da = rett(src === 'stock' ? elMazzo() : elScarti());
  const a = postoInMano();
  const quante = src === 'stock' ? 1 : Math.min(G.discard.length, 5);
  busy = true;
  await vola(Array.from({ length: quante }, () => ({ html: backHTML(), da, a })), 250);
  busy = false;
  const r = E.draw(G, HUMAN, src);
  if (!after(r)) return;
  dealing = false; render();
}

async function doMeld() {
  const scelte = [...sel];
  const prova = E.solveMeld(G.hands[HUMAN].filter(c => sel.has(c.id)));
  if (prova) await volaVerso(scelte, elGiochiDi(HUMAN));
  const r = E.meldNew(G, HUMAN, scelte);
  if (!after(r)) { render(); return; }
  render();
  if (r.pozzetto) await animaPozzetto(HUMAN);
  if (G.handOver) { finishHand(); return; }
  render();
}

async function doAttack(meldId) {
  const scelte = [...sel];
  await volaVerso(scelte, document.querySelector(`#my-melds .meld[data-meld="${meldId}"]`));
  const r = E.addToMeld(G, HUMAN, meldId, scelte);
  if (!after(r)) { render(); return; }
  render();
  if (r.pozzetto) await animaPozzetto(HUMAN);
  if (G.handOver) { finishHand(); return; }
  render();
}

async function doDiscard() {
  const id = [...sel][0];
  await volaVerso([id], elScarti());
  const r = E.discard(G, HUMAN, id);
  if (!after(r)) { render(); return; }
  render();
  if (r.pozzetto) await animaPozzetto(HUMAN);
  if (G.handOver) { finishHand(); return; }
  await runAI();
}

/** Manda in volo le carte scelte dalla mano fino a una zona del tavolo. */
async function volaVerso(ids, destEl) {
  const a = postoIn(destEl);
  if (!a) return;
  const partenze = partenzeDallaMano(ids);
  const mano = G.hands[HUMAN];
  const pezzi = partenze.map(({ da }, i) => {
    const c = mano.find(x => x.id === ids[i]);
    return { html: c ? cardHTML(c) : backHTML(), da, a };
  });
  const eraOccupato = busy;
  busy = true;
  await vola(pezzi, 260);
  busy = eraOccupato;
  partenze.forEach(({ el }) => { el.style.visibility = ''; });
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
  await sleep(320);
  const daMazzo = rett(elMazzo()), daScarti = rett(elScarti()), alPosto = rett(elPosto(p));
  const primaScarti = G.discard.length;
  E.aiDraw(G, p);
  const dalMonte = G.discard.length < primaScarti;
  const quante = dalMonte ? Math.min(primaScarti, 5) : 1;
  await vola(Array.from({ length: quante }, () => ({
    html: backHTML(), da: dalMonte ? daScarti : daMazzo, a: alPosto,
  })), 280);
  render();
  await sleep(240);

  let guard = 0;
  while (guard++ < 45) {
    const prima = G.teams[squadra].pozzetto;
    const dalPosto = rett(elPosto(p));
    const aiGiochi = postoIn(elGiochiDi(1 - HUMAN === G.teamOf[p] ? 1 : G.teamOf[p]));
    const mossa = E.aiOneMeld(G, p);
    if (!mossa) break;
    say(mossa.t === 'add' ? `${G.names[p]} attacca una carta` : `${G.names[p]} cala ${mossa.n} carte`);
    await vola(Array.from({ length: Math.min(mossa.n, 5) }, () => ({
      html: backHTML(), da: dalPosto, a: aiGiochi,
    })), 260);
    render();
    await sleep(240);
    await controllaPozzetto(prima);
    if (G.handOver) return;
  }
  if (G.handOver || G.hands[p].length === 0) return;

  say(`${G.names[p]} scarta…`);
  render();
  await sleep(260);
  const prima = G.teams[squadra].pozzetto;
  const daMano = rett(elPosto(p)), alMonte = rett(elScarti());
  E.aiDiscard(G, p);
  // la carta scartata è quella in cima al monte: ora si può mostrare scoperta
  await vola([{ html: cardHTML(G.discard[0]), da: daMano, a: alMonte }], 280);
  render();
  await sleep(200);
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
      E.nextHand(G); sel.clear(); say(''); dealing = true; handOrder = [];
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
    sel.clear(); say(''); dealing = true; handOrder = [];
    save();
    await distribuisci();
    if (G.turn !== HUMAN) await runAI();
  };
}

const RULES_HTML = `
<p class="fonte">Sintesi del <b>codice di gara</b>, articolo per articolo, con le citazioni
essenziali. Il testo integrale è dei rispettivi enti: qui trovi il riassunto e i collegamenti
per leggerlo per intero.</p>

<h3>Art. 3 — Il mazzo</h3>
<ul>
  <li>Due mazzi francesi più quattro jolly: <b>108 carte</b>.</li>
  <li>I <b>2</b> si chiamano <b>pinelle</b>. Pinelle e jolly sono le <b>matte</b>.</li>
</ul>

<h3>Art. 4 — Distribuzione</h3>
<ul>
  <li><b>11 carte</b> a testa, una alla volta, in senso orario.</li>
  <li>Due <b>pozzetti</b> da 11 carte, uno per linea, presi da sotto il mazzo.</li>
  <li>«Al via dell'arbitro, il mazziere <b>scoprirà la prima carta dal tallone</b>»: il monte
      scarti non parte mai vuoto, e chi apre può già prenderlo.</li>
</ul>

<h3>Art. 5 e 6 — Il turno</h3>
<ul>
  <li>Si pesca <b>una carta dal tallone</b> oppure si prende <b>tutto il monte scarti</b>.</li>
  <li>Si aprono giochi nuovi e si attaccano carte ai giochi già aperti della propria linea.</li>
  <li>«La prima carta che formerà il monte degli scarti sarà posta tra il tallone e il giocatore
      che scarta».</li>
</ul>

<h3>Art. 7 — Lo scarto</h3>
<ul>
  <li>Il turno si chiude <b>scartando una carta</b>. «Dopo lo scarto nessuna altra azione è
      consentita».</li>
</ul>

<h3>Art. 8 e 9 — Scale e tris</h3>
<ul>
  <li><b>Scala</b>: «tre o più carte ordinate obbligatoriamente dello stesso seme», da 3 a 13.
      L'asso sta sopra il re oppure sotto il due.</li>
  <li><b>Tris</b>: «tre o più carte uguali, anche dello stesso seme», da 3 a 8.</li>
  <li>«Ogni gioco aperto può contenere <b>una sola matta</b>».</li>
  <li>Il 2 del seme della scala, al suo posto naturale, <b>non</b> conta come matta: in quel caso
      nel gioco ci può stare anche un'altra matta.</li>
</ul>

<h3>Art. 10 — Spostamento della matta</h3>
<ul>
  <li>«Nelle sequenze i jolly o le pinelle possono essere <b>sostituiti solo dalla carta che
      rappresentano</b>. Devono obbligatoriamente restare nei giochi già aperti».</li>
  <li>Matta <b>a un'estremità</b>: è libera, può scivolare per far posto a una carta più alta o
      più bassa.</li>
  <li>Matta <b>chiusa fra due carte</b>: si sposta soltanto se cali proprio la carta che
      rappresenta. Non la si scaccia con un'altra matta.</li>
</ul>

<h3>Art. 12 — Il pozzetto</h3>
<ul>
  <li>Chi esaurisce le carte prende gli <b>11 del pozzetto</b> della propria linea e prosegue.</li>
  <li>Finirle <b>senza scartare</b> è andare a pozzetto <b>al volo</b>: il turno continua.</li>
</ul>

<h3>Art. 17 — Chiusura e fine della mano</h3>
<ul>
  <li>Per chiudere servono tre cose insieme: <b>pozzetto preso</b>, <b>almeno un burraco</b>, e
      «uno dei due componenti della linea ha ultimato tutte le carte <b>scartandone una</b>».</li>
  <li>Non si chiude scartando un jolly o una pinella.</li>
  <li>Tallone esaurito: «le ultime due carte del tallone <b>non sono giocabili</b>, quindi il gioco
      si chiude con lo scarto del giocatore che ha pescato la terzultima carta; non è possibile
      proseguire utilizzando le carte del monte degli scarti».</li>
</ul>

<h3>Art. 18 — Punteggi</h3>
<ul>
  <li>Jolly 30 · pinella 20 · asso 15 · dall'8 al re 10 · dal 3 al 7 cinque.</li>
  <li><b>Burraco</b>: gioco di almeno 7 carte. <b>Pulito</b> 200 · <b>semipulito</b> 150 ·
      <b>sporco</b> 100.</li>
  <li>Bonus di <b>chiusura</b> 100. <b>Pozzetto non preso</b> −100.</li>
  <li>Le carte calate si sommano, quelle rimaste in mano si sottraggono.</li>
</ul>

<h3>Scelte di questa app</h3>
<ul>
  <li><b>Semipulito</b>: gioco di 8 o più carte con la matta a un'estremità, cioè con almeno 7
      carte naturali di fila.</li>
  <li><b>Super burraco</b> (250) e <b>burraco reale</b> (300) del codice FGB: non conteggiati.</li>
  <li>Oltre i 400 turni una mano si chiude come per tallone esaurito. Non è una regola: è una rete
      di sicurezza perché il gioco non si impianti. In 300 partite simulate non è mai scattata.</li>
</ul>

<h3>Fonti</h3>
<ul class="fonti">
  <li><a href="https://www.federazionegiocoburraco.it/Files/Documenti/c-CodiceDiGara-FGB.pdf"
      target="_blank" rel="noopener">Codice di gara — Federazione Gioco Burraco</a></li>
  <li><a href="https://www.aics.it/wp-content/uploads/2024/03/REGOLAMENTO-BURRACO-2024.pdf"
      target="_blank" rel="noopener">Regolamento Burraco 2024 — AICS / FITAB</a></li>
  <li><a href="https://www.eburraco.com/le-matte-e-lo-scarto-nel-gioco-del-burraco/"
      target="_blank" rel="noopener">Le matte e lo scarto — approfondimento sullo spostamento</a></li>
</ul>`;

/** Menu del telefono: le azioni che sul PC stanno nella testata. */
function menuDialog() {
  modal('Menu', 'Tavolo da Burraco',
    `<div class="opts">
       <button class="btn" id="m-tema" style="text-align:left">Cambia tema chiaro / scuro</button>
       <button class="btn" id="m-reg" style="text-align:left">Regolamento ufficiale</button>
       <button class="btn primary" id="m-nuova" style="text-align:left">Nuova partita</button>
     </div>`,
    `<button class="btn ghost" id="m-ok">Chiudi</button>`);
  $('m-ok').onclick = closeModal;
  $('m-tema').onclick = () => { cambiaTema(); closeModal(); };
  $('m-reg').onclick = () => { closeModal(); rulesDialog(); };
  $('m-nuova').onclick = () => { closeModal(); newGameDialog(); };
}

function punteggioDialog() {
  const t = G.target;
  const nomi = G.mode === '2v2' ? ['Noi (Tu &amp; Nord)', 'Loro (Est &amp; Ovest)'] : ['Tu', 'Computer'];
  const righe = [0, 1].map(i => {
    const pct = Math.max(0, Math.min(100, G.matchScore[i] / t * 100));
    return `<tr><td>${nomi[i]}<div class="bar"><i style="width:${pct}%"></i></div></td>
      <td class="n">${G.matchScore[i]}</td></tr>`;
  }).join('');
  const cronaca = G.log.slice(-30).reverse().map(e => {
    const l = logLine(e);
    return l.h ? `<div class="${l.c || ''}">${l.h}</div>` : '';
  }).join('');
  modal('Punteggio',
    `Partita a ${t} punti · mano n. ${G.handNo}`,
    `<div class="score">
       <table><tr><th>Squadra</th><th style="text-align:right">Punti</th></tr>${righe}</table>
     </div>
     <div class="side-h" style="padding-left:0;margin-top:14px">Cronaca <span>ultime mosse</span></div>
     <div class="log" style="max-height:240px;padding:8px 0 0">${cronaca}</div>`,
    `<button class="btn primary" id="m-ok">Chiudi</button>`);
  $('m-ok').onclick = closeModal;
}

function scartiDialog() {
  if (!G.discard.length) return;
  // la più recente è in cima al monte: qui si legge dall'alto in basso
  const carte = G.discard.map((c, i) => `
    <div class="riga-scarto">
      <span class="n">${i === 0 ? 'cima' : i + 1 + '\u00ba'}</span>
      ${cardHTML(c)}
      <span class="nome">${E.cardLabel(c)}</span>
    </div>`).join('');
  modal('Monte scarti', `${G.discard.length} ${G.discard.length === 1 ? 'carta' : 'carte'}, dalla più recente`,
    `<div class="elenco-scarti">${carte}</div>`,
    `<button class="btn primary" id="m-ok">Chiudi</button>`);
  $('m-ok').onclick = closeModal;
}

function rulesDialog() {
  modal('Regolamento ufficiale', 'Burraco italiano, per articoli del codice di gara.', RULES_HTML,
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
function cambiaTema() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('burraco.tema', next); } catch (e) { }
}
const savedTheme = loadTheme();
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

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
  nuovaPartita: (mode, target) => {
    G = E.newGame(mode, { target: target || 2005 });
    sel.clear(); msg = ''; dealing = false; handOrder = [];
    busy = false; dealCount = null; render();
  },
};
