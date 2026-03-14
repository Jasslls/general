// services/auth.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export interface BusinessSettings {
    currency: string;
    lateFeePercentage: number;
    graceDays: number;
    theme?: 'light' | 'dark' | 'system';
    viewMode?: 'normal' | 'compact';
}

export interface UserSession {
    id: string;
    name: string;
    email: string;
    photo: string | null;
    phone?: string;
    settings?: BusinessSettings;
}

const SESSION_KEY = "user_session_v1";

/**
 * Verifica si existe el documento users/{uid}. Si no existe, lo crea.
 */
export async function ensureUserDocument(user: UserSession): Promise<void> {
    const userRef = doc(db, "users", user.id);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        const defaultSettings: BusinessSettings = {
            currency: 'L',
            lateFeePercentage: 0,
            graceDays: 0,
            theme: 'system',
            viewMode: 'normal',
        };
        await setDoc(userRef, {
            name: user.name,
            email: user.email,
            phone: user.phone || "",
            createdAt: serverTimestamp(),
            settings: defaultSettings,
        });
        user.settings = defaultSettings;
    } else {
        const data = snap.data();
        if (data) {
            if (data.phone) user.phone = data.phone;
            if (data.settings) user.settings = data.settings as BusinessSettings;
        }
    }
}

export async function updateAuthDisplayName(name: string): Promise<void> {
    if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
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
