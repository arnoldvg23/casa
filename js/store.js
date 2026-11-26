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

// En mode de prova cada navegador fa de membre diferent, com l'usuari anònim de Firebase.
function localUid() {
  let uid = localStorage.getItem('casa.uid');
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem('casa.uid', uid);
  }
  return uid;
}

// Comptes del mode de prova: imiten Firebase (crear el compte conserva l'uid
// del dispositiu; entrar-hi el substitueix pel del compte).
function localAccounts() {
  const KEY = 'casa.comptes';
  const all = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');
  const save = (data) => localStorage.setItem(KEY, JSON.stringify(data));
  const fail = (code) => { throw Object.assign(new Error(code), { code }); };
  // Ni en mode de prova es desa la contrasenya: només un hash amb sal.
  const hash = async (password, salt) => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
    return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const findByUid = (uid) => Object.entries(all()).find(([, a]) => a.uid === uid);

  return {
    current() {
      const found = findByUid(localUid());
      return found ? { email: found[0], anonymous: false } : { email: null, anonymous: true };
    },
    async create(email, password, profile) {
      const accounts = all();
      if (accounts[email]) fail('auth/email-already-in-use');
      if (password.length < 6) fail('auth/weak-password');
      const salt = crypto.randomUUID();
      accounts[email] = { salt, hash: await hash(password, salt), uid: localUid(), profile };
      save(accounts);
    },
    async signIn(email, password) {
      const account = all()[email];
      if (!account || account.hash !== await hash(password, account.salt)) fail('auth/invalid-credential');
      localStorage.setItem('casa.uid', account.uid);
      return account.profile ?? null;
    },
    remember(profile) {
      const found = findByUid(localUid());
      if (!found) return;
      const accounts = all();
      accounts[found[0]].profile = profile;
      save(accounts);
    },
    async signOut() {
      localStorage.removeItem('casa.uid');
    },
    async resetPassword() {},
  };
}

function localBackend() {
  const keyFor = (code) => `casa.datos.${code}`;
  const read = (code) => {
    const saved = localStorage.getItem(keyFor(code));
    return saved ? JSON.parse(saved) : null;
  };

  return {
    account: localAccounts(),
    // En mode de prova no hi ha res pendent d'enviar ni cap caché a esborrar.
    hasPendingWrites: async () => false,
    forgetDevice: async () => {},
    async createHome(code) {
      localStorage.setItem(keyFor(code), JSON.stringify({ items: {}, history: {}, wishes: {}, gifts: {}, members: {} }));
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
      // Les llars creades abans de la llista per a casa no tenen `wishes`.
      const wishListeners = new Set();
      const notifyWishes = () => {
        const wishes = Object.values(read(code).wishes ?? {});
        wishListeners.forEach((cb) => cb(wishes));
      };
      const mutateWishes = (change) => {
        const data = read(code);
        data.wishes ??= {};
        change(data.wishes);
        localStorage.setItem(keyFor(code), JSON.stringify(data));
        notifyWishes();
      };
      // Igual que `wishes`: les llars anteriors a Nadal no tenen `gifts` ni `members`.
      const uid = localUid();
      const giftListeners = new Set();
      const notifyGifts = () => {
        const data = read(code);
        const state = { gifts: Object.values(data.gifts ?? {}), members: Object.values(data.members ?? {}) };
        giftListeners.forEach((cb) => cb(state));
      };
      const mutateGifts = (change) => {
        const data = read(code);
        data.gifts ??= {};
        data.members ??= {};
        change(data);
        localStorage.setItem(keyFor(code), JSON.stringify(data));
        notifyGifts();
      };
      const onStorage = (event) => {
        if (event.key !== keyFor(code)) return;
        notify();
        notifyWishes();
        notifyGifts();
      };
      addEventListener('storage', onStorage);
      // Cada subscribe torna la funció que el cancel·la, com onSnapshot.
      const listen = (set, cb, first) => {
        set.add(cb);
        first();
        return () => set.delete(cb);
      };

      // Finances: fora de la llar i per uid, com a Firebase.
      const financeKey = () => `casa.finances.${localUid()}`;
      const financeListeners = new Set();
      const readFinances = () => JSON.parse(localStorage.getItem(financeKey()) ?? '{}');
      const notifyFinances = () => {
        const all = Object.values(readFinances());
        financeListeners.forEach((cb) => cb(all));
      };
      const mutateFinances = (change) => {
        const data = readFinances();
        change(data);
        localStorage.setItem(financeKey(), JSON.stringify(data));
        notifyFinances();
      };

      return {
        finances: {
          subscribe: (cb) => listen(financeListeners, cb, notifyFinances),
          add: (m) => mutateFinances((d) => { const id = crypto.randomUUID(); d[id] = { ...m, id }; }),
          update: (id, patch) => mutateFinances((d) => { Object.assign(d[id], patch); }),
          remove: (m) => mutateFinances((d) => { delete d[m.id]; }),
          restore: (m) => mutateFinances((d) => { d[m.id] = m; }),
        },
        gifts: {
          uid,
          subscribe: (cb) => listen(giftListeners, cb, notifyGifts),
          join: (name) => mutateGifts((d) => { d.members[uid] = { id: uid, name, updatedAt: Date.now() }; }),
          add: (gift) => mutateGifts((d) => { const id = crypto.randomUUID(); d.gifts[id] = { ...gift, uid, id }; }),
          // La foto gran va a part (`photos`), com al document photo/full de Firebase.
          loadPhoto: async (id) => read(code).photos?.[id] ?? '',
          update: (id, patch, full) => mutateGifts((d) => {
            Object.assign(d.gifts[id], patch);
            if (full === undefined) return;
            delete d.gifts[id].photo;
            d.photos ??= {};
            if (full) d.photos[id] = full;
            else delete d.photos[id];
          }),
          async remove(gift) {
            const full = read(code).photos?.[gift.id];
            mutateGifts((d) => { delete d.gifts[gift.id]; delete d.photos?.[gift.id]; });
            return () => mutateGifts((d) => {
              d.gifts[gift.id] = gift;
              if (full) (d.photos ??= {})[gift.id] = full;
            });
          },
        },
        wishes: {
          subscribe: (cb) => listen(wishListeners, cb, notifyWishes),
          add: (wish) => mutateWishes((ws) => { const id = crypto.randomUUID(); ws[id] = { ...wish, id }; }),
          update: (id, patch) => mutateWishes((ws) => { Object.assign(ws[id], patch); }),
          removeMany: (list) => mutateWishes((ws) => { list.forEach((w) => delete ws[w.id]); }),
          restoreMany: (list) => mutateWishes((ws) => { list.forEach((w) => { ws[w.id] = w; }); }),
        },
        subscribe: (cb) => listen(listeners, cb, notify),
        close() {
          removeEventListener('storage', onStorage);
          [listeners, wishListeners, giftListeners, financeListeners].forEach((set) => set.clear());
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
  // Perfil del compte (nom i llar): és el que permet tornar a entrar des d'un
  // altre mòbil. Les regles només deixen llegir-lo i escriure'l al seu uid.
  const userRef = (uid) => fs.doc(db, 'users', uid);

  // Sin conexión, una escritura no se resuelve hasta volver a tener red, así
  // que estos métodos no se esperan: solo se registra si el servidor la rechaza.
  const report = (promise) => promise.catch((error) => console.error('Firestore', error));

  // La caché persistent guarda a IndexedDB tot el que s'ha llegit, finances
  // incloses: en sortir s'ha d'esborrar perquè no quedi al mòbil. Després
  // d'això la base de dades queda tancada i cal recarregar la pàgina.
  async function wipeCache() {
    await fs.terminate(db);
    await fs.clearIndexedDbPersistence(db);
  }
  // Sense connexió, les escriptures esperen a la caché. Torna true si després
  // d'uns segons encara n'hi ha de pendents (sortir ara les perdria).
  const hasPendingWrites = () => Promise.race([
    fs.waitForPendingWrites(db).then(() => false),
    new Promise((resolve) => { setTimeout(() => resolve(true), 5000); }),
  ]);

  auth.languageCode = 'ca';
  const account = {
    current() {
      const user = auth.currentUser;
      return { email: user?.email ?? null, anonymous: !user || user.isAnonymous };
    },
    // Converteix l'usuari anònim d'aquest mòbil en un compte amb correu: l'uid
    // no canvia, així que tot el que ja havia afegit continua sent seu.
    async create(email, password, profile) {
      const credential = authSdk.EmailAuthProvider.credential(email, password);
      await authSdk.linkWithCredential(auth.currentUser, credential);
      await fs.setDoc(userRef(auth.currentUser.uid), { ...profile, updatedAt: Date.now() });
    },
    // Entrar en un compte substitueix l'usuari anònim d'aquest mòbil.
    // Si aquell anònim ja s'havia apuntat a Nadal, se'n treu la secció buida.
    async signIn(email, password, homeToLeave) {
      const previous = auth.currentUser;
      if (previous?.isAnonymous && homeToLeave) {
        await fs.deleteDoc(fs.doc(homeRef(homeToLeave), 'members', previous.uid)).catch(() => {});
      }
      const { user } = await authSdk.signInWithEmailAndPassword(auth, email, password);
      const saved = await fs.getDoc(userRef(user.uid));
      return saved.exists() ? saved.data() : null;
    },
    remember(profile) {
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        report(fs.setDoc(userRef(auth.currentUser.uid), { ...profile, updatedAt: Date.now() }, { merge: true }));
      }
    },
    async signOut() {
      try {
        await wipeCache();
      } finally {
        await authSdk.signOut(auth);
      }
    },
    resetPassword: (email) => authSdk.sendPasswordResetEmail(auth, email),
  };

  return {
    account,
    hasPendingWrites,
    forgetDevice: wipeCache,
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
      // Col·lecció pròpia: la llista per a casa mai toca les dades de la compra.
      const wishes = fs.collection(homeRef(code), 'wishes');
      // Nadal també té col·leccions pròpies. Cada regal porta l'uid de qui l'ha
      // afegit i les regles només deixen que aquest uid el canviï o l'esborri.
      const gifts = fs.collection(homeRef(code), 'gifts');
      const members = fs.collection(homeRef(code), 'members');
      // La foto gran de cada regal, a part perquè la llista no la descarregui.
      const photoRef = (id) => fs.doc(gifts, id, 'photo', 'full');
      const loadPhoto = async (id) => {
        try {
          const snapshot = await fs.getDoc(photoRef(id));
          return snapshot.exists() ? snapshot.get('data') : '';
        } catch {
          return ''; // sense connexió i sense haver-la vista abans
        }
      };
      const uid = auth.currentUser.uid;
      // Finances personals: sota el compte, no sota la llar. Ningú més les pot llegir.
      const movements = fs.collection(userRef(uid), 'movements');

      // Totes les escoltes obertes, per poder-les tancar amb close().
      const open = new Set();
      const listen = (query, onNext) => {
        const stop = fs.onSnapshot(query, onNext, console.error);
        open.add(stop);
        return () => { stop(); open.delete(stop); };
      };
      const both = (a, b) => () => { a(); b(); };

      return {
        close() {
          open.forEach((stop) => stop());
          open.clear();
        },
        finances: {
          subscribe: (cb) => listen(movements, (snapshot) => cb(snapshot.docs.map((d) => ({ ...d.data(), id: d.id })))),
          add: (m) => report(fs.addDoc(movements, m)),
          update: (id, patch) => report(fs.updateDoc(fs.doc(movements, id), patch)),
          remove: (m) => report(fs.deleteDoc(fs.doc(movements, m.id))),
          restore: ({ id, ...m }) => report(fs.setDoc(fs.doc(movements, id), m)),
        },
        gifts: {
          uid,
          subscribe(cb) {
            const state = { gifts: [], members: [] };
            const docs = (snapshot) => snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
            return both(
              listen(gifts, (snapshot) => { state.gifts = docs(snapshot); cb({ ...state }); }),
              listen(members, (snapshot) => { state.members = docs(snapshot); cb({ ...state }); }),
            );
          },
          // Així cada membre té la seva secció encara que no hagi afegit res.
          join: (name) => report(fs.setDoc(fs.doc(members, uid), { name, updatedAt: Date.now() })),
          add: (gift) => report(fs.addDoc(gifts, { ...gift, uid })),
          loadPhoto,
          // `full`: undefined si la foto no canvia, '' per treure-la o la foto gran nova.
          update(id, patch, full) {
            if (full === undefined) {
              report(fs.updateDoc(fs.doc(gifts, id), patch));
              return;
            }
            const batch = fs.writeBatch(db);
            batch.update(fs.doc(gifts, id), { ...patch, photo: fs.deleteField() });
            if (full) batch.set(photoRef(id), { data: full });
            else batch.delete(photoRef(id));
            report(batch.commit());
          },
          // Torna la funció de «Desfés»: per això es guarda abans la foto gran.
          async remove({ id, ...gift }) {
            const full = gift.thumb ? await loadPhoto(id) : '';
            const batch = fs.writeBatch(db);
            batch.delete(fs.doc(gifts, id));
            if (gift.thumb) batch.delete(photoRef(id));
            report(batch.commit());
            return () => {
              const undo = fs.writeBatch(db);
              undo.set(fs.doc(gifts, id), gift);
              if (full) undo.set(photoRef(id), { data: full });
              report(undo.commit());
            };
          },
        },
        wishes: {
          subscribe: (cb) => listen(wishes, (snapshot) => cb(snapshot.docs.map((d) => ({ ...d.data(), id: d.id })))),
          add: (wish) => report(fs.addDoc(wishes, { ...wish, uid: auth.currentUser.uid })),
          update: (id, patch) => report(fs.updateDoc(fs.doc(wishes, id), patch)),
          removeMany(list) {
            const batch = fs.writeBatch(db);
            list.forEach((w) => batch.delete(fs.doc(wishes, w.id)));
            report(batch.commit());
          },
          restoreMany(list) {
            const batch = fs.writeBatch(db);
            list.forEach(({ id, ...wish }) => batch.set(fs.doc(wishes, id), wish));
            report(batch.commit());
          },
        },
        subscribe(cb) {
          const state = { items: [], history: [] };
          const docs = (snapshot) => snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
          return both(
            listen(items, (snapshot) => { state.items = docs(snapshot); cb({ ...state }); }),
            listen(history, (snapshot) => { state.history = docs(snapshot); cb({ ...state }); }),
          );
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
