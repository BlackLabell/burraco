import assert from 'node:assert/strict';
import { apri, entra, vedi, mossa, _test } from './nucleo.js';
import { dbFinto } from './db-finto.js';

async function prova(nome, fn) {
  try {
    await fn();
    console.log('ok -', nome);
  } catch (e) {
    console.error('FALLITO -', nome);
    console.error(e);
    process.exitCode = 1;
  }
}

await prova('apri + entra: ciascuno vede solo la propria mano', async () => {
  const db = dbFinto();
  const a = await apri(db, { modo: '1v1', target: 2005, nome: 'Alice' });
  const b = await entra(db, { codice: a.codice, nome: 'Bob' });

  assert.equal(a.mano.length, 11);
  assert.equal(b.mano.length, 11);
  assert.equal(a.carteInMano[0], 11);
  assert.equal(a.carteInMano[1], 11);

  // La mano dell'altro non deve MAI comparire nella risposta di uno.
  const idAlice = new Set(a.mano.map(c => c.id));
  const idBob = new Set(b.mano.map(c => c.id));
  for (const id of idBob) assert.ok(!idAlice.has(id), 'una carta di Bob è finita nella risposta di Alice');
  for (const id of idAlice) assert.ok(!idBob.has(id), 'una carta di Alice è finita nella risposta di Bob');

  // Il tallone e i pozzetti non si vedono affatto: solo il numero di carte.
  assert.equal(typeof a.tallone, 'number');
  assert.ok(!('stock' in a) && !('pozzetti' in a));
});

await prova('entra su tavolo già pieno viene rifiutato', async () => {
  const db = dbFinto();
  const a = await apri(db, { nome: 'Alice' });
  await entra(db, { codice: a.codice, nome: 'Bob' });
  await assert.rejects(() => entra(db, { codice: a.codice, nome: 'Carlo' }), /completo/);
});

await prova('segreto sbagliato viene respinto, sia in vedi che in mossa', async () => {
  const db = dbFinto();
  const a = await apri(db, { nome: 'Alice' });
  await entra(db, { codice: a.codice, nome: 'Bob' });
  await assert.rejects(() => vedi(db, { codice: a.codice, posto: 0, segreto: 'sbagliato' }), /riconosciuto/);
  await assert.rejects(
    () => mossa(db, { codice: a.codice, posto: 0, segreto: 'sbagliato', mossa: { t: 'p', s: 'stock' } }),
    /riconosciuto/
  );
});

await prova('non si gioca fuori dal proprio turno, e lo stato non si tocca', async () => {
  const db = dbFinto();
  const a = await apri(db, { nome: 'Alice' });
  const b = await entra(db, { codice: a.codice, nome: 'Bob' });
  const primaDiTutto = await db.leggi(a.codice);

  // Il turno di apertura è di chi NON ha aperto il tavolo (dealer = 0 → gioca il posto 1).
  assert.equal(a.turno, 1);
  const nonDiTurno = a.turno === 0 ? 1 : 0;
  const segretoSbagliatoTurno = nonDiTurno === 0 ? a.segreto : b.segreto;

  const r = await mossa(db, { codice: a.codice, posto: nonDiTurno, segreto: segretoSbagliatoTurno, mossa: { t: 'p', s: 'stock' } });
  assert.equal(r.ok, false);

  const dopo = await db.leggi(a.codice);
  assert.deepEqual(dopo.stato, primaDiTutto.stato, 'una mossa respinta non deve cambiare lo stato salvato');
});

await prova('una mossa malformata viene respinta senza far esplodere niente', async () => {
  const db = dbFinto();
  const a = await apri(db, { nome: 'Alice' });
  await entra(db, { codice: a.codice, nome: 'Bob' });
  const diTurno = a.turno;
  const segretoGiusto = (await db.leggi(a.codice)).segreti[diTurno];

  const r1 = await mossa(db, { codice: a.codice, posto: diTurno, segreto: segretoGiusto, mossa: { t: 'zzz' } });
  assert.equal(r1.ok, false);

  const r2 = await mossa(db, { codice: a.codice, posto: diTurno, segreto: segretoGiusto, mossa: { t: 'c', ids: ['non-esiste-1', 'non-esiste-2', 'non-esiste-3'] } });
  assert.equal(r2.ok, false);
});

await prova('una mano giocata per bene alterna i turni e riduce le mani', async () => {
  const db = dbFinto();
  let a = await apri(db, { nome: 'Alice' });
  let b = await entra(db, { codice: a.codice, nome: 'Bob' });
  const segreti = [a.segreto, b.segreto];
  let v = a.turno === 0 ? a : b;

  for (let giro = 0; giro < 6; giro++) {
    const posto = v.turno;
    const segreto = segreti[posto];
    // pesca
    let r = await mossa(db, { codice: a.codice, posto, segreto, mossa: { t: 'p', s: 'stock' } });
    assert.equal(r.ok, true, 'pescata respinta: ' + r.errore);
    assert.equal(r.mano.length, 12);
    // scarta la prima carta in mano (mossa sempre legale se non si è appena calato tutto)
    const carta = r.mano[0];
    r = await mossa(db, { codice: a.codice, posto, segreto, mossa: { t: 's', id: carta.id } });
    assert.equal(r.ok, true, 'scarto respinto: ' + r.errore);
    assert.equal(r.mano.length, 11);
    v = r;
  }
  console.log('   → dopo 6 giri, turno di:', v.turno, '- mani:', v.carteInMano);
});

await prova('la versione sale solo quando una mossa viene davvero accettata', async () => {
  const db = dbFinto();
  const a = await apri(db, { nome: 'Alice' });
  const b = await entra(db, { codice: a.codice, nome: 'Bob' });
  assert.equal(a.versione, 0);
  assert.equal(b.versione, 0);

  const diTurno = a.turno;
  const segreti = [a.segreto, b.segreto];

  // mossa respinta (fuori turno): versione ferma
  const nonDiTurno = diTurno === 0 ? 1 : 0;
  const r1 = await mossa(db, { codice: a.codice, posto: nonDiTurno, segreto: segreti[nonDiTurno], mossa: { t: 's', id: 'x' } });
  assert.equal(r1.ok, false);
  assert.equal(r1.versione, 0);

  // mossa accettata: versione sale di uno
  const r2 = await mossa(db, { codice: a.codice, posto: diTurno, segreto: segreti[diTurno], mossa: { t: 'p', s: 'stock' } });
  assert.equal(r2.ok, true);
  assert.equal(r2.versione, 1);

  const r3 = await vedi(db, { codice: a.codice, posto: diTurno, segreto: segreti[diTurno] });
  assert.equal(r3.versione, 1);
});

console.log(process.exitCode ? '\nQUALCOSA È FALLITO.' : '\nTutto ok.');
