/* ============================================================
   BURRACO — suoni
   Niente file da scaricare: tutto è costruito dal browser sul
   momento con l'audio di sistema. Così l'app resta leggera, funziona
   offline anche la prima volta, e non c'è niente da caricare su
   GitHub — un rumore di carte in mp3 pesa più di tutta l'app.

   Le carte: un soffio corto di rumore filtrato. È così che suona una
   carta vera, un fruscio breve e sordo, non un "click".
   La musica: quattro accordi lenti che girano, un arpeggio appena
   accennato e un tappeto sotto. Deve stare dietro al gioco, non
   davanti: se la noti troppo è sbagliata.
   ============================================================ */

const CASSETTO_SUONI = 'burraco.suoni.v1';

/* Il browser non lascia partire l'audio prima che la persona abbia
   toccato qualcosa: si costruisce tutto al primo tocco. */
let ctx = null;
let mixEffetti = null, mixMusica = null;
let rumore = null;          // rumore bianco, riusato da tutti i fruscii
let musicaAccesa = false, timerMusica = null, battuta = 0;

const stato = { effetti: true, musica: true };

function leggiScelte() {
  try {
    const d = JSON.parse(localStorage.getItem(CASSETTO_SUONI) || 'null');
    if (d) { stato.effetti = d.effetti !== false; stato.musica = d.musica !== false; }
  } catch (e) { }
  return stato;
}
function salvaScelte() {
  try { localStorage.setItem(CASSETTO_SUONI, JSON.stringify(stato)); } catch (e) { }
}

function creaRumore(c) {
  // due secondi di rumore bianco, riavvolto: basta e avanza per i fruscii
  const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function avvia() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch (e) { return null; }
  mixEffetti = ctx.createGain(); mixEffetti.gain.value = 0.9; mixEffetti.connect(ctx.destination);
  mixMusica = ctx.createGain(); mixMusica.gain.value = 0.0; mixMusica.connect(ctx.destination);
  rumore = creaRumore(ctx);
  return ctx;
}

const ora = () => ctx.currentTime;

/** Un soffio di rumore filtrato: il suono di una carta che scivola. */
function fruscio({ quando = 0, durata = 0.09, taglio = 2600, q = 0.7, volume = 0.35, giu = true }) {
  const t = ora() + quando;
  const s = ctx.createBufferSource();
  s.buffer = rumore;
  s.loop = true;
  s.playbackRate.value = 0.8 + Math.random() * 0.5;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(taglio, t);
  if (giu) f.frequency.exponentialRampToValueAtTime(Math.max(300, taglio * 0.35), t + durata);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + durata * 0.18);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
  s.connect(f); f.connect(g); g.connect(mixEffetti);
  s.start(t); s.stop(t + durata + 0.02);
}

/** Una nota morbida: serve per gli avvisi, non per la musica. */
function nota({ freq, quando = 0, durata = 0.5, volume = 0.16, forma = 'sine', dove = null }) {
  const t = ora() + quando;
  const o = ctx.createOscillator();
  o.type = forma;
  o.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
  o.connect(g); g.connect(dove || mixEffetti);
  o.start(t); o.stop(t + durata + 0.02);
}

/* ---------- La musica ----------
   Quattro accordi lenti in La minore, il giro più tranquillo che ci sia.
   Ogni battuta: una nota bassa lunga, e due o tre note dell'accordo che
   entrano appena. Niente ritmo, niente percussioni: sottofondo. */
const GIRO = [
  { basso: 110.00, note: [329.63, 392.00, 493.88] },   // La minore 7
  { basso: 130.81, note: [329.63, 392.00, 523.25] },   // Do maggiore 6
  { basso: 87.31,  note: [349.23, 440.00, 523.25] },   // Fa maggiore 7
  { basso: 98.00,  note: [392.00, 493.88, 587.33] },   // Sol
];
const BATTUTA = 4.2;   // secondi: lenta davvero

function suonaBattuta() {
  if (!ctx || !musicaAccesa) return;
  const a = GIRO[battuta % GIRO.length];
  battuta++;
  // il basso, lungo e sordo
  const t = ora();
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(a.basso, t);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + BATTUTA * 0.95);
  o.connect(f); f.connect(g); g.connect(mixMusica);
  o.start(t); o.stop(t + BATTUTA);

  // le note dell'accordo, sfalsate, appena accennate
  a.note.forEach((n, i) => {
    nota({
      freq: n, quando: 0.5 + i * 0.75 + Math.random() * 0.12,
      durata: 2.4, volume: 0.05, forma: 'sine', dove: mixMusica,
    });
  });
}

function accendiMusica() {
  if (!ctx || musicaAccesa) return;
  musicaAccesa = true;
  mixMusica.gain.cancelScheduledValues(ora());
  mixMusica.gain.setValueAtTime(mixMusica.gain.value, ora());
  mixMusica.gain.linearRampToValueAtTime(0.5, ora() + 2.5);   // entra piano
  suonaBattuta();
  timerMusica = setInterval(suonaBattuta, BATTUTA * 1000);
}
function spegniMusica() {
  musicaAccesa = false;
  if (timerMusica) { clearInterval(timerMusica); timerMusica = null; }
  if (ctx && mixMusica) {
    mixMusica.gain.cancelScheduledValues(ora());
    mixMusica.gain.setValueAtTime(mixMusica.gain.value, ora());
    mixMusica.gain.linearRampToValueAtTime(0.0001, ora() + 1.2);
  }
}

/* ---------- Quello che il gioco chiama ---------- */
const voci = {
  /** una carta che si posa */
  carta: () => fruscio({ durata: 0.085, taglio: 2400, volume: 0.32 }),

  /** una carta girata scoperta: un filo più secca */
  gira: () => { fruscio({ durata: 0.07, taglio: 3400, volume: 0.3 }); },

  /** il mazzo mischiato: tanti fruscii vicini, in due riprese */
  mischia: () => {
    for (let i = 0; i < 22; i++) {
      fruscio({ quando: i * 0.028 + (i > 11 ? 0.16 : 0), durata: 0.06, taglio: 1800 + Math.random() * 1600, volume: 0.14 });
    }
  },

  /** l'alzata: due blocchi di carte che si staccano e si riappoggiano */
  alza: () => {
    fruscio({ durata: 0.16, taglio: 1200, volume: 0.3, q: 0.5 });
    fruscio({ quando: 0.22, durata: 0.12, taglio: 900, volume: 0.28, q: 0.5 });
  },

  /** una carta data a un giocatore */
  dai: () => fruscio({ durata: 0.06, taglio: 3000, volume: 0.22 }),

  /** una calata: le carte si posano e qualcosa si è chiuso */
  cala: () => {
    fruscio({ durata: 0.1, taglio: 2200, volume: 0.3 });
    nota({ freq: 587.33, quando: 0.05, durata: 0.35, volume: 0.09 });
    nota({ freq: 880.00, quando: 0.12, durata: 0.4, volume: 0.07 });
  },

  /** tocca a te: due note gentili, che si sentono anche in tasca */
  tocca: () => {
    nota({ freq: 659.25, durata: 0.5, volume: 0.13 });
    nota({ freq: 987.77, quando: 0.16, durata: 0.6, volume: 0.1 });
  },

  /** il pozzetto che arriva in mano */
  pozzetto: () => {
    for (let i = 0; i < 5; i++) fruscio({ quando: i * 0.07, durata: 0.08, taglio: 2000, volume: 0.2 });
    nota({ freq: 523.25, quando: 0.2, durata: 0.5, volume: 0.1 });
  },

  /** fine mano */
  fineMano: () => {
    [523.25, 659.25, 783.99].forEach((f, i) =>
      nota({ freq: f, quando: i * 0.13, durata: 0.6, volume: 0.1 }));
  },

  /** partita vinta */
  vittoria: () => {
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) =>
      nota({ freq: f, quando: i * 0.12, durata: 0.9, volume: 0.12 }));
  },

  /** partita persa: le stesse note, ma che scendono */
  sconfitta: () => {
    [659.25, 587.33, 493.88, 392.00].forEach((f, i) =>
      nota({ freq: f, quando: i * 0.15, durata: 0.8, volume: 0.09 }));
  },

  /** qualcosa non si può fare */
  no: () => nota({ freq: 196, durata: 0.18, volume: 0.1, forma: 'triangle' }),

  /** una frase di chat arrivata dall'altro (Lavoro 6): due colpetti leggeri,
      non deve confondersi con "tocca a te" né distrarre dal gioco */
  chat: () => {
    nota({ freq: 740, durata: 0.09, volume: 0.08 });
    nota({ freq: 988, quando: 0.07, durata: 0.12, volume: 0.07 });
  },
};

export const Suoni = {
  get effetti() { return stato.effetti; },
  get musica() { return stato.musica; },

  /** Da chiamare al primo tocco della persona: prima il browser non lascia suonare. */
  sveglia() {
    if (!avvia()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    if (stato.musica && !musicaAccesa) accendiMusica();
  },

  suona(nome) {
    if (!stato.effetti || !voci[nome]) return;
    if (!ctx) return;                       // non ancora svegliato: pazienza
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    try { voci[nome](); } catch (e) { }
  },

  cambiaEffetti(acceso) {
    stato.effetti = acceso === undefined ? !stato.effetti : !!acceso;
    salvaScelte();
    if (stato.effetti) this.suona('carta');
    return stato.effetti;
  },

  cambiaMusica(accesa) {
    stato.musica = accesa === undefined ? !stato.musica : !!accesa;
    salvaScelte();
    if (stato.musica) { this.sveglia(); accendiMusica(); } else spegniMusica();
    return stato.musica;
  },

  /** Durante le finestre e a partita ferma la musica si abbassa da sola. */
  abbassa(giu) {
    if (!ctx || !musicaAccesa) return;
    mixMusica.gain.cancelScheduledValues(ora());
    mixMusica.gain.setValueAtTime(mixMusica.gain.value, ora());
    mixMusica.gain.linearRampToValueAtTime(giu ? 0.18 : 0.5, ora() + 0.4);
  },

  /** Serve solo ai collaudi: l'audio è davvero partito? */
  acceso() { return !!ctx && ctx.state === 'running'; },

  leggiScelte,
};

leggiScelte();
export default Suoni;
