/* Finto Supabase per i collaudi.
   Parla la stessa lingua delle cinque funzioni SQL vere
   (/rest/v1/rpc/<nome>) ma tiene tutto in memoria. Serve perché la
   macchina dove girano i collaudi non ha accesso a internet: così il
   giro completo — due telefoni che si passano le mosse — si prova
   comunque, e quello che resta da verificare a mano è solo il tratto
   di filo fra il telefono e Supabase.
   Uso: node tools/finto-supabase.js  (porta da PORT, default 8200) */
import http from 'node:http';

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
};

const server = http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const nome = (req.url || '').replace('/rest/v1/rpc/', '').split('?')[0];
  if (!funzioni[nome]) { res.writeHead(404, cors); return res.end('{"message":"funzione sconosciuta"}'); }
  let corpo = '';
  req.on('data', d => { corpo += d; });
  req.on('end', () => {
    try {
      const out = funzioni[nome](corpo ? JSON.parse(corpo) : {});
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out === undefined ? null : out));
    } catch (e) {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: e.message }));
    }
  });
});

const porta = Number(process.env.PORT || 8200);
server.listen(porta, () => console.log('finto supabase su ' + porta));
