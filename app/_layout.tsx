// app/_layout.tsx
import { router, Stack, useSegments } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { clearSession, getSession, UserSession } from "../services/auth";

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

  // Load session on mount
  useEffect(() => {
    (async () => {
      const session = await getSession();
      setUser(session);
      setLoading(false);
    })();
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "login";

    if (!user && !inAuthGroup) {
      // No session → go to login
      router.replace("/login");
    } else if (user && inAuthGroup) {
      // Has session → go to main app
      router.replace("/(tabs)");
    }
  }, [user, segments, loading]);

  if (loading) {
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
