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
const HUMAN = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Persistenza (best effort) ---------- */
const SAVE = 'burraco.stato.v1';
function save() {
  try { localStorage.setItem(SAVE, JSON.stringify({ g: G, sortMode })); } catch (e) { }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d && d.g && d.g.hands) { sortMode = d.sortMode || 'rank'; return d.g; }
  } catch (e) { }
  return null;
}
function loadTheme() {
  try { return localStorage.getItem('burraco.tema'); } catch (e) { return null; }
}

/* ---------- Carte ---------- */
function cardHTML(c, extra = '', i = 0) {
  if (c.r === 0) {
    return `<div class="card jolly ${extra}" style="--i:${i}" data-id="${c.id}" title="Jolly"><span class="r">✶</span><span class="s">✶</span></div>`;
  }
  const red = E.SUIT_RED[c.s] ? 'red' : '';
  return `<div class="card ${red} ${extra}" style="--i:${i}" data-id="${c.id}" title="${E.cardLabel(c)}">` +
    `<span class="r">${E.RANK_LABEL[c.r]}</span><span class="s">${E.SUIT_SYM[c.s]}</span></div>`;
}
function backHTML() { return `<div class="card back"></div>`; }
function slotHTML() { return `<div class="slot"></div>`; }

function meldHTML(m, clickable) {
  const cards = m.slots.map(s => cardHTML(s.card, s.wild ? 'wild' : '')).join('');
  const b = E.burracoType(m);
  const kind = m.type === 'seq' ? 'Scala' : 'Tris';
  const tag = b
    ? `<span class="b ${b}">Burraco ${b}</span><span>+${E.BURRACO_POINTS[b]}</span>`
    : `<span>${kind} · ${m.slots.length}</span>`;
  return `<div class="meld ${clickable ? 'target' : ''}" data-meld="${m.id}">` +
    `<div class="row">${cards}</div><div class="tag">${tag}</div></div>`;
}

function sortedHand(p) {
  const h = [...G.hands[p]];
  if (sortMode === 'suit') {
    h.sort((a, b) => {
      const sa = a.r === 0 ? 9 : E.SUITS.indexOf(a.s), sb = b.r === 0 ? 9 : E.SUITS.indexOf(b.s);
      if (sa !== sb) return sa - sb;
      return (a.r === 0 ? 99 : a.r) - (b.r === 0 ? 99 : b.r);
    });
  } else h.sort(E.sortCards);
  return h;
}

/* ---------- Render ---------- */
function teamName(t) { return t === 0 ? 'Noi' : 'Loro'; }

function seatChips(team) {
  const out = [];
  for (let p = 0; p < G.nPlayers; p++) {
    if (G.teamOf[p] !== team) continue;
    const turn = G.turn === p && !G.handOver;
    const n = G.hands[p].length;
    out.push(`<span class="chip ${turn ? 'turn' : ''}">${G.names[p]} · ${n} ${n === 1 ? 'carta' : 'carte'}${turn ? ' · gioca' : ''}</span>`);
  }
  if (G.teams[team].pozzetto) out.push(`<span class="chip on">pozzetto preso</span>`);
  if (E.hasBurraco(G, team)) out.push(`<span class="chip on">burraco</span>`);
  return out.join(' ');
}

function render() {
  const myTurn = !busy && !G.handOver && G.turn === HUMAN;
  const canAttack = myTurn && G.phase === 'meld' && sel.size > 0;

  /* — avversari — */
  const oppMelds = G.teams[1].melds.length
    ? G.teams[1].melds.map(m => meldHTML(m, false)).join('')
    : `<p class="empty-note">Nessun gioco calato.</p>`;
  const oppBacks = [];
  for (let p = 0; p < G.nPlayers; p++) if (G.teamOf[p] === 1) oppBacks.push(backHTML());

  /* — centro — */
  const canDraw = myTurn && G.phase === 'draw';
  const top = G.discard[0];
  const step = G.handOver ? 'Mano conclusa'
    : G.turn !== HUMAN ? 'Attende la mossa degli altri'
      : G.phase === 'draw' ? 'Devi pescare' : 'Cala, attacca, poi scarta';
  const cond = [
    { ok: G.teams[0].pozzetto, txt: 'pozzetto preso' },
    { ok: E.hasBurraco(G, 0), txt: 'almeno un burraco' },
    { ok: false, txt: 'mano vuota, ultima carta scartata' },
  ];
  const center = `
    <div class="state">
      <div class="now">${G.handOver ? 'Mano finita' : G.turn === HUMAN ? 'Tocca a te' : 'Turno di ' + G.names[G.turn]}</div>
      <div class="step">${step}</div>
      <ul>${cond.map(c => `<li class="${c.ok ? 'done' : ''}"><i>${c.ok ? '✓' : '·'}</i>${c.txt}</li>`).join('')}</ul>
      <div class="step" style="font-size:11px">Vi serve tutto questo per chiudere.</div>
    </div>
    <div class="pile ${canDraw && G.stock.length ? 'click' : ''} ${G.stock.length ? '' : 'dim'}" data-act="stock">
      <div class="pilewrap">${G.stock.length ? backHTML() : slotHTML()}<span class="count">${G.stock.length}</span></div>
      <div class="cap">Tallone</div>
    </div>
    <div class="pile ${canDraw && G.discard.length ? 'click' : ''} ${G.discard.length ? '' : 'dim'}" data-act="pile">
      <div class="pilewrap">${top ? cardHTML(top) : slotHTML()}<span class="count">${G.discard.length}</span></div>
      <div class="cap">Monte scarti</div>
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

  /* — nostri giochi — */
  const myMelds = G.teams[0].melds.length
    ? G.teams[0].melds.map(m => meldHTML(m, canAttack)).join('')
    : `<p class="empty-note">Nessun gioco calato. Seleziona almeno 3 carte e premi Cala.</p>`;

  /* — mano — */
  const hand = sortedHand(HUMAN).map((c, i) =>
    cardHTML(c, sel.has(c.id) ? 'sel' : '', i)).join('');

  /* — azioni — */
  const canMeld = myTurn && G.phase === 'meld' && sel.size >= 3;
  const canDiscard = myTurn && G.phase === 'meld' && sel.size === 1;
  let hint = msg;
  if (!hint) {
    if (G.handOver) hint = 'Mano conclusa.';
    else if (busy || G.turn !== HUMAN) hint = `Gioca ${G.names[G.turn]}…`;
    else if (G.phase === 'draw') hint = 'Pesca dal tallone oppure prendi tutto il monte degli scarti.';
    else if (canAttack) hint = 'Premi Cala per un gioco nuovo, oppure tocca un vostro gioco per attaccarci le carte.';
    else hint = 'Seleziona le carte da calare, oppure una sola carta e premi Scarta.';
  }

  $('board').innerHTML = `
    <section class="zone">
      <div class="seat-label">Avversari <b>${teamName(1)}</b> ${seatChips(1)}</div>
      <div class="melds">${oppMelds}</div>
    </section>
    <section class="zone"><div class="center">${center}</div></section>
    <section class="zone">
      <div class="seat-label">I vostri giochi ${G.mode === '2v2' ? `<b>Tu &amp; Nord</b>` : ''} ${seatChips(0)}</div>
      <div class="melds" id="my-melds">${myMelds}</div>
    </section>
    <section class="zone">
      <div class="seat-label">La tua mano <b>${G.hands[HUMAN].length} carte</b>
        ${sel.size ? `<span class="chip on">${sel.size} selezionate</span>` : ''}</div>
      <div class="hand ${dealing ? 'deal' : ''}" id="hand">${hand}</div>
      <div class="actions">
        <button class="btn primary" data-a="meld" ${canMeld ? '' : 'disabled'}>Cala</button>
        <button class="btn" data-a="discard" ${canDiscard ? '' : 'disabled'}>Scarta</button>
        <button class="btn ghost" data-a="sort">Ordina: ${sortMode === 'rank' ? 'valore' : 'seme'}</button>
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
function bindOnce() {
  $('board').addEventListener('click', ev => {
    const card = ev.target.closest('#hand .card');
    if (card) {
      const id = +card.dataset.id;
      if (sel.has(id)) sel.delete(id); else sel.add(id);
      msg = ''; render();
      return;
    }
    const pile = ev.target.closest('.pile[data-act]');
    if (pile) { doDraw(pile.dataset.act); return; }
    const meld = ev.target.closest('#my-melds .meld.target');
    if (meld) { doAttack(+meld.dataset.meld); return; }
    const btn = ev.target.closest('button[data-a]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.a === 'meld') doMeld();
    else if (btn.dataset.a === 'discard') doDiscard();
    else { sortMode = sortMode === 'rank' ? 'suit' : 'rank'; save(); render(); }
  });
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

function doMeld() {
  const r = E.meldNew(G, HUMAN, [...sel]);
  if (!after(r)) return;
  if (G.handOver) { render(); finishHand(); return; }
  render();
}

function doAttack(meldId) {
  const r = E.addToMeld(G, HUMAN, meldId, [...sel]);
  if (!after(r)) return;
  if (G.handOver) { render(); finishHand(); return; }
  render();
}

async function doDiscard() {
  const id = [...sel][0];
  const r = E.discard(G, HUMAN, id);
  if (!after(r)) return;
  render();
  if (G.handOver) { finishHand(); return; }
  await runAI();
}

async function runAI() {
  busy = true;
  while (!G.handOver && G.turn !== HUMAN) {
    render();
    await sleep(520);
    E.aiTurn(G, G.turn);
    render();
    await sleep(180);
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
      E.nextHand(G); sel.clear(); say(''); dealing = true; lastLogLen = -1; save(); render();
      setTimeout(() => { dealing = false; }, 900);
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
    sel.clear(); say(''); dealing = true; lastLogLen = -1; save(); render();
    setTimeout(() => { dealing = false; }, 900);
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

G = load();
if (!G) { G = E.newGame('1v1', { target: 2005 }); dealing = true; setTimeout(() => { dealing = false; }, 900); }
$('subtitle').textContent = 'Regole ufficiali italiane · contro il computer';
render();
if (!G.handOver && G.turn !== HUMAN) runAI();

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
