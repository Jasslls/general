// components/PaywallModal.tsx
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { usePremium } from "../hooks/usePremium";
import { lightColors, useAppColors } from "../themes/colors";

import { PremiumWelcomeContent, PremiumWelcomeModal } from "./PremiumWelcomeModal";

const FEATURES = [
    { icon: "🤖", text: "Fijito — Asistente Financiero IA" },
    { icon: "✨", text: "Generación de mensajes con IA" },
    { icon: "📊", text: "Reportes y analíticas avanzadas" },
    { icon: "🎯", text: "Indicadores de Riesgo (Bajo/Medio/Alto)" },
    { icon: "🔁", text: "Facturas recurrentes (semanal/mensual/anual)" },
    { icon: "🔔", text: "Notificaciones proactivas inteligentes" },
];

type Plan = "monthly" | "annual";

interface Props {
    visible: boolean;
    onClose: () => void;
    onActivated?: () => void;
}

export function PaywallModal({ visible, onClose, onActivated }: Props) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const { trialAvailable, activateTrial, loading } = usePremium();

    const [selectedPlan, setSelectedPlan] = useState<Plan>("annual");
    const [activating, setActivating] = useState(false);
    const [welcomeVisible, setWelcomeVisible] = useState(false);

    const handleTrial = async () => {
        setActivating(true);
        try {
            await activateTrial();
            setWelcomeVisible(true);
        } catch {
            Alert.alert("Error", "No se pudo activar la prueba. Intenta de nuevo.");
        } finally {
            setActivating(false);
        }
    };

    const handleUpgrade = () => {
        Alert.alert("Próximamente", "", [{ text: "OK" }]);
    };


    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={[styles.overlay, welcomeVisible && { justifyContent: "center" }]}>

                {welcomeVisible ? (
                    <View style={{ width: "100%", padding: 20 }}>
                        <PremiumWelcomeContent 
                            onClose={() => {
                                setWelcomeVisible(false);
                                onActivated?.();
                                onClose();
                            }} 
                        />
                    </View>
                ) : (
                    <View style={styles.sheet}>
                        {/* ── Header ── */}
                        <View style={styles.header}>
                            <Pressable onPress={onClose} style={styles.closeBtn}>
                                <Text style={styles.closeText}>✕</Text>
                            </Pressable>
                            <Text style={styles.crown}>👑</Text>
                            <Text style={styles.headerTitle}>PagoFijo Premium</Text>
                            <Text style={styles.headerSub}>
                                Transforma tu cobranza con inteligencia artificial
                            </Text>
                        </View>

                        <ScrollView
                            contentContainerStyle={styles.body}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* ── Feature list ── */}
                            <Text style={styles.sectionLabel}>TODO LO QUE DESBLOQUEAS</Text>
                            {FEATURES.map((f, i) => (
                                <View key={i} style={styles.featureRow}>
                                    <Text style={styles.featureIcon}>{f.icon}</Text>
                                    <Text style={styles.featureText}>{f.text}</Text>
                                    <Text style={styles.check}>✓</Text>
                                </View>
                            ))}

                            {/* ── Plan selector ── */}
                            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>ELIGE TU PLAN</Text>
                            <View style={styles.planRow}>
                                <Pressable
                                    onPress={() => setSelectedPlan("monthly")}
                                    style={[styles.planCard, selectedPlan === "monthly" && styles.planCardActive]}
                                >
                                    <Text style={[styles.planName, selectedPlan === "monthly" && styles.planNameActive]}>
                                        Mensual
                                    </Text>
                                    <Text style={[styles.planPrice, selectedPlan === "monthly" && styles.planPriceActive]}>
                                        $4.99
                                    </Text>
                                    <Text style={[styles.planPer, selectedPlan === "monthly" && { color: colors.primary }]}>
                                        /mes
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => setSelectedPlan("annual")}
                                    style={[styles.planCard, selectedPlan === "annual" && styles.planCardActive]}
                                >
                                    <View style={styles.saveBadge}>
                                        <Text style={styles.saveBadgeText}>Ahorra 30%</Text>
                                    </View>
                                    <Text style={[styles.planName, selectedPlan === "annual" && styles.planNameActive]}>
                                        Anual
                                    </Text>
                                    <Text style={[styles.planPrice, selectedPlan === "annual" && styles.planPriceActive]}>
                                        $3.49
                                    </Text>
                                    <Text style={[styles.planPer, selectedPlan === "annual" && { color: colors.primary }]}>
                                        /mes
                                    </Text>
                                    <Text style={[styles.planBilled, selectedPlan === "annual" && { color: colors.muted }]}>
                                        US$41.99/año
                                    </Text>
                                </Pressable>
                            </View>

                            {/* ── CTA Buttons ── */}
                            <Pressable
                                onPress={handleUpgrade}
                                style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
                            >
                                <Text style={styles.ctaBtnText}>
                                    Continuar con {selectedPlan === "monthly" ? "Mensual" : "Anual"}
                                </Text>
                            </Pressable>

                            {trialAvailable && (
                                <Pressable
                                    onPress={handleTrial}
                                    disabled={activating}
                                    style={({ pressed }) => [styles.trialBtn, pressed && { opacity: 0.8 }]}
                                >
                                    {activating ? (
                                        <ActivityIndicator color={colors.primary} />
                                    ) : (
                                        <Text style={styles.trialBtnText}>
                                            ⚡ Probar Premium gratis por 24 horas
                                        </Text>
                                    )}
                                </Pressable>
                            )}

                            <Text style={styles.disclaimer}>
                                Cancela cuando quieras · Pago 100% seguro
                            </Text>
                        </ScrollView>
                    </View>
                )}
            </View>
        </Modal>
    );
}



const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: "hidden",
        maxHeight: "92%",
    },

    // Header
    header: {
        paddingTop: 20,
        paddingBottom: 28,
        paddingHorizontal: 24,
        alignItems: "center",
        position: "relative",
        backgroundColor: "#1e3a8a", // Deep blue
    },
    closeBtn: {
        position: "absolute",
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
    },
    closeText: { color: "#fff", fontWeight: "800", fontSize: 14 },
    crown: { fontSize: 44, marginBottom: 8 },
    headerTitle: { color: "#fff", fontSize: 22, fontWeight: "900", marginBottom: 4 },
    headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 14, textAlign: "center", fontWeight: "600" },

    body: { padding: 20, paddingBottom: 36 },

    sectionLabel: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 1.2,
        marginBottom: 12,
    },

    // Features
    featureRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 12,
    },
    featureIcon: { fontSize: 22, width: 32 },
    featureText: { flex: 1, color: colors.text, fontWeight: "600", fontSize: 14 },
    check: { color: "#22c55e", fontWeight: "900", fontSize: 16 },

    // Plans
    planRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
    planCard: {
        flex: 1,
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 14,
        alignItems: "center",
        gap: 2,
        position: "relative",
    },
    planCardActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + "10",
    },
    planName: { color: colors.muted, fontWeight: "800", fontSize: 13 },
    planNameActive: { color: colors.primary },
    planPrice: { color: colors.text, fontWeight: "900", fontSize: 26 },
    planPriceActive: { color: colors.primary },
    planPer: { color: colors.muted, fontWeight: "600", fontSize: 13 },
    planBilled: { color: colors.muted, fontWeight: "600", fontSize: 11, marginTop: 2 },
    saveBadge: {
        position: "absolute",
        top: -10,
        backgroundColor: "#22c55e",
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    saveBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },

    // CTA
    ctaBtn: {
        backgroundColor: colors.primary,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 12,
    },
    ctaBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },

    trialBtn: {
        borderWidth: 1.5,
        borderColor: colors.primary,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        marginBottom: 16,
    },
    trialBtnText: { color: colors.primary, fontWeight: "800", fontSize: 15 },

    disclaimer: {
        color: colors.muted,
        fontSize: 12,
        textAlign: "center",
        fontWeight: "600",
    },
});
