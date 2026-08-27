/* Finto Supabase per i collaudi.
   Parla la stessa lingua delle cinque funzioni SQL vere
   (/rest/v1/rpc/<nome>) ma tiene tutto in memoria. Serve perché la
   macchina dove girano i collaudi non ha accesso a internet: così il
   giro completo — due telefoni che si passano le mosse — si prova
   comunque, e quello che resta da verificare a mano è solo il tratto
   di filo fra il telefono e Supabase.
   Uso: node tools/finto-supabase.js  (porta da PORT, default 8200) */
import http from 'node:http';
import crypto from 'node:crypto';

/* Conti finti: bastano a provare il giro (registrazione, accesso, gettone
   scaduto, statistiche che salgono). Le password qui sono tenute con un
   digest e un sale, come si deve, anche se è tutta roba che vive in memoria
   per il tempo di un collaudo. */
const conti = new Map();      // email -> {id, email, sale, digest}
const sessioni = new Map();   // gettone -> {id, scade}
const profili = new Map();    // id -> nome
const statistiche = new Map();// id -> {...}

const STAT_VUOTE = () => ({
  partite: 0, vinte: 0, partite_online: 0, vinte_online: 0, mani: 0, chiusure: 0,
  burrachi_puliti: 0, burrachi_semi: 0, burrachi_sporchi: 0, punti: 0, miglior_mano: 0,
});
const impasta = (pass, sale) => crypto.scryptSync(String(pass), sale, 32).toString('hex');

function nuovaSessione(id) {
  const gettone = crypto.randomBytes(24).toString('hex');
  sessioni.set(gettone, { id, scade: Date.now() + 3600e3 });
  return { access_token: gettone, refresh_token: 'r_' + gettone, expires_in: 3600, token_type: 'bearer',
           user: { id, email: [...conti.values()].find(c => c.id === id).email } };
}
function chiSei(intestazioni) {
  const a = intestazioni.authorization || '';
  const g = a.replace(/^Bearer /i, '');
  const s = sessioni.get(g);
  if (!s || s.scade < Date.now()) return null;
  return s.id;
}
function nomeLibero(base) {
  let n = String(base || 'Giocatore').slice(0, 14) || 'Giocatore';
  const preso = x => [...profili.values()].some(v => v.toLowerCase() === x.toLowerCase());
  let i = 0;
  while (preso(n)) { i++; n = String(base || 'Giocatore').slice(0, 10) + i; }
  return n;
}

const partite = new Map();   // codice -> {codice, modo, target, seme, nomi, ...}
const mosse = new Map();     // codice -> Map(n -> {n, posto, mossa})

const LETTERE = 'ABCDEFGHJKLMNPRSTVWXYZ';
function codiceNuovo() {
  for (let giro = 0; giro < 40; giro++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += LETTERE[Math.floor(Math.random() * LETTERE.length)];
    if (!partite.has(c)) return c;
  }
  throw new Error('non trovo un codice libero');
}

const su = s => String(s || '').trim().toUpperCase();

const funzioni = {
  apri_tavolo({ p_modo, p_target, p_nome }) {
    const p = {
      codice: codiceNuovo(),
      modo: p_modo || '1v1',
      target: p_target || 2005,
      seme: Math.floor(Math.random() * 2147483647),
      nomi: [String(p_nome || '').slice(0, 14), ''],
      creata: new Date().toISOString(),
      vista: new Date().toISOString(),
    };
    partite.set(p.codice, p);
    mosse.set(p.codice, new Map());
    return p;
  },
  siediti({ p_codice, p_nome }) {
    const p = partite.get(su(p_codice));
    if (!p) throw new Error('tavolo non trovato');
    p.nomi[1] = String(p_nome || '').slice(0, 14);
    p.vista = new Date().toISOString();
    return p;
  },
  guarda_tavolo({ p_codice }) {
    return partite.get(su(p_codice)) || null;
  },
  manda_mossa({ p_codice, p_n, p_posto, p_mossa }) {
    const c = su(p_codice);
    if (!partite.has(c)) throw new Error('tavolo non trovato');
    const m = mosse.get(c);
    if (m.has(p_n)) throw new Error('numero di mossa già preso');   // come la chiave primaria vera
    m.set(p_n, { n: p_n, posto: p_posto, mossa: p_mossa });
    partite.get(c).vista = new Date().toISOString();
    return p_n;
  },
  leggi_mosse({ p_codice, p_da }) {
    const m = mosse.get(su(p_codice));
    if (!m) return [];
    return [...m.values()].filter(x => x.n >= (p_da || 0)).sort((a, b) => a.n - b.n);
  },

  /* ---- conto e statistiche (vogliono il gettone) ---- */
  mio_conto({ p_nome }, id) {
    if (!id) throw new Error('non hai fatto l\'accesso');
    if (!profili.has(id)) {
      const c = [...conti.values()].find(x => x.id === id);
      profili.set(id, nomeLibero(p_nome || (c && c.email.split('@')[0])));
    }
    if (!statistiche.has(id)) statistiche.set(id, STAT_VUOTE());
    return { nome: profili.get(id), stat: statistiche.get(id) };
  },
  scegli_nome({ p_nome }, id) {
    if (!id) throw new Error('non hai fatto l\'accesso');
    const n = String(p_nome || '').trim().slice(0, 14);
    if (n.length < 2) throw new Error('il nome è troppo corto');
    for (const [altro, v] of profili) if (altro !== id && v.toLowerCase() === n.toLowerCase()) {
      throw new Error('questo nome è già preso');
    }
    profili.set(id, n);
    return { nome: n };
  },
  segna_mano({ p_punti, p_chiusura, p_puliti, p_semi, p_sporchi }, id) {
    if (!id) return null;
    if (!statistiche.has(id)) statistiche.set(id, STAT_VUOTE());
    const s = statistiche.get(id);
    s.mani++;
    if (p_chiusura) s.chiusure++;
    s.burrachi_puliti += p_puliti || 0;
    s.burrachi_semi += p_semi || 0;
    s.burrachi_sporchi += p_sporchi || 0;
    s.punti += p_punti || 0;
    s.miglior_mano = Math.max(s.miglior_mano, p_punti || 0);
    return null;
  },
  segna_partita({ p_vinta, p_online }, id) {
    if (!id) return null;
    if (!statistiche.has(id)) statistiche.set(id, STAT_VUOTE());
    const s = statistiche.get(id);
    s.partite++;
    if (p_vinta) s.vinte++;
    if (p_online) { s.partite_online++; if (p_vinta) s.vinte_online++; }
    return null;
  },
  porta_storico({ p_stat }, id) {
    if (!id) throw new Error('non hai fatto l\'accesso');
    if (!statistiche.has(id)) statistiche.set(id, STAT_VUOTE());
    const s = statistiche.get(id), d = p_stat || {};
    for (const k of Object.keys(STAT_VUOTE())) {
      if (k === 'miglior_mano') s[k] = Math.max(s[k], Math.max(0, d[k] || 0));
      else s[k] += Math.max(0, d[k] || 0);
    }
    return funzioni.mio_conto({}, id);
  },
};

/* Le vie dell'autenticazione, quelle vere di Supabase. */
const autenticazione = {
  '/auth/v1/signup'(corpo) {
    const email = String(corpo.email || '').trim().toLowerCase();
    const pass = String(corpo.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Unable to validate email address: invalid format');
    if (pass.length < 8) throw new Error('Password should be at least 8 characters');
    if (conti.has(email)) throw new Error('User already registered');
    const sale = crypto.randomBytes(8).toString('hex');
    const id = crypto.randomUUID();
    conti.set(email, { id, email, sale, digest: impasta(pass, sale) });
    return nuovaSessione(id);
  },
  '/auth/v1/token'(corpo, cerca) {
    if (cerca === 'grant_type=refresh_token') {
      const vecchio = String(corpo.refresh_token || '').replace(/^r_/, '');
      const s = sessioni.get(vecchio);
      if (!s) throw new Error('Invalid Refresh Token');
      sessioni.delete(vecchio);
      return nuovaSessione(s.id);
    }
    const email = String(corpo.email || '').trim().toLowerCase();
    const c = conti.get(email);
    if (!c || c.digest !== impasta(String(corpo.password || ''), c.sale)) {
      throw new Error('Invalid login credentials');
    }
    return nuovaSessione(c.id);
  },
};

const server = http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const [via, cerca] = (req.url || '').split('?');
  const nome = via.replace('/rest/v1/rpc/', '');
  const aut = autenticazione[via];
  if (!aut && !funzioni[nome]) { res.writeHead(404, cors); return res.end('{"message":"funzione sconosciuta"}'); }
  let corpo = '';
  req.on('data', d => { corpo += d; });
  req.on('end', () => {
    try {
      const dati = corpo ? JSON.parse(corpo) : {};
      const out = aut ? aut(dati, cerca) : funzioni[nome](dati, chiSei(req.headers));
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out === undefined ? null : out));
    } catch (e) {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: e.message, msg: e.message }));
    }
  });
});

const porta = Number(process.env.PORT || 8200);
server.listen(porta, () => console.log('finto supabase su ' + porta));
