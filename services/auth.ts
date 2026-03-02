// services/auth.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UserSession {
    id: string;
    name: string;
    email: string;
    photo: string | null;
}

const SESSION_KEY = "user_session_v1";

export async function saveSession(user: UserSession): Promise<void> {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
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
