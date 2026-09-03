/* ============================================================
   BURRACO — gioco online
   Non si spedisce il tavolo: si spediscono le mosse.
   Il tavolo si apre con un codice di quattro lettere; chi entra riceve
   il seme del mazzo e distribuisce le stesse identiche carte. Da lì in
   poi ogni telefono manda le proprie mosse e legge quelle dell'altro,
   e le applica con lo stesso motore. Una mossa sono poche decine di
   byte, quindi va bene anche con una tacca di rete.

   Dietro c'è Supabase (piano gratuito): cinque funzioni SQL, nessuna
   libreria da scaricare, solo fetch. Le tabelle non si toccano mai
   direttamente: senza il codice del tavolo non si ottiene niente.
   ============================================================ */

const CONFIG = (typeof window !== 'undefined' && window.__RETE__) || {};
const URL_BASE = CONFIG.url || 'https://cpwodjykbfmyykybbtzm.supabase.co';
const CHIAVE = CONFIG.chiave || 'sb_publishable_tnIBNo_liLN-ELDBf0mWdQ_rcv60A4O';

/* L'indirizzo del servizio lo usa anche il modulo del conto: sta scritto qui
   una volta sola. La chiave è pubblica per costruzione — non apre niente da
   sola, sono le regole del database a decidere cosa si può fare. */
export const SERVIZIO = { url: URL_BASE, chiave: CHIAVE };

/* Ogni quanto si va a vedere se l'altro ha mosso. Il burraco è a turni:
   un secondo scarso non si sente, e tiene i consumi a zero. */
export const RITMO = CONFIG.ritmo || 1200;

async function chiama(funzione, corpo, ms = 12000) {
  const stop = new AbortController();
  const t = setTimeout(() => stop.abort(), ms);
  try {
    const r = await fetch(`${URL_BASE}/rest/v1/rpc/${funzione}`, {
      method: 'POST',
      headers: { apikey: CHIAVE, Authorization: 'Bearer ' + CHIAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo || {}),
      signal: stop.signal,
    });
    const testo = await r.text();
    const dati = testo ? JSON.parse(testo) : null;
    if (!r.ok) throw new Error((dati && (dati.message || dati.hint)) || 'errore di rete');
    return dati;
  } finally {
    clearTimeout(t);
  }
}

/** Il tavolo a cui siamo seduti. Uno solo per volta. */
export const Rete = {
  attiva: false,
  codice: null,
  posto: 0,       // 0 = chi ha aperto il tavolo, 1 = chi è entrato
  passo: 0,       // quante mosse sono già passate di qui
  chatPasso: 0,   // lo stesso, ma per la chat (Lavoro 6): un registro a parte,
                  // così una raffica di frasi non sfasa mai i numeri delle mosse
  nomi: ['', ''],
  partita: null,

  /**
   * Apre un tavolo nuovo e ne restituisce il codice.
   * `tempo` (Lavoro 4, online a tempo): secondi per turno — 30, 45 o 60 —
   * oppure `null`/`0` per nessun limite. La sceglie solo chi apre il tavolo,
   * come deciso da Fabio: chi entra la eredita, non la sceglie.
   */
  async apri(nome, modo = '1v1', target = 2005, tempo = null) {
    const p = await chiama('apri_tavolo', { p_modo: modo, p_target: target, p_nome: nome || '', p_tempo: tempo || null });
    this.siedi(p, 0);
    return p;
  },

  /** Si siede a un tavolo già aperto. Il codice non conta maiuscole. */
  async entra(codice, nome) {
    const p = await chiama('siediti', { p_codice: String(codice || '').trim().toUpperCase(), p_nome: nome || '' });
    this.siedi(p, 1);
    return p;
  },

  /** Rientra al tavolo senza toccare i nomi (dopo aver chiuso l'app). */
  async rientra(codice, posto) {
    const p = await chiama('guarda_tavolo', { p_codice: String(codice || '').trim().toUpperCase() });
    if (!p) throw new Error('tavolo non trovato');
    this.siedi(p, posto);
    return p;
  },

  siedi(p, posto) {
    this.attiva = true;
    this.codice = p.codice;
    this.posto = posto;
    this.passo = 0;
    this.chatPasso = 0;
    this.nomi = Array.isArray(p.nomi) ? p.nomi : ['', ''];
    this.partita = p;
  },

  /** Chi ha aperto il tavolo aspetta qui che arrivi l'altro. */
  async guarda() {
    const p = await chiama('guarda_tavolo', { p_codice: this.codice });
    if (p) { this.nomi = Array.isArray(p.nomi) ? p.nomi : this.nomi; this.partita = p; }
    return p;
  },

  /**
   * Manda una mossa. Il numero progressivo lo decide chi manda: se per
   * un pasticcio due mosse prendessero lo stesso numero, la seconda
   * verrebbe rifiutata dal database invece di sfasare i due tavoli.
   */
  async manda(mossa, mano) {
    if (!this.attiva) return;
    const n = this.passo++;
    try {
      await chiama('manda_mossa', {
        p_codice: this.codice, p_n: n, p_posto: this.posto,
        p_mossa: { ...mossa, mano },
      });
    } catch (e) {
      this.passo = n;          // non è passata: si riprova col numero suo
      throw e;
    }
  },

  /** Le mosse arrivate da qui in poi, già in ordine. */
  async nuove() {
    if (!this.attiva) return [];
    const righe = await chiama('leggi_mosse', { p_codice: this.codice, p_da: this.passo });
    const fuori = (righe || []).filter(r => r.n >= this.passo);
    if (fuori.length) this.passo = fuori[fuori.length - 1].n + 1;
    return fuori;
  },

  /** Tutte le mosse dall'inizio: serve a rientrare. */
  async tutte() {
    const righe = await chiama('leggi_mosse', { p_codice: this.codice, p_da: 0 });
    this.passo = righe && righe.length ? righe[righe.length - 1].n + 1 : 0;
    return righe || [];
  },

  /**
   * Manda una frase di chat (Lavoro 6): solo frasi standard e faccine già
   * decise, mai testo libero — vedi FRASI_CHAT in src/ui.js. Stessa logica
   * di `manda()`, ma su un registro separato (tabella `chat`, non `mosse`):
   * una raffica di frasi non deve poter sfasare il numero delle mosse vere.
   */
  async mandaChat(testo) {
    if (!this.attiva) return;
    const n = this.chatPasso++;
    try {
      await chiama('manda_chat', { p_codice: this.codice, p_n: n, p_posto: this.posto, p_testo: testo });
    } catch (e) {
      this.chatPasso = n;
      throw e;
    }
  },

  /** Solo per il rientro: manda avanti il cursore della chat senza mostrare
      le frasi vecchie — non ha senso far ricomparire in fumetti un "Bel gioco!"
      di dieci minuti fa. Le mosse vere si rigiocano tutte apposta (servono a
      ricostruire il tavolo); la chat no, è solo cronaca del momento. */
  async saltaChatEsistente() {
    if (!this.attiva) return;
    const righe = await chiama('leggi_chat', { p_codice: this.codice, p_da: 0 });
    this.chatPasso = righe && righe.length ? righe[righe.length - 1].n + 1 : 0;
  },

  /** Le frasi arrivate da qui in poi, già in ordine. */
  async nuoveChat() {
    if (!this.attiva) return [];
    const righe = await chiama('leggi_chat', { p_codice: this.codice, p_da: this.chatPasso });
    const fuori = (righe || []).filter(r => r.n >= this.chatPasso);
    if (fuori.length) this.chatPasso = fuori[fuori.length - 1].n + 1;
    return fuori;
  },

  esci() {
    this.attiva = false; this.codice = null; this.posto = 0; this.passo = 0; this.chatPasso = 0;
    this.nomi = ['', '']; this.partita = null;
  },
};

export default Rete;
