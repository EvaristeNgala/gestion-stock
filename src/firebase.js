import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAgjR7oYPqmJ6vTWxVnPJHVy7m7sLnGTMY",
  authDomain: "magasin-dashboard-50b37.firebaseapp.com",
  projectId: "magasin-dashboard-50b37",
  storageBucket: "magasin-dashboard-50b37.firebasestorage.app",
  messagingSenderId: "952488740971",
  appId: "1:952488740971:web:7fa29b32df8798ecaa492e",
  measurementId: "G-J5EMV8ZPYV"
};

// Initialisation Firebase
const app = initializeApp(firebaseConfig);

// Analytics
const analytics = getAnalytics(app);

// Firestore
const db = getFirestore(app);

// Storage
const storage = getStorage(app);

export { app, analytics, db, storage };