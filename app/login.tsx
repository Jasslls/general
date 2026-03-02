// app/login.tsx
//
// Google Sign-In for Expo Go SDK 54 — NO proxy, NO Firebase handler.
//
// Flow (PKCE):
//   1. useAuthRequest builds a Google OAuth URL with code_challenge (PKCE)
//   2. promptAsync() opens ASWebAuthenticationSession (iOS) / Chrome Custom Tab (Android)
//      which listens for the reverse-client-ID redirect scheme — no registration needed.
//   3. Google redirects to com.googleusercontent.apps.XXX:/oauth2redirect?code=...
//   4. We exchange the code for tokens (no client_secret needed for native clients + PKCE)
//   5. Use the id_token to sign into Firebase → save session → navigate.

import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { saveSession } from "../services/auth";
import { signInWithGoogleToken } from "../services/firebase";
import { useAuth } from "./_layout";

// Allows expo-web-browser to complete auth sessions on reload
WebBrowser.maybeCompleteAuthSession();

// ─── Client IDs  ─────────────────────────────────────────────────────────────
// Use the NATIVE (iOS/Android) client IDs — Web client ID does NOT work here.
const IOS_CLIENT_ID =
    "575779505449-48924ju5hjqpocuisj71l4u7crndlelu.apps.googleusercontent.com";
const ANDROID_CLIENT_ID =
    "575779505449-ov75p3nu9frkdmnc6c59of92qhif596n.apps.googleusercontent.com";

// Google OIDC discovery document
const DISCOVERY = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
};

function getClientId() {
    return Platform.OS === "ios" ? IOS_CLIENT_ID : ANDROID_CLIENT_ID;
}

function getReverseClientId() {
    // Reverse of the client ID = the iOS/Android redirect URI scheme Google accepts
    const id = getClientId().replace(".apps.googleusercontent.com", "");
    return `com.googleusercontent.apps.${id}`;
}

// ─── Google Logo mark ────────────────────────────────────────────────────────
function GoogleLogo() {
    return (
        <View style={gLogo.wrapper}>
            <Text style={gLogo.g}>G</Text>
        </View>
    );
}
const gLogo = StyleSheet.create({
    wrapper: {
        width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff",
        alignItems: "center", justifyContent: "center", marginRight: 12,
    },
    g: { fontSize: 15, fontWeight: "800", color: "#4285F4" },
});

export default function LoginScreen() {
    const { setUser } = useAuth();
    const [loading, setLoading] = useState(false);

    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(40)).current;
    const pulseAnim = React.useRef(new Animated.Value(1)).current;
    const btnScale = React.useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const clientId = getClientId();
    const reverseId = getReverseClientId();
    const redirectUri = `${reverseId}:/oauth2redirect`;

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
            clientId,
            scopes: ["openid", "profile", "email"],
            redirectUri,
            usePKCE: true,
            responseType: AuthSession.ResponseType.Code,
        },
        DISCOVERY
    );

    // Handle OAuth response
    useEffect(() => {
        if (response?.type === "success") {
            const code = response.params?.code;
            if (code && request?.codeVerifier) {
                exchangeCodeForToken(code, request.codeVerifier);
            } else {
                setLoading(false);
                Alert.alert("Error", "No se recibió el código de autorización.");
            }
        } else if (response?.type === "error") {
            setLoading(false);
            Alert.alert("Error de autenticación", response.error?.message ?? "Intenta de nuevo.");
        } else if (response?.type === "dismiss" || response?.type === "cancel") {
            setLoading(false);
        }
    }, [response]);

    async function exchangeCodeForToken(code: string, codeVerifier: string) {
        try {
            // Exchange auth code for tokens using PKCE — no client_secret needed for native clients
            const body = new URLSearchParams({
                code,
                client_id: clientId,
                code_verifier: codeVerifier,
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
            });

            const res = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString(),
            });
            const tokens = await res.json();

            if (tokens.error) {
                throw new Error(tokens.error_description ?? tokens.error);
            }

            const idToken = tokens.id_token as string | undefined;
            if (!idToken) {
                throw new Error("No se recibió id_token de Google.");
            }

            // Sign in to Firebase with the Google ID token
            const userCredential = await signInWithGoogleToken(idToken);
            const fbUser = userCredential.user;

            const session = {
                id: fbUser.uid,
                name: fbUser.displayName ?? "Usuario",
                email: fbUser.email ?? "",
                photo: fbUser.photoURL ?? null,
            };
            await saveSession(session);
            setUser(session); // triggers layout → /(tabs)
        } catch (e: any) {
            console.error("Token exchange error:", e);
            Alert.alert("Error", e?.message ?? "No se pudo iniciar sesión.");
        } finally {
            setLoading(false);
        }
    }

    function onPressIn() { Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start(); }
    function onPressOut() { Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 30 }).start(); }

    async function handleLogin() {
        setLoading(true);
        await promptAsync();
    }

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.blobTop} />
            <View style={styles.blobBottom} />

            <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                {/* Logo */}
                <Animated.View style={[styles.logoRing, { transform: [{ scale: pulseAnim }] }]}>
                    <View style={styles.logoInner}>
                        <Text style={styles.logoEmoji}>💰</Text>
                    </View>
                </Animated.View>

                <Text style={styles.appName}>PagoFijo</Text>
                <Text style={styles.tagline}>Gestiona tus cobros{"\n"}de forma inteligente</Text>

                <View style={styles.divider} />

                <Text style={styles.welcomeTitle}>Bienvenido</Text>
                <Text style={styles.welcomeSub}>Inicia sesión para acceder a tu cuenta</Text>

                {/* Google Sign-in Button */}
                <Animated.View style={{ transform: [{ scale: btnScale }], width: "100%" }}>
                    <Pressable
                        style={({ pressed }) => [styles.googleBtn, pressed && styles.googleBtnPressed]}
                        onPress={handleLogin}
                        onPressIn={onPressIn}
                        onPressOut={onPressOut}
                        disabled={loading || !request}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <GoogleLogo />
                                <Text style={styles.googleBtnText}>Continuar con Google</Text>
                            </>
                        )}
                    </Pressable>
                </Animated.View>

                <Text style={styles.legal}>
                    Al continuar, aceptas nuestros{" "}
                    <Text style={styles.legalLink}>Términos de servicio</Text> y{" "}
                    <Text style={styles.legalLink}>Política de privacidad</Text>
                </Text>
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#0F1117" },

    blobTop: {
        position: "absolute", top: -120, right: -80, width: 320, height: 320,
        borderRadius: 160, backgroundColor: "#1E40AF", opacity: 0.25,
    },
    blobBottom: {
        position: "absolute", bottom: -100, left: -60, width: 280, height: 280,
        borderRadius: 140, backgroundColor: "#1E3A5F", opacity: 0.3,
    },

    container: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },

    logoRing: {
        width: 100, height: 100, borderRadius: 50, borderWidth: 2,
        borderColor: "rgba(59, 130, 246, 0.5)", alignItems: "center",
        justifyContent: "center", marginBottom: 20,
        backgroundColor: "rgba(59, 130, 246, 0.08)",
    },
    logoInner: {
        width: 78, height: 78, borderRadius: 39,
        backgroundColor: "rgba(59, 130, 246, 0.15)",
        alignItems: "center", justifyContent: "center",
    },
    logoEmoji: { fontSize: 38 },

    appName: { fontSize: 38, fontWeight: "900", color: "#FFFFFF", letterSpacing: -1, marginBottom: 8 },
    tagline: { fontSize: 16, color: "#94A3B8", textAlign: "center", lineHeight: 24, fontWeight: "500" },

    divider: { width: 48, height: 3, borderRadius: 2, backgroundColor: "#3B82F6", marginVertical: 32, opacity: 0.7 },

    welcomeTitle: { fontSize: 24, fontWeight: "800", color: "#F1F5F9", marginBottom: 8 },
    welcomeSub: { fontSize: 14, color: "#64748B", marginBottom: 32, textAlign: "center" },

    googleBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        backgroundColor: "#2563EB", borderRadius: 16, paddingVertical: 16,
        paddingHorizontal: 24, width: "100%", shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45,
        shadowRadius: 20, elevation: 10, minHeight: 56,
    },
    googleBtnPressed: { backgroundColor: "#1D4ED8" },
    googleBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },

    legal: { marginTop: 24, fontSize: 12, color: "#475569", textAlign: "center", lineHeight: 18, paddingHorizontal: 16 },
    legalLink: { color: "#60A5FA", fontWeight: "600" },
});
