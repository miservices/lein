// Central Firebase init. Every other module imports { db } from here —
// this is the ONLY file that should ever contain the firebaseConfig object.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAuIMKMroru-b3pHXeApmLYmlh-3qj9r9Y",
  authDomain: "lein-28dc4.firebaseapp.com",
  projectId: "lein-28dc4",
  storageBucket: "lein-28dc4.firebasestorage.app",
  messagingSenderId: "316724868753",
  appId: "1:316724868753:web:42963c6c17c8aa74f8f130",
  measurementId: "G-E5CDBYDV63"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);