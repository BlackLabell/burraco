/* ============================================================
   BURRACO — statistiche
   Si contano sempre, sul telefono, anche senza conto e senza rete:
   una partita giocata in treno vale come le altre. Chi ha un conto
   se le porta dietro da un telefono all'altro, e la prima volta che
   entra può portarsi dentro anche quelle già fatte.
   ============================================================ */

const CASSETTO_STAT = 'burraco.stat.v1';

const VUOTE = {
  partite: 0, vinte: 0,
  partite_online: 0, vinte_online: 0,
  mani: 0, chiusure: 0,
  burrachi_puliti: 0, burrachi_semi: 0, burrachi_sporchi: 0,
  punti: 0, miglior_mano: 0,
  striscia: 0, miglior_striscia: 0,
  portate: false,          // già travasate in un conto?
};

export const Stat = {
  dati: { ...VUOTE },

  leggi() {
    try {
      const d = JSON.parse(localStorage.getItem(CASSETTO_STAT) || 'null');
      if (d && typeof d === 'object') this.dati = { ...VUOTE, ...d };
    } catch (e) { }
    return this.dati;
  },
  salva() {
    try { localStorage.setItem(CASSETTO_STAT, JSON.stringify(this.dati)); } catch (e) { }
  },

  /** Fine di una mano: punti fatti, chiusura, burrachi del turno. */
  mano(punti, chiusura, burrachi) {
    const d = this.dati, b = burrachi || {};
    d.mani++;
    if (chiusura) d.chiusure++;
    d.burrachi_puliti += b.pulito || 0;
    d.burrachi_semi += b.semipulito || 0;
    d.burrachi_sporchi += b.sporco || 0;
    d.punti += Math.round(punti || 0);
    if (punti > d.miglior_mano) d.miglior_mano = Math.round(punti);
    this.salva();
  },

  /** Fine di una partita. */
  partita(vinta, online) {
    const d = this.dati;
    d.partite++;
    if (online) d.partite_online++;
    if (vinta) {
      d.vinte++;
      if (online) d.vinte_online++;
      d.striscia++;
      if (d.striscia > d.miglior_striscia) d.miglior_striscia = d.striscia;
    } else d.striscia = 0;
    this.salva();
  },

  /** C'è qualcosa da portare dentro a un conto nuovo? */
  daPortare() {
    return !this.dati.portate && (this.dati.partite > 0 || this.dati.mani > 0);
  },
  segnaPortate() { this.dati.portate = true; this.salva(); },

  azzera() { this.dati = { ...VUOTE }; this.salva(); },
};

/** Le voci da mostrare, calcolate. `d` può venire dal telefono o dal conto. */
export function riassunto(d) {
  const s = { ...VUOTE, ...(d || {}) };
  const perc = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  return {
    partite: s.partite,
    vinte: s.vinte,
    perse: Math.max(0, s.partite - s.vinte),
    percentuale: perc(s.vinte, s.partite),
    online: s.partite_online,
    vinteOnline: s.vinte_online,
    percOnline: perc(s.vinte_online, s.partite_online),
    mani: s.mani,
    chiusure: s.chiusure,
    percChiusure: perc(s.chiusure, s.mani),
    burrachi: (s.burrachi_puliti || 0) + (s.burrachi_semi || 0) + (s.burrachi_sporchi || 0),
    puliti: s.burrachi_puliti || 0,
    semi: s.burrachi_semi || 0,
    sporchi: s.burrachi_sporchi || 0,
    punti: s.punti,
    mediaMano: s.mani ? Math.round(s.punti / s.mani) : 0,
    migliorMano: s.miglior_mano,
    striscia: s.striscia || 0,
    migliorStriscia: s.miglior_striscia || 0,
  };
}

export default Stat;
