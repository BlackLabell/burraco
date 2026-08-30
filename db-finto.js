/* Database finto in memoria, con la stessa forma dei tre metodi che il
   nucleo si aspetta. Serve solo per i collaudi locali. */
export function dbFinto() {
  const righe = new Map();
  return {
    async leggi(codice) {
      const r = righe.get(codice);
      return r ? structuredClone(r) : null;
    },
    async crea(riga) {
      if (righe.has(riga.codice)) throw new Error('codice già usato');
      righe.set(riga.codice, structuredClone(riga));
    },
    async aggiorna(codice, campi) {
      const r = righe.get(codice);
      if (!r) throw new Error('riga non trovata');
      Object.assign(r, structuredClone(campi));
    },
    _righe: righe,
  };
}
