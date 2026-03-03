// services/auth.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface UserSession {
    id: string;
    name: string;
    email: string;
    photo: string | null;
}

const SESSION_KEY = "user_session_v1";

/**
 * Verifica si existe el documento users/{uid}. Si no existe, lo crea.
 */
export async function ensureUserDocument(user: UserSession): Promise<void> {
    const userRef = doc(db, "users", user.id);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, {
            name: user.name,
            email: user.email,
            createdAt: serverTimestamp(),
        });
    }
}

export async function saveSession(user: UserSession): Promise<void> {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
    await ensureUserDocument(user);
}

export async function getSession(): Promise<UserSession | null> {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as UserSession;
    } catch {
        return null;
    }
}

export async function clearSession(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
}
