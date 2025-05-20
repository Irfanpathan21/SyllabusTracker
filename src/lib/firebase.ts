
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCz6EMzfEupwqpgmd3da-TlTdEnaBlqNnY",
  authDomain: "syllabuspilot.firebaseapp.com",
  projectId: "syllabuspilot",
  storageBucket: "syllabuspilot.firebasestorage.app",
  messagingSenderId: "321482121241",
  appId: "1:321482121241:web:26c6f7af897dac6aa84a88"
  // measurementId is optional
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

auth = getAuth(app);
db = getFirestore(app);

export { app, auth, db };
