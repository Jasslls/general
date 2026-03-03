// services/firebase.ts
import { initializeApp } from "firebase/app";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithCredential,
    signOut,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCobgv9hPviWWJF6OJig00mJzXU4vhtnhs",
    authDomain: "pagofijo-64c8f.firebaseapp.com",
    projectId: "pagofijo-64c8f",
    storageBucket: "pagofijo-64c8f.firebasestorage.app",
    messagingSenderId: "575779505449",
    appId: "1:575779505449:web:80b40df1de547caf53a338",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Sign in to Firebase using a Google id_token obtained via expo-auth-session.
 */
export async function signInWithGoogleToken(idToken: string) {
    const credential = GoogleAuthProvider.credential(idToken);
    return signInWithCredential(auth, credential);
}

export async function signOutFirebase() {
    return signOut(auth);
}
