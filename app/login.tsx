// app/login.tsx
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    updateProfile,
} from "firebase/auth";
import { saveSession } from "../services/auth";
import { auth, signInWithGoogleToken } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

// Allows expo-web-browser to complete auth sessions on reload
WebBrowser.maybeCompleteAuthSession();

// ─── Client IDs  ─────────────────────────────────────────────────────────────
const IOS_CLIENT_ID =
    "575779505449-48924ju5hjqpocuisj71l4u7crndlelu.apps.googleusercontent.com";
const ANDROID_CLIENT_ID =
    "575779505449-ov75p3nu9frkdmnc6c59of92qhif596n.apps.googleusercontent.com";
const WEB_CLIENT_ID =
    "575779505449-7m3bn6mt04bp7qf7eq9m7gscluonslve.apps.googleusercontent.com";

const DISCOVERY = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
};

function getClientId() {
    if (Platform.OS === "ios") return IOS_CLIENT_ID;
    if (Platform.OS === "android") return ANDROID_CLIENT_ID;
    return WEB_CLIENT_ID;
}

function getReverseClientId() {
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
        width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff",
        alignItems: "center", justifyContent: "center", marginRight: 10,
    },
    g: { fontSize: 13, fontWeight: "800", color: "#4285F4" },
});

export default function LoginScreen() {
    const { setUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const showAlert = (title: string, message: string) => {
        if (Platform.OS === "web") {
            window.alert(`${title}\n\n${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

    // Email/Password States
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

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
    let redirectUri: string;
    if (Platform.OS === "web") {
        redirectUri = AuthSession.makeRedirectUri();
    } else {
        const reverseId = getReverseClientId();
        redirectUri = `${reverseId}:/oauth2redirect`;
    }

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
                showAlert("Error", "No se recibió el código de autorización.");
            }
        } else if (response?.type === "error") {
            setLoading(false);
            showAlert("Error de autenticación", response.error?.message ?? "Intenta de nuevo.");
        } else if (response?.type === "dismiss" || response?.type === "cancel") {
            setLoading(false);
        }
    }, [response]);

    async function exchangeCodeForToken(code: string, codeVerifier: string) {
        try {
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
            setUser(session);
        } catch (e: any) {
            console.error("Token exchange error:", e);
            showAlert("Error", e?.message ?? "No se pudo iniciar sesión.");
        } finally {
            setLoading(false);
        }
    }

    function validateEmail(emailAddr: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddr);
    }

    async function handleEmailAuth() {
        console.log("-> handleEmailAuth started. isSignUp:", isSignUp);
        console.log("Fields:", { email, name, passwordLength: password.length });
        
        if (!email.trim() || !password.trim() || (isSignUp && !name.trim())) {
            console.log("-> Faltan datos validation failed");
            return showAlert("Faltan datos", "Por favor completa todos los campos.");
        }

        if (!validateEmail(email.trim())) {
            console.log("-> Email validation failed:", email);
            return showAlert("Email inválido", "Por favor ingresa un correo electrónico válido (ej: usuario@dominio.com).");
        }

        setLoading(true);
        try {
            let fbUser;
            if (isSignUp) {
                console.log("-> Attempting createUserWithEmailAndPassword");
                const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
                fbUser = userCredential.user;
                console.log("-> Attempting updateProfile");
                await updateProfile(fbUser, { displayName: name.trim() });
            } else {
                console.log("-> Attempting signInWithEmailAndPassword");
                const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
                fbUser = userCredential.user;
            }

            console.log("-> User authenticated, creating session data", fbUser.uid);
            const session = {
                id: fbUser.uid,
                name: fbUser.displayName ?? (name || "Usuario"),
                email: fbUser.email ?? email,
                photo: fbUser.photoURL ?? null,
            };
            await saveSession(session);
            setUser(session);
            console.log("-> Success");
        } catch (e: any) {
            console.error("Email Auth Error:", e.code, e.message);
            let msg = "Ocurrió un error inesperado.";

            // Firebase Auth Error Codes
            switch (e.code) {
                case "auth/email-already-in-use":
                    msg = "Este correo electrónico ya está registrado. Intenta iniciar sesión.";
                    break;
                case "auth/invalid-email":
                    msg = "La dirección de correo electrónico no es válida.";
                    break;
                case "auth/weak-password":
                    msg = "La contraseña es muy débil. Debe tener al menos 6 caracteres.";
                    break;
                case "auth/user-not-found":
                case "auth/wrong-password":
                case "auth/invalid-credential":
                    msg = isSignUp
                        ? "No se pudo crear la cuenta. Verifica los datos."
                        : "Correo o contraseña incorrectos. Verifica tus credenciales o regístrate si no tienes cuenta.";
                    break;
                case "auth/network-request-failed":
                    msg = "Error de red. Verifica tu conexión a internet.";
                    break;
                case "auth/too-many-requests":
                    msg = "Demasiados intentos fallidos. Intenta más tarde.";
                    break;
                default:
                    msg = e.message || msg;
            }

            showAlert("Error de Autenticación", msg);
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleLogin() {
        setLoading(true);
        if (Platform.OS === "web") {
            try {
                const provider = new GoogleAuthProvider();
                const result = await signInWithPopup(auth, provider);
                const fbUser = result.user;

                const session = {
                    id: fbUser.uid,
                    name: fbUser.displayName ?? "Usuario",
                    email: fbUser.email ?? "",
                    photo: fbUser.photoURL ?? null,
                };
                
                await saveSession(session);
                setUser(session);
            } catch (e: any) {
                console.error("Web Google Login Error:", e);
                showAlert("Error", e?.message ?? "No se pudo iniciar sesión con Google en la web.");
            } finally {
                setLoading(false);
            }
            return;
        }
        
        await promptAsync();
    }

    function onPressIn() { Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start(); }
    function onPressOut() { Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 30 }).start(); }

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
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

                        <Text style={styles.welcomeTitle}>{isSignUp ? "Crear cuenta" : "Bienvenido"}</Text>
                        <Text style={styles.welcomeSub}>
                            {isSignUp ? "Regístrate para empezar a gestionar tus cobros" : "Inicia sesión para acceder a tu cuenta"}
                        </Text>

                        {/* Email/Password Form */}
                        <View style={styles.form}>
                            {isSignUp && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Nombre completo</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Juan Pérez"
                                        placeholderTextColor="#475569"
                                        value={name}
                                        onChangeText={setName}
                                    />
                                </View>
                            )}

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Correo electrónico</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="correo@ejemplo.com"
                                    placeholderTextColor="#475569"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Contraseña</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="#475569"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                            </View>

                            <Pressable
                                style={({ pressed }) => [styles.mainBtn, pressed && styles.mainBtnPressed]}
                                onPress={handleEmailAuth}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.mainBtnText}>{isSignUp ? "Registrarse" : "Entrar"}</Text>
                                )}
                            </Pressable>

                            <View style={styles.orRow}>
                                <View style={styles.orLine} />
                                <Text style={styles.orText}>o</Text>
                                <View style={styles.orLine} />
                            </View>

                            {/* Google Sign-in Button */}
                            <Animated.View style={{ transform: [{ scale: btnScale }], width: "100%" }}>
                                <Pressable
                                    style={({ pressed }) => [styles.googleBtn, pressed && styles.googleBtnPressed]}
                                    onPress={handleGoogleLogin}
                                    onPressIn={onPressIn}
                                    onPressOut={onPressOut}
                                    disabled={loading || !request}
                                >
                                    <GoogleLogo />
                                    <Text style={styles.googleBtnText}>Continuar con Google</Text>
                                </Pressable>
                            </Animated.View>
                        </View>

                        <Pressable onPress={() => setIsSignUp(!isSignUp)} style={styles.toggleMode}>
                            <Text style={styles.toggleText}>
                                {isSignUp ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
                                <Text style={styles.toggleLink}>{isSignUp ? "Inicia sesión" : "Regístrate"}</Text>
                            </Text>
                        </Pressable>

                        <Text style={styles.legal}>
                            Al continuar, aceptas nuestros{" "}
                            <Text style={styles.legalLink}>Términos</Text> y{" "}
                            <Text style={styles.legalLink}>Privacidad</Text>
                        </Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
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

    container: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 40 },

    logoRing: {
        width: 80, height: 80, borderRadius: 40, borderWidth: 2,
        borderColor: "rgba(59, 130, 246, 0.5)", alignItems: "center",
        justifyContent: "center", marginBottom: 16,
        backgroundColor: "rgba(59, 130, 246, 0.08)",
    },
    logoInner: {
        width: 62, height: 62, borderRadius: 31,
        backgroundColor: "rgba(59, 130, 246, 0.15)",
        alignItems: "center", justifyContent: "center",
    },
    logoEmoji: { fontSize: 32 },

    appName: { fontSize: 34, fontWeight: "900", color: "#FFFFFF", letterSpacing: -1, marginBottom: 4 },
    tagline: { fontSize: 14, color: "#94A3B8", textAlign: "center", lineHeight: 22, fontWeight: "500" },

    divider: { width: 40, height: 3, borderRadius: 2, backgroundColor: "#3B82F6", marginVertical: 24, opacity: 0.7 },

    welcomeTitle: { fontSize: 22, fontWeight: "800", color: "#F1F5F9", marginBottom: 6 },
    welcomeSub: { fontSize: 13, color: "#64748B", marginBottom: 24, textAlign: "center" },

    form: { width: "100%", gap: 16 },
    inputGroup: { gap: 6 },
    label: { color: "#94A3B8", fontSize: 13, fontWeight: "600", marginLeft: 4 },
    input: {
        backgroundColor: "#1E293B",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: "#F1F5F9",
        fontSize: 15,
        borderWidth: 1,
        borderColor: "#334155",
    },

    mainBtn: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
    },
    mainBtnPressed: { opacity: 0.9 },
    mainBtnText: { color: "#0F1117", fontSize: 16, fontWeight: "700" },

    orRow: { flexDirection: "row", alignItems: "center", marginVertical: 8 },
    orLine: { flex: 1, height: 1, backgroundColor: "#334155" },
    orText: { color: "#64748B", marginHorizontal: 12, fontSize: 12, fontWeight: "600" },

    googleBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, paddingVertical: 14,
        paddingHorizontal: 24, width: "100%", borderWidth: 1, borderColor: "#334155",
    },
    googleBtnPressed: { backgroundColor: "rgba(255,255,255,0.1)" },
    googleBtnText: { color: "#F1F5F9", fontSize: 15, fontWeight: "600" },

    toggleMode: { marginTop: 20 },
    toggleText: { color: "#94A3B8", fontSize: 14 },
    toggleLink: { color: "#3B82F6", fontWeight: "700" },

    legal: { marginTop: 24, fontSize: 11, color: "#475569", textAlign: "center", lineHeight: 16 },
    legalLink: { color: "#60A5FA", fontWeight: "600" },
});
