// app/_layout.tsx
import { router, Stack, useSegments } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { clearSession, getSession, saveSession, UserSession } from "../services/auth";
import { auth } from "../services/firebase";

// ─── Auth Context ────────────────────────────────────────────────────────────
interface AuthContextType {
  user: UserSession | null;
  setUser: (user: UserSession | null) => void;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => { },
  signOut: async () => { },
  refreshUser: async () => { },
});

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Root Layout ─────────────────────────────────────────────────────────────
export default function RootLayout() {
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

  // Load session on mount and sync with Firebase
  useEffect(() => {
    let isFirstAuthEvent = true;

    // 1. Cargar desde AsyncStorage para velocidad inicial
    (async () => {
      const session = await getSession();
      if (session) setUser(session);
      // No seteamos loading = false aquí aún, esperamos a Firebase
    })();

    // 2. Escuchar cambios en Firebase Auth para mantener sincronía real
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: any) => {
      console.log("Firebase Auth State Changed:", fbUser?.uid || "No user");

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
        setIsAuthReady(true);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (loading || !isAuthReady) return;

    const inAuthGroup = segments[0] === "login";

    if (!user && !inAuthGroup) {
      router.replace("/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, segments, loading, isAuthReady]);

  if (loading || !isAuthReady) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0F1117", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, signOut, refreshUser }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
    </AuthContext.Provider>
  );
}
