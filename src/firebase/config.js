import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace with your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCnlyqpwhrCBiJuwPOQrBL4s7c8NLJWZEU",
  authDomain: "padhobc2.firebaseapp.com",
  projectId: "padhobc2",
  storageBucket: "padhobc2.firebasestorage.app",
  messagingSenderId: "602338597088",
  appId: "1:602338597088:web:f178db5b6bb777bfac9885"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

// Set persistence to LOCAL (browser localStorage) by default
// This ensures users stay logged in even after closing the browser
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Error setting persistence:', error);
});

export default app;
