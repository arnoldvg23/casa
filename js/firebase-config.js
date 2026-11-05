// Mentre això sigui null l'app funciona en mode de prova: les dades només es
// desen en aquest dispositiu. Enganxa aquí l'objecte que dona la consola de
// Firebase per compartir la llista. Aquests valors no són secrets: el que
// protegeix les dades és firestore.rules i el codi de la llar.
export const firebaseConfig = {
  apiKey: 'AIzaSyBc6kaIFOemuAbdvschNGjg4O8wpkhoTxU',
  authDomain: 'casa-9522a.firebaseapp.com',
  projectId: 'casa-9522a',
  storageBucket: 'casa-9522a.firebasestorage.app',
  messagingSenderId: '722906781748',
  appId: '1:722906781748:web:c8d05e5edc9612cfddd261',
};

// Clau pública per a les notificacions.
// Consola de Firebase → Cloud Messaging → Certificats push web.
export const vapidKey = null;
