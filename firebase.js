// study extraordinary — Firebase setup
// Firebase web config is not a server secret. Protect data with Firestore Security Rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAdwhrgpMnyTnqWCfNaoBhykLkLtRFmdcQ",
  authDomain: "study-extraordinary.firebaseapp.com",
  projectId: "study-extraordinary",
  storageBucket: "study-extraordinary.firebasestorage.app",
  messagingSenderId: "196907742951",
  appId: "1:196907742951:web:eaa8b77381f942931a5442"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
