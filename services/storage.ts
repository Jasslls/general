import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getItem<T>(key: string, fallback: T): Promise<T> {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

// ✅ Retorna null si la key no existe (diferente a [])
export async function getItemNullable<T>(key: string): Promise<T | null> {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
}
