
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// 1. Import the specific Auth functions
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
// 2. Import the storage library
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  // --- PASTE YOUR KEYS HERE ---
  apiKey: "AIzaSyCQXWztaNebkqytjlMJNJHwTIu47igzcxg",

  authDomain: "aggiedine.firebaseapp.com",

  projectId: "aggiedine",

  storageBucket: "aggiedine.firebasestorage.app",

  messagingSenderId: "482275946132",

  appId: "1:482275946132:web:0fe2342c27537f4be50e81",

  measurementId: "G-DXR2Q2SM9C"
};

// 3. Initialize App
const app = initializeApp(firebaseConfig);

// 4. FORCE Firebase to use React Native storage (Fixes the Error)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);

export { auth, db };

