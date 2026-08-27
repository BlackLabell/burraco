/* ============================================================
   BURRACO — il conto del giocatore
   Registrazione e accesso con email e password. La password non
   passa mai da qui dentro se non per essere spedita a Supabase, che
   la conserva cifrata: noi non la vediamo, non la salviamo, non la
   scriviamo da nessuna parte. Sul telefono restano solo i due
   gettoni della sessione.

   Il conto è facoltativo: senza, si gioca lo stesso e le statistiche
   restano sul telefono. Con, seguono la persona da un telefono
   all'altro.
   ============================================================ */

import { SERVIZIO } from './rete.js';

const CASSETTO_CONTO = 'burraco.conto.v1';

/* Messaggi in italiano al posto di quelli di Supabase, che sono in
   inglese e parlano di cose che al giocatore non interessano. */
function tradotto(testo) {
  const t = String(testo || '').toLowerCase();
  if (t.includes('invalid login')) return 'Email o password non giusti.';
  if (t.includes('already registered') || t.includes('already been registered')) return 'Questa email ha già un conto: entra invece di registrarti.';
  if (t.includes('password should be') || t.includes('password must')) return 'La password è troppo corta: almeno 8 caratteri.';
  if (t.includes('unable to validate email') || t.includes('invalid format') || t.includes('valid email')) return 'Questa email non sembra scritta bene.';
  if (t.includes('email not confirmed')) return 'Devi prima confermare l\'email: controlla la posta.';
  if (t.includes('rate limit') || t.includes('too many')) return 'Troppi tentativi: aspetta qualche minuto.';
  if (t.includes('nome è già preso')) return 'Questo nome è già di qualcun altro: provane un altro.';
  if (t.includes('non hai fatto l')) return 'Devi entrare nel tuo conto.';
  return testo || 'Qualcosa non ha funzionato.';
}

async function parla(percorso, corpo, gettone, ms = 15000) {
  const stop = new AbortController();
  const t = setTimeout(() => stop.abort(), ms);
  try {
    const r = await fetch(SERVIZIO.url + percorso, {
      method: 'POST',
      headers: {
        apikey: SERVIZIO.chiave,
        Authorization: 'Bearer ' + (gettone || SERVIZIO.chiave),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(corpo || {}),
      signal: stop.signal,
    });
    const testo = await r.text();
    const dati = testo ? JSON.parse(testo) : null;
    if (!r.ok) {
      const m = dati && (dati.msg || dati.message || dati.error_description || dati.error || dati.hint);
      throw new Error(tradotto(m));
    }
    return dati;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Il servizio non risponde: controlla la connessione.');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export const Conto = {
  dentro: false,
  nome: '',
  email: '',
  stat: null,
  gettone: null,        // vale un'ora, poi si rinnova col rinnovo
  rinnovo: null,
  scade: 0,

  /* ---------- sessione sul telefono ---------- */
  salva() {
    try {
      if (this.gettone) {
        localStorage.setItem(CASSETTO_CONTO, JSON.stringify({
          gettone: this.gettone, rinnovo: this.rinnovo, scade: this.scade,
          nome: this.nome, email: this.email,
        }));
      } else localStorage.removeItem(CASSETTO_CONTO);
    } catch (e) { }
  },
  leggi() {
    try {
      const d = JSON.parse(localStorage.getItem(CASSETTO_CONTO) || 'null');
      if (!d || !d.gettone) return false;
      this.gettone = d.gettone; this.rinnovo = d.rinnovo; this.scade = d.scade || 0;
      this.nome = d.nome || ''; this.email = d.email || '';
      this.dentro = true;
      return true;
    } catch (e) { return false; }
  },

  prendiSessione(s) {
    if (!s || !s.access_token) throw new Error('Il servizio ha risposto in modo strano.');
    this.gettone = s.access_token;
    this.rinnovo = s.refresh_token || null;
    this.scade = Date.now() + (s.expires_in || 3600) * 1000;
    this.email = (s.user && s.user.email) || this.email;
    this.dentro = true;
    this.salva();
  },

  /** Il gettone dura un'ora: se sta per scadere si rinnova da solo. */
  async gettoneBuono() {
    if (!this.dentro) return null;
    if (this.scade - Date.now() > 60000) return this.gettone;
    if (!this.rinnovo) return this.gettone;
    try {
      const s = await parla('/auth/v1/token?grant_type=refresh_token', { refresh_token: this.rinnovo });
      this.prendiSessione(s);
    } catch (e) {
      this.esci();                       // sessione scaduta davvero: si rientra a mano
      throw new Error('La sessione è scaduta: rientra nel tuo conto.');
    }
    return this.gettone;
  },

  /* ---------- registrazione e accesso ---------- */

  /**
   * Apre un conto nuovo. Se il progetto chiede la conferma dell'email,
   * Supabase non restituisce la sessione: in quel caso si avvisa e basta.
   */
  async registrati(email, password, nome) {
    const r = await parla('/auth/v1/signup', { email: String(email || '').trim(), password });
    if (!r || !r.access_token) return { daConfermare: true };
    this.prendiSessione(r);
    await this.aggiorna(nome);
    return { daConfermare: false };
  },

  async entra(email, password) {
    const r = await parla('/auth/v1/token?grant_type=password',
      { email: String(email || '').trim(), password });
    this.prendiSessione(r);
    await this.aggiorna();
    return true;
  },

  esci() {
    this.dentro = false; this.gettone = null; this.rinnovo = null; this.scade = 0;
    this.nome = ''; this.email = ''; this.stat = null;
    this.salva();
  },

  /* ---------- profilo e statistiche ---------- */
  async rpc(funzione, corpo) {
    const g = await this.gettoneBuono();
    if (!g) throw new Error('Devi entrare nel tuo conto.');
    return parla('/rest/v1/rpc/' + funzione, corpo || {}, g);
  },

  /** Rilegge nome e statistiche dal servizio. */
  async aggiorna(nomeSuggerito) {
    const c = await this.rpc('mio_conto', { p_nome: nomeSuggerito || null });
    if (c) { this.nome = c.nome || this.nome; this.stat = c.stat || null; }
    this.salva();
    return c;
  },

  async cambiaNome(nuovo) {
    const r = await this.rpc('scegli_nome', { p_nome: nuovo });
    this.nome = (r && r.nome) || nuovo;
    this.salva();
    return this.nome;
  },

  /* Le due chiamate che segnano il gioco. Non fanno rumore: se la rete
     non c'è, la partita continua lo stesso e si perde solo il conteggio
     di quella mano. */
  segnaMano(punti, chiusura, burrachi) {
    if (!this.dentro) return;
    const b = burrachi || {};
    this.rpc('segna_mano', {
      p_punti: Math.round(punti || 0), p_chiusura: !!chiusura,
      p_puliti: b.pulito || 0, p_semi: b.semipulito || 0, p_sporchi: b.sporco || 0,
    }).catch(() => { });
  },
  segnaPartita(vinta, online) {
    if (!this.dentro) return;
    this.rpc('segna_partita', { p_vinta: !!vinta, p_online: !!online }).catch(() => { });
  },

  /** Una volta sola: le partite già giocate sul telefono entrano nel conto. */
  async portaStorico(locale) {
    const c = await this.rpc('porta_storico', { p_stat: locale });
    if (c) { this.nome = c.nome || this.nome; this.stat = c.stat || null; }
    this.salva();
    return c;
  },
};

export default Conto;
