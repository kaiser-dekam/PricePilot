import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";

// Support both naming conventions for environment variables (prioritize Vite_ format)
const firebaseApiKey = import.meta.env.VITE_Firebase_API_Key || import.meta.env.VITE_FIREBASE_API_KEY;
const firebaseProjectId = import.meta.env.VITE_Firebase_Project_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID;
const firebaseAppId = import.meta.env.VITE_Firebase_App_ID || import.meta.env.VITE_FIREBASE_APP_ID;

// Debug logging to help with Render deployment
console.log('Firebase environment variables check:', {
  hasViteFirebaseFormat: !!import.meta.env.VITE_Firebase_API_Key,
  hasStandardFormat: !!import.meta.env.VITE_FIREBASE_API_KEY,
  finalApiKey: !!firebaseApiKey,
  finalProjectId: !!firebaseProjectId,
  finalAppId: !!firebaseAppId
});

if (!firebaseApiKey || !firebaseProjectId || !firebaseAppId) {
  console.error('Missing Firebase configuration:', {
    apiKey: !!firebaseApiKey,
    projectId: !!firebaseProjectId,
    appId: !!firebaseAppId
  });
  throw new Error('Missing required Firebase configuration. Please set VITE_Firebase_* or VITE_FIREBASE_* environment variables.');
}

const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: `${firebaseProjectId}.firebaseapp.com`,
  projectId: firebaseProjectId,
  storageBucket: `${firebaseProjectId}.firebasestorage.app`,
  appId: firebaseAppId,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("Error signing in with email:", error);
    throw error;
  }
};

export const signUpWithEmail = async (email: string, password: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("Error signing up with email:", error);
    throw error;
  }
};

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};