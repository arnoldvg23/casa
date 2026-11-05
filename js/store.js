import { firebaseConfig, vapidKey } from './firebase-config.js';
import { normalize } from './products.js';

// Dos backends con la misma interfaz. El local permite usar y probar la app
// sin cuenta de Firebase; el de Firebase comparte los datos entre móviles.
export const isDemo = !firebaseConfig;
export const notificationsEnabled = Boolean(vapidKey);

const SDK = 'https://www.gstatic.com/firebasejs/11.10.0';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I/L, que se confunden

export function generateHomeCode() {
  const chars = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => ALPHABET[b % ALPHABET.length]);
  return formatCode(chars.join(''));
}

function formatCode(raw) {
  return raw.match(/.{1,4}/g)?.join('-') ?? '';
}

// Acepta el código tal cual, en minúsculas, sin guiones o el enlace completo de invitación.
export function normalizeCode(input) {
  const fromLink = input.match(/llar=([^&\s]+)/);
  const raw = (fromLink ? decodeURIComponent(fromLink[1]) : input).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return formatCode(raw);
}

const historyKey = (name) => encodeURIComponent(normalize(name)).slice(0, 200);

function localBackend() {
  const keyFor = (code) => `casa.datos.${code}`;
  const read = (code) => {
    const saved = localStorage.getItem(keyFor(code));
    return saved ? JSON.parse(saved) : null;
  };

  return {
    async createHome(code) {
      localStorage.setItem(keyFor(code), JSON.stringify({ items: {}, history: {} }));
    },
    async homeExists(code) {
      return read(code) !== null;
    },
    open(code) {
      const listeners = new Set();
      const notify = () => {
        const data = read(code);
        listeners.forEach((cb) => cb({ items: Object.values(data.items), history: Object.values(data.history) }));
      };
      const mutate = (change) => {
        const data = read(code);
        change(data);
        localStorage.setItem(keyFor(code), JSON.stringify(data));
        notify();
      };
      addEventListener('storage', (event) => {
        if (event.key === keyFor(code)) notify();
      });

      return {
        subscribe(cb) {
          listeners.add(cb);
          notify();
        },
        add: (item) => mutate((d) => { const id = crypto.randomUUID(); d.items[id] = { ...item, id }; }),
        update: (id, patch) => mutate((d) => { Object.assign(d.items[id], patch); }),
        removeMany: (items) => mutate((d) => { items.forEach((i) => delete d.items[i.id]); }),
        restoreMany: (items) => mutate((d) => { items.forEach((i) => { d.items[i.id] = i; }); }),
        remember: (entry, bump = 1) => mutate((d) => {
          const key = historyKey(entry.name);
          const count = (d.history[key]?.count ?? 0) + bump;
          d.history[key] = { ...d.history[key], ...entry, count, lastAt: Date.now() };
        }),
      };
    },
  };
}

async function firebaseBackend() {
  const [{ initializeApp }, authSdk, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);

  const app = initializeApp(firebaseConfig);
  const auth = authSdk.getAuth(app);
  await auth.authStateReady();
  if (!auth.currentUser) await authSdk.signInAnonymously(auth);

  // La caché persistente es lo que hace que la lista funcione sin cobertura:
  // lee del dispositivo y envía los cambios al recuperar la conexión.
  const db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });
  const homeRef = (code) => fs.doc(db, 'households', code);

  // Sin conexión, una escritura no se resuelve hasta volver a tener red, así
  // que estos métodos no se esperan: solo se registra si el servidor la rechaza.
  const report = (promise) => promise.catch((error) => console.error('Firestore', error));

  return {
    async createHome(code) {
      await fs.setDoc(homeRef(code), { createdAt: Date.now() });
    },
    async homeExists(code) {
      return (await fs.getDoc(homeRef(code))).exists();
    },
    // Cada instal·lació té el seu usuari anònim, així que l'uid identifica el
    // dispositiu i el servidor pot saltar-se el de qui ha afegit el producte.
    async enableNotifications(code, name) {
      const { getMessaging, getToken } = await import(`${SDK}/firebase-messaging.js`);
      const token = await getToken(getMessaging(app), {
        vapidKey,
        serviceWorkerRegistration: await navigator.serviceWorker.ready,
      });
      await fs.setDoc(fs.doc(homeRef(code), 'devices', auth.currentUser.uid), { token, name, updatedAt: Date.now() });
    },
    open(code) {
      const items = fs.collection(homeRef(code), 'items');
      const history = fs.collection(homeRef(code), 'history');

      return {
        subscribe(cb) {
          const state = { items: [], history: [] };
          const docs = (snapshot) => snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
          fs.onSnapshot(items, (snapshot) => { state.items = docs(snapshot); cb({ ...state }); }, console.error);
          fs.onSnapshot(history, (snapshot) => { state.history = docs(snapshot); cb({ ...state }); }, console.error);
        },
        add: (item) => report(fs.addDoc(items, { ...item, uid: auth.currentUser.uid })),
        update: (id, patch) => report(fs.updateDoc(fs.doc(items, id), patch)),
        removeMany(list) {
          const batch = fs.writeBatch(db);
          list.forEach((i) => batch.delete(fs.doc(items, i.id)));
          report(batch.commit());
        },
        restoreMany(list) {
          const batch = fs.writeBatch(db);
          // `restored` evita que desfer un esborrat avisi la família com si fos nou.
          list.forEach(({ id, ...item }) => batch.set(fs.doc(items, id), { ...item, restored: true }));
          report(batch.commit());
        },
        remember: (entry, bump = 1) => report(fs.setDoc(
          fs.doc(history, historyKey(entry.name)),
          { ...entry, count: fs.increment(bump), lastAt: Date.now() },
          { merge: true },
        )),
      };
    },
  };
}

export const connect = () => (isDemo ? Promise.resolve(localBackend()) : firebaseBackend());
