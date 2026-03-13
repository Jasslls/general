import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { router, useSegments } from "expo-router";
import { auth } from "../services/firebase";
import { clearSession, getSession, saveSession, UserSession } from "../services/auth";
import { syncBusinessIntelligence } from "../services/sync";
import { getClients, getAllInvoices } from "../services/firestore";
import { checkAndNotifyUrgentInvoices } from "../services/notifications";

interface AuthContextType {
    user: UserSession | null;
    setUser: (user: UserSession | null) => void;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
    isAuthReady: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    setUser: () => {},
    signOut: async () => {},
    refreshUser: async () => {},
    isAuthReady: false,
    loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const segments = useSegments();

    async function refreshUser() {
        const session = await getSession();
        setUser(session);
    }

    async function signOut() {
        await clearSession();
        setUser(null);
        router.replace("/login");
    }

    useEffect(() => {
        let isFirstAuthEvent = true;

        const unsubscribe = onAuthStateChanged(auth, async (fbUser: any) => {
            if (!fbUser) {
                await clearSession();
                setUser(null);
            } else {
                const session = await getSession();
                if (!session || session.id !== fbUser.uid) {
                    const newSession = {
                        id: fbUser.uid,
                        name: fbUser.displayName || "Usuario",
                        email: fbUser.email || "",
                        photo: fbUser.photoURL || null,
                    };
                    await saveSession(newSession);
                    setUser(newSession);
                }
            }

            if (isFirstAuthEvent) {
                isFirstAuthEvent = false;
                if (fbUser) {
                    syncBusinessIntelligence(fbUser.uid).then(async () => {
                        const clients = await getClients(fbUser.uid);
                        const invoices = await getAllInvoices(fbUser.uid);
                        checkAndNotifyUrgentInvoices(invoices, clients);
                    }).catch(console.error);
                }
                setIsAuthReady(true);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Effect for redirection
    useEffect(() => {
        if (loading || !isAuthReady) return;
        const inAuthGroup = segments[0] === "login";
        if (!user && !inAuthGroup) {
            router.replace("/login");
        } else if (user && inAuthGroup) {
            router.replace("/(tabs)");
        }
    }, [user, segments, loading, isAuthReady]);

    return (
        <AuthContext.Provider value={{ user, setUser, signOut, refreshUser, isAuthReady, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
