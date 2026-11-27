// Proves de firestore.rules amb l'emulador: el que fa l'app ha de passar i el
// que no fa (camps estranys, textos enormes, llars inexistents) s'ha de rebutjar.
// S'executa amb `npm run test:rules` (cal Java per a l'emulador).
import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const HOME = 'ABCD-EFGH-JKMN';
const increment = (n) => firebase.firestore.FieldValue.increment(n);
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-casa',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(`households/${HOME}`).set({ createdAt: 1 }));
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const home = (db, code = HOME) => db.doc(`households/${code}`);
const item = (uid) => ({ name: 'Llet', qty: '2', category: 'lacteos', done: false, doneAt: null, addedBy: 'Anna', createdAt: Date.now(), uid });

describe('llar', () => {
  test('crear i comprovar si existeix', async () => {
    const db = as('anna');
    await assertSucceeds(home(db, 'NOVA-LLAR-0000').set({ createdAt: Date.now() }));
    await assertSucceeds(home(db).get());
  });
  test('no es pot llistar ni crear amb camps estranys', async () => {
    const db = as('anna');
    await assertFails(db.collection('households').get());
    await assertFails(home(db, 'ALTRA-LLAR-0000').set({ createdAt: 1, admin: true }));
  });
  test('sense sessió no s\'hi pot entrar', async () => {
    await assertFails(home(env.unauthenticatedContext().firestore()).get());
  });
});

describe('compra', () => {
  test('el que fa l\'app passa', async () => {
    const items = home(as('anna')).collection('items');
    const ref = await assertSucceeds(items.add(item('anna')));
    await assertSucceeds(items.get());
    await assertSucceeds(ref.update({ done: true, doneAt: Date.now() }));
    await assertSucceeds(ref.update({ name: 'Llet sencera', qty: '', category: 'lacteos' }));
    await assertSucceeds(ref.delete());
    // «Desfés»: es restaura amb el mateix id i `restored`.
    await assertSucceeds(items.doc(ref.id).set({ ...item('anna'), restored: true }));
  });
  test('qualsevol de la família canvia el que ha afegit un altre', async () => {
    const ref = await home(as('anna')).collection('items').add(item('anna'));
    await assertSucceeds(home(as('bea')).collection('items').doc(ref.id).update({ done: true, doneAt: 1 }));
  });
  test('es rebutja el que l\'app no fa', async () => {
    const items = home(as('anna')).collection('items');
    await assertFails(items.add({ ...item('anna'), name: '' }));
    await assertFails(items.add({ ...item('anna'), name: 'x'.repeat(81) }));
    await assertFails(items.add({ ...item('anna'), qty: 'x'.repeat(5000) }));
    await assertFails(items.add({ ...item('anna'), done: 'sí' }));
    await assertFails(items.add({ ...item('anna'), extra: 'x' }));
    const ref = await items.add(item('anna'));
    await assertFails(ref.update({ extra: 'x' }));
  });
  test('una llar que no existeix no es pot fer servir', async () => {
    await assertFails(home(as('anna'), 'NO-EXISTEIX').collection('items').add(item('anna')));
    await assertFails(home(as('anna'), 'NO-EXISTEIX').collection('items').get());
  });
  test('un document antic amb camps que ja no es fan servir es pot continuar marcant', async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(`households/${HOME}/items/vell`).set({ name: 'Pa', done: false, vell: 1 }));
    await assertSucceeds(home(as('anna')).collection('items').doc('vell').update({ done: true, doneAt: 1 }));
  });
});

describe('historial', () => {
  test('recordar, comptar i ajornar', async () => {
    const ref = home(as('anna')).collection('history').doc('llet');
    await assertSucceeds(ref.set({ name: 'Llet', category: 'lacteos', dates: [1, 2, 3], count: increment(1), lastAt: Date.now() }, { merge: true }));
    await assertSucceeds(ref.set({ name: 'Llet', category: 'lacteos', count: increment(1), lastAt: Date.now() }, { merge: true }));
    await assertSucceeds(ref.set({ name: 'Llet', category: 'lacteos', snoozedUntil: Date.now(), count: increment(0), lastAt: Date.now() }, { merge: true }));
  });
  test('es rebutja una llista de dates enorme o un comptador de text', async () => {
    const ref = home(as('anna')).collection('history').doc('llet');
    await assertFails(ref.set({ name: 'Llet', dates: Array.from({ length: 50 }, (_, i) => i), count: 1, lastAt: 1 }));
    await assertFails(ref.set({ name: 'Llet', count: 'molts', lastAt: 1 }));
  });
});

describe('per a casa', () => {
  const wish = { name: 'Tele', note: '', priority: 'mitjana', order: Date.now(), done: false, doneAt: null, addedBy: 'Anna', createdAt: Date.now(), uid: 'anna' };
  test('afegir, arrossegar, marcar i netejar', async () => {
    const wishes = home(as('anna')).collection('wishes');
    const ref = await assertSucceeds(wishes.add(wish));
    await assertSucceeds(ref.update({ priority: 'alta', order: 1.5 }));
    await assertSucceeds(ref.update({ name: 'Tele nova', note: 'IKEA', priority: 'baixa' }));
    await assertSucceeds(ref.update({ done: true, doneAt: 1 }));
    await assertSucceeds(ref.delete());
  });
  test('prioritat desconeguda o nota massa llarga', async () => {
    const wishes = home(as('anna')).collection('wishes');
    await assertFails(wishes.add({ ...wish, priority: 'urgentíssima' }));
    await assertFails(wishes.add({ ...wish, note: 'x'.repeat(141) }));
  });
});

describe('Nadal', () => {
  const gift = { name: 'Llibre', link: '', photo: '', addedBy: 'Anna', createdAt: 1, uid: 'anna' };
  test('cadascú només toca els seus regals', async () => {
    const ref = await assertSucceeds(home(as('anna')).collection('gifts').add(gift));
    await assertSucceeds(home(as('bea')).collection('gifts').get());
    await assertFails(home(as('bea')).collection('gifts').doc(ref.id).update({ name: 'Meu' }));
    await assertFails(home(as('bea')).collection('gifts').add(gift));
    await assertSucceeds(home(as('anna')).collection('gifts').doc(ref.id).update({ name: 'Llibre 2', link: 'https://a.cat', photo: '' }));
  });
  test('foto gran a part: només el dueny, en el mateix lot que el regal', async () => {
    const db = as('anna');
    const ref = await home(db).collection('gifts').add({ ...gift, photo: 'data:image/jpeg;base64,vella' });
    const photo = ref.collection('photo').doc('full');
    // Migració o foto nova: miniatura al regal, foto gran a part, `photo` fora.
    const batch = db.batch();
    batch.update(ref, { thumb: 'data:image/jpeg;base64,petita', photo: firebase.firestore.FieldValue.delete() });
    batch.set(photo, { data: 'data:image/jpeg;base64,gran' });
    await assertSucceeds(batch.commit());
    await assertSucceeds(home(as('bea')).collection('gifts').doc(ref.id).collection('photo').doc('full').get());
    await assertFails(home(as('bea')).collection('gifts').doc(ref.id).collection('photo').doc('full').set({ data: 'x' }));
    await assertFails(photo.set({ data: 'x', extra: 1 }));
    await assertFails(ref.collection('photo').doc('altra').set({ data: 'x' }));
    await assertFails(ref.update({ thumb: 'x'.repeat(60001) }));
    // Eliminar i desfer: regal i foto junts.
    const remove = db.batch();
    remove.delete(ref);
    remove.delete(photo);
    await assertSucceeds(remove.commit());
    const undo = db.batch();
    undo.set(ref, { ...gift, thumb: 'data:image/jpeg;base64,petita' });
    undo.set(photo, { data: 'data:image/jpeg;base64,gran' });
    await assertSucceeds(undo.commit());
  });
  test('membres', async () => {
    await assertSucceeds(home(as('anna')).collection('members').doc('anna').set({ name: 'Anna', updatedAt: 1 }));
    await assertFails(home(as('anna')).collection('members').doc('bea').set({ name: 'Bea', updatedAt: 1 }));
    await assertFails(home(as('anna')).collection('members').doc('anna').set({ name: 'x'.repeat(41), updatedAt: 1 }));
    await assertSucceeds(home(as('anna')).collection('members').doc('anna').delete());
  });
});

describe('avisos', () => {
  test('cada dispositiu desa el seu token i ningú els llegeix', async () => {
    const devices = home(as('anna')).collection('devices');
    await assertSucceeds(devices.doc('anna').set({ token: 't', name: 'Anna', updatedAt: 1 }));
    await assertFails(devices.doc('bea').set({ token: 't', name: 'Bea', updatedAt: 1 }));
    await assertFails(devices.doc('anna').get());
    await assertFails(devices.doc('anna').set({ token: 'x'.repeat(5000), name: 'Anna', updatedAt: 1 }));
  });
});

describe('comptes i finances', () => {
  test('el perfil i les finances només són del seu compte', async () => {
    const db = as('anna');
    await assertSucceeds(db.doc('users/anna').set({ name: 'Anna', home: HOME, updatedAt: 1 }, { merge: true }));
    await assertFails(as('bea').doc('users/anna').get());
    const movement = { section: 'menjar', name: 'Mercadona', amount: 1250, date: '2026-11-26', type: 'out', category: 'menjar', createdAt: 1 };
    await assertSucceeds(db.collection('users/anna/movements').add(movement));
    await assertFails(as('bea').collection('users/anna/movements').get());
    await assertFails(db.collection('users/anna/movements').add({ ...movement, amount: 12.5 }));
  });
});

describe('alexa', () => {
  const code = (uid, extra = {}) => ({ home: HOME, uid, name: 'Anna', expiresAt: Date.now() + 15 * 60 * 1000, ...extra });
  test('l\'app crea el seu codi', async () => {
    await assertSucceeds(as('anna').doc('alexaCodes/482913').set(code('anna')));
  });
  test('no es pot llegir, sobreescriure ni fer trampes amb el codi', async () => {
    await as('anna').doc('alexaCodes/482913').set(code('anna'));
    await assertFails(as('bea').doc('alexaCodes/482913').get());
    await assertFails(as('bea').doc('alexaCodes/482913').set(code('bea')));
    await assertFails(as('bea').collection('alexaCodes').get());
    await assertFails(as('bea').doc('alexaCodes/111111').set(code('anna')));
    await assertFails(as('bea').doc('alexaCodes/222222').set(code('bea', { home: 'NO-EXISTEIX' })));
    await assertFails(as('bea').doc('alexaCodes/333333').set(code('bea', { expiresAt: Date.now() + 86400000 })));
    await assertFails(as('bea').doc('alexaCodes/012345').set(code('bea')));
  });
  test('les vinculacions només les toca el servidor', async () => {
    await assertFails(as('anna').doc('alexaLinks/amzn1.ask.account.X').get());
    await assertFails(as('anna').doc('alexaLinks/amzn1.ask.account.X').set({ home: HOME }));
  });
});
