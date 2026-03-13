import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { sendPasswordResetEmail } from "firebase/auth";
import { router } from "expo-router";
import { BusinessSettings, saveSession, updateAuthDisplayName } from "../../services/auth";
import { auth } from "../../services/firebase";
import { updateUserProfile, updateUserSettings } from "../../services/firestore";
import { lightColors, useThemeColors } from "../../themes/colors";
import { useAuth } from "../_layout";

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
}

export default function CuentaScreen() {
    const { user, signOut, setUser } = useAuth();
    const colors = useThemeColors(user?.settings?.theme);
    const styles = getStyles(colors);

    const [settings, setSettings] = useState<BusinessSettings>({
        currency: "L",
        lateFeePercentage: 0,
        graceDays: 0,
        theme: "system",
    });

    const [saving, setSaving] = useState(false);

    // Modals state
    const [modalVisible, setModalVisible] = useState(false);
    const [activeSetting, setActiveSetting] = useState<keyof BusinessSettings | "profile" | null>(null);
    const [tempValue, setTempValue] = useState("");

    // Profile Edit state
    const [tempProfile, setTempProfile] = useState({ name: "", phone: "" });

    // Legal Modal state
    const [legalVisible, setLegalVisible] = useState(false);

    useEffect(() => {
        if (user?.settings) {
            setSettings({
                ...user.settings,
                theme: user.settings.theme || "system"
            });
        }
    }, [user]);

    const handleEditPress = (key: keyof BusinessSettings | "profile") => {
        setActiveSetting(key);
        if (key === "profile") {
            setTempProfile({ name: user?.name || "", phone: user?.phone || "" });
        } else {
            setTempValue(String(settings[key] || ""));
        }
        setModalVisible(true);
    };

    const handleSecurityPress = () => {
        if (!user?.email) return;
        Alert.alert(
            "Restablecer Contraseña",
            `¿Deseas enviar un correo a ${user.email} con un enlace para restablecer tu contraseña?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Enviar Correo", style: "destructive", onPress: async () => {
                        try {
                            await sendPasswordResetEmail(auth, user.email);
                            Alert.alert("Éxito", "Correo enviado correctamente. Revisa tu bandeja de entrada.");
                        } catch (error: any) {
                            Alert.alert("Error", error.message || "No se pudo enviar el correo.");
                        }
                    }
                }
            ]
        );
    };

    const handleThemePress = () => {
        setActiveSetting("theme");
        setTempValue(settings.theme || "system");
        setModalVisible(true);
    };

    const handleSaveSetting = async () => {
        if (!activeSetting || !user?.id) return;

        setSaving(true);
        try {
            if (activeSetting === "profile") {
                // Actualizar perfil
                await updateAuthDisplayName(tempProfile.name);
                await updateUserProfile(user.id, { name: tempProfile.name, phone: tempProfile.phone });

                // Actualizar sesión local
                const updatedSession = { ...user, name: tempProfile.name, phone: tempProfile.phone };
                await saveSession(updatedSession);
                setUser(updatedSession);
            } else {
                // Actualizar configuraciones de negocio
                let finalValue: string | number = tempValue;
                if (activeSetting !== "currency" && activeSetting !== "theme") {
                    finalValue = Number(tempValue) || 0;
                }

                const updatedSettings = { ...settings, [activeSetting]: finalValue };
                await updateUserSettings(user.id, updatedSettings);

                // Update local state
                setSettings(updatedSettings);
                const updatedSession = { ...user, settings: updatedSettings };
                await saveSession(updatedSession);
                setUser(updatedSession);
            }

            setModalVisible(false);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudo guardar la configuración.");
        } finally {
            setSaving(false);
        }
    };

    const renderOption = (icon: any, title: string, subtitle?: string, onPress?: () => void) => (
        <Pressable style={styles.optionRow} onPress={onPress}>
            <View style={styles.optionIconContainer}>
                <Ionicons name={icon} size={20} color={colors.text} />
            </View>
            <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>{title}</Text>
                {subtitle && <Text style={styles.optionSubtitle}>{subtitle}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
    );

    const getThemeName = (t?: string) => {
        if (t === 'dark') return 'Oscuro';
        if (t === 'light') return 'Claro';
        return 'Sistema';
    };

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

                {/* Header Identidad */}
                <View style={styles.header}>
                    <View style={styles.greetingHeader}>
                        <Text style={styles.greetingIcon}>{getGreeting() === "Buenas noches" ? "🌙" : "☀️"}</Text>
                        <View>
                            <Text style={styles.greetingText}>{getGreeting()},</Text>
                            <Text style={styles.userName}>{user?.name || "Usuario"}</Text>
                        </View>
                    </View>
                </View>

                {/* Status Card (Opción visual basada en referencia) */}
                <View style={styles.statusCard}>
                    <View style={styles.statusCardHalf}>
                        <Ionicons name="mail-outline" size={24} color={colors.primary} />
                        <Text style={styles.statusCardTitle}>{user?.email}</Text>
                    </View>
                    <View style={styles.statusCardDiv} />
                    <View style={styles.statusCardHalf}>
                        <Ionicons name="call-outline" size={24} color={colors.warning} />
                        <Text style={styles.statusCardTitle}>{user?.phone || 'Sin número'}</Text>
                    </View>
                </View>

                {/* Sección: Mi cuenta */}
                <Text style={styles.sectionHeader}>Mi cuenta</Text>
                <View style={styles.sectionBlock}>
                    {renderOption("person-outline", "Mi perfil", "Gestionar nombre y contacto", () => handleEditPress("profile"))}
                    {renderOption("color-palette-outline", "Apariencia", `Actual: ${getThemeName(settings.theme)}`, handleThemePress)}
                    {renderOption("shield-checkmark-outline", "Restablecer contraseña", "Enviar correo de recuperación", handleSecurityPress)}
                </View>

                {/* Sección: Herramientas */}

                {/* Sección: Herramientas */}
                <Text style={styles.sectionHeader}>Herramientas</Text>
                <View style={styles.sectionBlock}>
                    {renderOption("bar-chart-outline", "Reportes y Analytics", "Ver estadísticas de cobranza", () => router.push("/reportes"))}
                </View>

                {/* Sección: Información */}
                <Text style={styles.sectionHeader}>Acerca de</Text>
                <View style={styles.sectionBlock}>
                    {renderOption("document-text-outline", "Términos y Condiciones", "", () => setLegalVisible(true))}
                    {renderOption("information-circle-outline", "Versión de la app", "1.0.0")}
                </View>

                {/* Acciones Finales */}
                <View style={styles.actionsBlock}>
                    <Pressable style={styles.supportBtn} onPress={() => {
                        Linking.openURL("mailto:jassernahun0@gmail.com?subject=Soporte%20PagoFijo").catch(() => {
                            Alert.alert("Error", "No se pudo abrir la aplicación de correo.");
                        });
                    }}>
                        <Ionicons name="headset-outline" size={20} color={colors.text} />
                        <Text style={styles.supportBtnText}>SOPORTE</Text>
                    </Pressable>

                    <Pressable
                        style={styles.logoutBtn}
                        onPress={() => {
                            if (Platform.OS === "web") {
                                const confirmLogout = window.confirm("¿Estás seguro que deseas cerrar sesión?");
                                if (confirmLogout) {
                                    signOut();
                                }
                            } else {
                                Alert.alert(
                                    "¿Estás seguro que deseas cerrar sesión?",
                                    "",
                                    [
                                        { text: "Cancelar", style: "cancel" },
                                        { text: "Cerrar sesión", style: "destructive", onPress: signOut }
                                    ]
                                );
                            }
                        }}
                    >
                        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                        <Text style={styles.logoutBtnText}>CERRAR SESIÓN</Text>
                    </Pressable>
                </View>
            </ScrollView>

            {/* Modal para editar configuración */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {activeSetting === 'theme' ? (
                            <>
                                <Text style={styles.modalTitle}>Apariencia</Text>
                                {[
                                    { value: "system", label: "Sistema" },
                                    { value: "light", label: "Claro" },
                                    { value: "dark", label: "Oscuro" }
                                ].map((opt) => (
                                    <Pressable
                                        key={opt.value}
                                        style={[
                                            styles.modalInput,
                                            { marginBottom: 12, alignItems: 'center', backgroundColor: colors.bg },
                                            tempValue === opt.value && { borderColor: colors.primary, backgroundColor: colors.primary + "1A" }
                                        ]}
                                        onPress={() => setTempValue(opt.value)}
                                    >
                                        <Text style={[
                                            { fontSize: 16, color: colors.text, fontWeight: '600' },
                                            tempValue === opt.value && { color: colors.primary, fontWeight: 'bold' }
                                        ]}>
                                            {opt.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </>
                        ) : activeSetting === 'profile' ? (
                            <>
                                <Text style={styles.modalTitle}>Mi Perfil</Text>
                                <Text style={styles.inputLabel}>Correo / Nombre de Usuario</Text>
                                <TextInput
                                    style={[styles.modalInput, { backgroundColor: colors.border, color: colors.muted }]}
                                    value={user?.email || ""}
                                    editable={false}
                                />

                                <Text style={styles.inputLabel}>Nombre</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={tempProfile.name}
                                    onChangeText={(t) => setTempProfile({ ...tempProfile, name: t })}
                                    placeholder="Nombre completo"
                                    placeholderTextColor={colors.muted}
                                />

                                <Text style={styles.inputLabel}>Celular</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={tempProfile.phone}
                                    onChangeText={(t) => setTempProfile({ ...tempProfile, phone: t })}
                                    placeholder="+504 1234-5678"
                                    placeholderTextColor={colors.muted}
                                    keyboardType="phone-pad"
                                />
                            </>
                        ) : (
                            <>
                                <Text style={styles.modalTitle}>
                                    Editar {activeSetting === "currency" ? "Moneda" :
                                        activeSetting === "lateFeePercentage" ? "Interés por mora (%)" : "Días de gracia"}
                                </Text>

                                <TextInput
                                    style={styles.modalInput}
                                    value={tempValue}
                                    onChangeText={setTempValue}
                                    keyboardType={
                                        activeSetting === "lateFeePercentage" || activeSetting === "graceDays"
                                            ? "numeric"
                                            : "default"
                                    }
                                    autoFocus
                                />
                            </>
                        )}


                        <View style={styles.modalActions}>
                            <Pressable style={styles.modalBtnCancel} onPress={() => setModalVisible(false)}>
                                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                            </Pressable>
                            <Pressable style={styles.modalBtnSave} onPress={handleSaveSetting} disabled={saving}>
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.modalBtnSaveText}>Guardar</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal de Términos Legales */}
            <Modal visible={legalVisible} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.legalModalContainer}>
                    <View style={styles.legalModalHeader}>
                        <Text style={styles.legalModalTitle}>Términos y Condiciones</Text>
                        <Pressable onPress={() => setLegalVisible(false)} style={styles.legalModalCloseBtn}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </Pressable>
                    </View>
                    <ScrollView style={styles.legalModalContent} contentContainerStyle={{ paddingBottom: 40 }}>
                        <Text style={styles.legalText}>
                            Última actualización: Marzo 2026{"\n\n"}
                            1. Aceptación de los Términos{"\n"}
                            Al descargar o utilizar la aplicación "Pagifijo", estos términos se aplicarán automáticamente a usted; por lo tanto, debe asegurarse de leerlos con atención antes de usar la aplicación. No se le permite copiar ni modificar la aplicación, ninguna parte de la aplicación ni nuestras marcas comerciales de ninguna manera.{"\n\n"}
                            2. Privacidad de los Datos{"\n"}
                            Pagifijo almacena y procesa los datos personales que nos ha proporcionado, para proporcionar nuestro Servicio. Es su responsabilidad mantener seguros su teléfono y el acceso a la aplicación.{"\n\n"}
                            3. Cambios en los Términos{"\n"}
                            Podemos actualizar nuestros Términos y Condiciones de vez en cuando. Por lo tanto, se le recomienda revisar esta página periódicamente en busca de cualquier cambio. Le notificaremos de cualquier cambio publicando los nuevos Términos y Condiciones en esta página.
                        </Text>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

        </SafeAreaView>
    );
}

const getStyles = (c: typeof lightColors) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 40 },

    header: { marginBottom: 20 },
    greetingHeader: { flexDirection: "row", alignItems: "center" },
    greetingIcon: { fontSize: 32, marginRight: 12 },
    greetingText: { fontSize: 14, color: c.muted, marginBottom: 2 },
    userName: { fontSize: 24, fontWeight: "bold", color: c.text },

    statusCard: {
        flexDirection: "row",
        backgroundColor: c.card,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: c.border,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    statusCardHalf: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    statusCardTitle: { fontSize: 13, fontWeight: "600", color: c.text },
    statusCardDiv: { width: 1, backgroundColor: c.border, marginHorizontal: 10 },

    sectionHeader: { fontSize: 18, fontWeight: "bold", color: c.text, marginBottom: 12, marginTop: 8 },
    sectionBlock: {
        backgroundColor: c.card,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: c.border,
        marginBottom: 24,
    },
    optionRow: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
    },
    optionIconContainer: { marginRight: 16 },
    optionTextContainer: { flex: 1 },
    optionTitle: { fontSize: 15, fontWeight: "500", color: c.text },
    optionSubtitle: { fontSize: 13, color: c.primary, marginTop: 2 },

    actionsBlock: {
        flexDirection: "row",
        gap: 12,
        marginTop: 10,
    },
    supportBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.card,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.border,
        gap: 8,
    },
    supportBtnText: { fontSize: 13, fontWeight: "bold", color: c.text },
    logoutBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(220, 38, 38, 0.05)",
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    logoutBtnText: { fontSize: 13, fontWeight: "bold", color: c.danger },

    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalContent: {
        backgroundColor: c.card,
        borderRadius: 16,
        padding: 24,
        width: "100%",
        maxWidth: 400,
    },
    modalTitle: { fontSize: 18, fontWeight: "bold", color: c.text, marginBottom: 16 },
    inputLabel: { fontSize: 13, color: c.muted, marginBottom: 6, fontWeight: "600" },
    modalInput: {
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: c.text,
        marginBottom: 20,
        backgroundColor: c.bg,
    },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
    modalBtnCancel: { padding: 12, borderRadius: 8 },
    modalBtnCancelText: { color: c.muted, fontWeight: "600" },
    modalBtnSave: { backgroundColor: c.primary, padding: 12, borderRadius: 8, minWidth: 80, alignItems: "center" },
    modalBtnSaveText: { color: "#fff", fontWeight: "bold" },

    // Legal Modal styles
    legalModalContainer: { flex: 1, backgroundColor: c.bg },
    legalModalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        backgroundColor: c.card,
    },
    legalModalTitle: { fontSize: 18, fontWeight: "bold", color: c.text },
    legalModalCloseBtn: { padding: 4 },
    legalModalContent: { flex: 1, padding: 20 },
    legalText: { fontSize: 15, color: c.muted, lineHeight: 24 },
});
