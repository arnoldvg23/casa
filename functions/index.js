const { initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { SkillRequestSignatureVerifier, TimestampVerifier } = require('ask-sdk-express-adapter');
const { createSkill } = require('./alexa');

initializeApp();

const DAY_IN_SECONDS = '86400';
const EXPIRED_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

// Avisa la resta de la família quan entra un producte nou a la llista. Com que
// salta amb l'escriptura, també funciona amb el que s'ha afegit sense cobertura.
exports.notifyNewItem = onDocumentCreated(
  { document: 'households/{home}/items/{item}', region: 'europe-west1' },
  async (event) => {
    const item = event.data?.data();
    if (!item || item.restored) return;

    const devices = await getFirestore().collection(`households/${event.params.home}/devices`).get();
    const others = devices.docs.filter((device) => device.id !== item.uid);
    if (!others.length) return;

    const { responses } = await getMessaging().sendEach(others.map((device) => ({
      token: device.get('token'),
      data: { title: 'Llista de la compra', body: `${item.addedBy} ha afegit ${item.name}` },
      webpush: { headers: { Urgency: 'high', TTL: DAY_IN_SECONDS } },
    })));

    await Promise.all(others
      .filter((_, index) => EXPIRED_TOKEN_ERRORS.has(responses[index].error?.code))
      .map((device) => device.ref.delete()));
  },
);

// Alexa crida aquesta adreça. Només s'accepten peticions signades per Amazon i,
// si ALEXA_SKILL_ID és a functions/.env, només les de la nostra skill.
const signatureVerifier = new SkillRequestSignatureVerifier();
const timestampVerifier = new TimestampVerifier();
let skill;

function firestoreRepo(db) {
  const home = (code) => db.collection('households').doc(code);
  const historyKey = (normalize, name) => encodeURIComponent(normalize(name)).slice(0, 200);
  return (normalize) => ({
    getLink: async (userId) => (await db.collection('alexaLinks').doc(userId).get()).data() ?? null,
    setLink: (userId, link) => db.collection('alexaLinks').doc(userId).set(link),
    deleteLink: (userId) => db.collection('alexaLinks').doc(userId).delete(),
    // Cada codi serveix una sola vegada.
    takeCode: (code) => db.runTransaction(async (tx) => {
      const ref = db.collection('alexaCodes').doc(code);
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      tx.delete(ref);
      return snap.data();
    }),
    listItems: async (code) => (await home(code).collection('items').get()).docs.map((d) => ({ id: d.id, ...d.data() })),
    listHistory: async (code) => (await home(code).collection('history').get()).docs.map((d) => d.data()),
    addItem: (code, item) => home(code).collection('items').add(item),
    updateItem: (code, id, patch) => home(code).collection('items').doc(id).update(patch),
    remember: (code, entry) => home(code).collection('history').doc(historyKey(normalize, entry.name)).set(
      { ...entry, count: FieldValue.increment(1), lastAt: Date.now() },
      { merge: true },
    ),
  });
}

async function loadSkill() {
  if (!skill) {
    // El catàleg i els hàbits són els mateixos mòduls que fa servir l'app (els copia el predeploy).
    const products = await import('./shared/products.js');
    const habits = await import('./shared/habits.js');
    const repo = firestoreRepo(getFirestore())(products.normalize);
    skill = createSkill({ repo, shared: { products, habits } });
  }
  return skill;
}

exports.alexa = onRequest({ region: 'europe-west1', maxInstances: 2, invoker: 'public' }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Only POST');
    return;
  }
  const raw = req.rawBody?.toString('utf8') ?? '';
  try {
    await signatureVerifier.verify(raw, req.headers);
    await timestampVerifier.verify(raw);
  } catch (error) {
    console.warn('Petició d\'Alexa rebutjada:', error.message);
    res.status(400).send('Bad request');
    return;
  }
  const body = JSON.parse(raw);
  const expected = process.env.ALEXA_SKILL_ID;
  const applicationId = body.context?.System?.application?.applicationId ?? body.session?.application?.applicationId;
  if (expected && applicationId !== expected) {
    res.status(403).send('Wrong skill');
    return;
  }
  try {
    res.json(await (await loadSkill())(body));
  } catch (error) {
    console.error(error);
    res.json({ version: '1.0', response: { outputSpeech: { type: 'PlainText', text: 'Algo ha fallado al hablar con Casa. Vuelve a intentarlo.' }, shouldEndSession: true } });
  }
});
