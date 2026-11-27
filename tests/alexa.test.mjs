// Proves de la skill d'Alexa amb una base de dades de mentida.
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as products from '../js/products.js';
import * as habits from '../js/habits.js';

const { createSkill, splitProducts } = createRequire(import.meta.url)('../functions/alexa.js');
const NOW = Date.UTC(2026, 10, 27, 17);
const USER = 'amzn1.ask.account.TEST';

let db;
let skill;
beforeEach(() => {
  db = { links: {}, codes: {}, items: [], history: [] };
  const repo = {
    getLink: async (id) => db.links[id] ?? null,
    setLink: async (id, link) => { db.links[id] = link; },
    deleteLink: async (id) => { delete db.links[id]; },
    takeCode: async (code) => { const c = db.codes[code]; delete db.codes[code]; return c ?? null; },
    listItems: async () => db.items.map((i) => ({ ...i })),
    listHistory: async () => db.history,
    addItem: async (_, item) => { db.items.push({ id: String(db.items.length), ...item }); },
    updateItem: async (_, id, patch) => Object.assign(db.items.find((i) => i.id === id), patch),
    remember: async (_, entry) => { db.history.push(entry); },
  };
  skill = createSkill({ repo, shared: { products, habits }, now: () => NOW });
});

const intent = (name, slots = {}) => ({
  session: { user: { userId: USER } },
  request: {
    type: 'IntentRequest',
    intent: { name, slots: Object.fromEntries(Object.entries(slots).map(([k, value]) => [k, { name: k, value }])) },
  },
});
const said = (res) => res.response.outputSpeech.text;
const linked = () => { db.links[USER] = { home: 'ABCD', uid: 'anna', name: 'Anna' }; };

describe('vincular', () => {
  test('amb un codi bo queda connectada i el codi ja no serveix', async () => {
    db.codes['482913'] = { home: 'ABCD', uid: 'anna', name: 'Anna', expiresAt: NOW + 1000 };
    assert.match(said(await skill(intent('LinkIntent', { codigo: '482913' }))), /conectada/);
    assert.deepEqual(db.links[USER], { home: 'ABCD', uid: 'anna', name: 'Anna', linkedAt: NOW });
    assert.equal(db.codes['482913'], undefined);
  });
  test('un codi caducat o inexistent no connecta', async () => {
    db.codes['482913'] = { home: 'ABCD', uid: 'anna', name: 'Anna', expiresAt: NOW - 1 };
    assert.match(said(await skill(intent('LinkIntent', { codigo: '482913' }))), /caducado/);
    assert.match(said(await skill(intent('LinkIntent', { codigo: '999999' }))), /caducado/);
    assert.equal(db.links[USER], undefined);
  });
  test('sense vincular no afegeix res', async () => {
    assert.match(said(await skill(intent('AddItemIntent', { producto: 'leche' }))), /Connecta amb Alexa/);
    assert.equal(db.items.length, 0);
  });
});

describe('afegir', () => {
  beforeEach(linked);
  test('el castellà del catàleg es desa en català, amb categoria i historial', async () => {
    const res = await skill(intent('AddItemIntent', { producto: 'leche y huevos' }));
    assert.equal(said(res), 'Hecho, he añadido Llet y Ous a la lista.');
    assert.deepEqual(db.items.map((i) => [i.name, i.category, i.addedBy, i.uid]), [
      ['Llet', 'lacteos', 'Anna', 'anna'], ['Ous', 'lacteos', 'Anna', 'anna'],
    ]);
    assert.deepEqual(db.history.map((h) => [h.name, h.dates]), [['Llet', [NOW]], ['Ous', [NOW]]]);
  });
  test('quantitats dites en paraules', async () => {
    await skill(intent('AddItemIntent', { producto: 'dos litros de leche' }));
    assert.deepEqual([db.items[0].name, db.items[0].qty], ['Llet', '2 litros']);
  });
  test('el que no és al catàleg queda tal com s\'ha dit', async () => {
    await skill(intent('AddItemIntent', { producto: 'salsa de soja' }));
    assert.equal(db.items[0].name, 'Salsa de soja');
  });
  test('no duplica el que ja hi és i torna a posar el que ja s\'havia comprat', async () => {
    db.items.push({ id: 'a', name: 'Llet', qty: '', done: false }, { id: 'b', name: 'Pa', qty: '', done: true, doneAt: 1 });
    const res = await skill(intent('AddItemIntent', { producto: 'leche, pan' }));
    assert.equal(said(res), 'Hecho, he añadido Pa a la lista. Llet ya estaba en la lista.');
    assert.equal(db.items.length, 2);
    assert.equal(db.items[1].done, false);
  });
  test('llegeix la llista', async () => {
    db.items.push({ id: 'a', name: 'Llet', qty: '2', done: false }, { id: 'b', name: 'Pa', done: true });
    assert.equal(said(await skill(intent('ReadListIntent'))), 'En la lista hay una cosa: 2 de Llet.');
  });
  test('desconnectar', async () => {
    await skill(intent('UnlinkIntent'));
    assert.equal(db.links[USER], undefined);
  });
});

test('separa els productes', () => {
  assert.deepEqual(splitProducts('leche, unos tomates y una barra de pan'), ['leche', 'tomates', '1 barra de pan']);
});
