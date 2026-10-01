import { initializeApp } from "firebase/app";

import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";


// ==============================
// CONFIGURATION FIREBASE
// ==============================

const firebaseConfig = {
  apiKey: "AIzaSyAgjR7oYPqmJ6vTWxVnPJHVy7m7sLnGTMY",

  authDomain: "magasin-dashboard-50b37.firebaseapp.com",

  projectId: "magasin-dashboard-50b37",

  storageBucket: "magasin-dashboard-50b37.firebasestorage.app",

  messagingSenderId: "952488740971",

  appId: "1:952488740971:web:7fa29b32df8798ecaa492e",

  measurementId: "G-J5EMV8ZPYV",
};


// ==============================
// INITIALISATION FIREBASE
// ==============================

const app = initializeApp(firebaseConfig);


// ==============================
// FIRESTORE + MODE HORS CONNEXION
// ==============================

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});


// ==============================
// STORAGE
// ==============================

const storage = getStorage(app);


// ==============================
// AUTHENTIFICATION
// ==============================

const auth = getAuth(app);


// ==============================
// EXPORTS
// ==============================

export {
  app,
  db,
  storage,
  auth,
};