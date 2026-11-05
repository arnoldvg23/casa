const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

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
