import { useFocusEffect } from "@react-navigation/native";
import { Share } from "react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useAuth } from "../context/AuthContext";
import { usePremium } from "../hooks/usePremium";
import { PaywallModal } from "../components/PaywallModal";
import type { Client, Invoice } from "../models/types";

import { getAllInvoices, getClients } from "../services/firestore";
import {
    type ReportPeriod,
    buildShareText,
    getAvgDaysToPay,
    getCollectedAmount,
    getCollectionRate,
    getPendingAmount,
    getTopDebtors,
    getTopPayers,
} from "../services/reportEngine";
import { CashFlowBarCard } from "../components/Charts";
import { lightColors, useAppColors } from "../themes/colors";

const PERIODS: { key: ReportPeriod; label: string }[] = [
    { key: "month", label: "Este mes" },
    { key: "quarter", label: "3 meses" },
    { key: "all", label: "Todo" },
];

function money(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function ReportesScreen() {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const { user } = useAuth();
    const uid = user?.id;
    const { isPremium, loading: premiumLoading } = usePremium();
    const [paywallVisible, setPaywallVisible] = useState(false);

    const [clients, setClients] = useState<Client[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<ReportPeriod>("month");

    useFocusEffect(
        useCallback(() => {
            if (!uid) return;
            (async () => {
                setLoading(true);
                try {
                    const [c, invs] = await Promise.all([getClients(uid), getAllInvoices(uid)]);
                    setClients(c);
                    setInvoices(invs);
                } finally {
                    setLoading(false);
                }
            })();
        }, [uid])
    );

    const rate = useMemo(() => getCollectionRate(invoices, period), [invoices, period]);
    const collected = useMemo(() => getCollectedAmount(invoices, period), [invoices, period]);
    const pending = useMemo(() => getPendingAmount(invoices, period), [invoices, period]);
    const avgDays = useMemo(() => getAvgDaysToPay(invoices), [invoices]);
    const topPayers = useMemo(() => getTopPayers(clients, invoices, 3), [clients, invoices]);
    const topDebtors = useMemo(() => getTopDebtors(clients, invoices, 3), [clients, invoices]);

    const handleShare = () => {
        const text = buildShareText(period, rate, collected, pending, avgDays, topPayers, topDebtors);
        Share.share({ message: text });
    };

    if (!premiumLoading && !isPremium) {
        return (
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.h1}>Reportes</Text>
                        <Text style={styles.sub}>Análisis de tu cobranza</Text>
                    </View>
                </View>

                <View style={styles.lockContent}>
                    <Ionicons name="lock-closed" size={64} color={colors.primary} />
                    <Text style={styles.lockTitle}>Reportes Avanzados</Text>
                    <Text style={styles.lockDesc}>
                        Visualiza tendencias, mejores pagadores y deudores críticos. Toma mejores decisiones con datos reales.
                    </Text>
                    <Pressable onPress={() => setPaywallVisible(true)} style={styles.unlockBtn}>
                        <Text style={styles.unlockText}>👑 Desbloquear Reportes</Text>
                    </Pressable>
                </View>

                <PaywallModal 
                    visible={paywallVisible} 
                    onClose={() => setPaywallVisible(false)} 
                    onActivated={() => setPaywallVisible(false)}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={styles.h1}>Reportes</Text>
                    <Text style={styles.sub}>Análisis de tu cobranza</Text>
                </View>
                <Pressable onPress={handleShare} style={styles.shareBtn}>
                    <Ionicons name="share-outline" size={20} color="#fff" />
                    <Text style={styles.shareBtnText}>Compartir</Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loaderText}>Calculando reportes...</Text>
                </View>
            ) : (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                    {/* Period selector */}
                    <View style={styles.periodRow}>
                        {PERIODS.map((p) => (
                            <Pressable
                                key={p.key}
                                onPress={() => setPeriod(p.key)}
                                style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
                            >
                                <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
                                    {p.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* KPI cards */}
                    <View style={styles.kpiGrid}>
                        <View style={[styles.kpiCard, styles.kpiGreen]}>
                            <Text style={styles.kpiLabel}>Total Cobrado</Text>
                            <Text style={[styles.kpiValue, { color: colors.success }]}>{money(collected)}</Text>
                        </View>
                        <View style={[styles.kpiCard, styles.kpiRed]}>
                            <Text style={styles.kpiLabel}>Total Pendiente</Text>
                            <Text style={[styles.kpiValue, { color: colors.danger }]}>{money(pending)}</Text>
                        </View>
                        <View style={[styles.kpiCard, styles.kpiBlue]}>
                            <Text style={styles.kpiLabel}>Tasa de Cobro</Text>
                            <Text style={[styles.kpiValue, { color: colors.primary }]}>{rate}%</Text>
                        </View>
                        <View style={[styles.kpiCard, styles.kpiOrange]}>
                            <Text style={styles.kpiLabel}>Días Prom. Cobro</Text>
                            <Text style={[styles.kpiValue, { color: "#F59E0B" }]}>{avgDays}d</Text>
                        </View>
                    </View>

                    {/* Best payers */}
                    {topPayers.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>🏆 Mejores Pagadores</Text>
                            {topPayers.map((p, i) => (
                                <View key={p.client.id} style={styles.listRow}>
                                    <View style={[styles.rankBadge, { backgroundColor: colors.success + "20" }]}>
                                        <Text style={[styles.rankText, { color: colors.success }]}>{i + 1}</Text>
                                    </View>
                                    <Text style={styles.listName} numberOfLines={1}>{p.client.name}</Text>
                                    <Text style={[styles.listAmount, { color: colors.success }]}>{money(p.totalPaid)}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Top debtors */}
                    {topDebtors.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>🔴 Mayores Deudores</Text>
                            {topDebtors.map((d, i) => (
                                <View key={d.client.id} style={styles.listRow}>
                                    <View style={[styles.rankBadge, { backgroundColor: colors.danger + "20" }]}>
                                        <Text style={[styles.rankText, { color: colors.danger }]}>{i + 1}</Text>
                                    </View>
                                    <Text style={styles.listName} numberOfLines={1}>{d.client.name}</Text>
                                    <Text style={[styles.listAmount, { color: colors.danger }]}>{money(d.totalDebt)}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Monthly trend chart */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📈 Tendencia Mensual</Text>
                        <CashFlowBarCard invoices={invoices} />
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },

    header: {
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        backgroundColor: colors.card,
    },
    backBtn: { padding: 4 },
    h1: { fontSize: 17, fontWeight: "900", color: colors.text },
    sub: { fontSize: 12, color: colors.muted, fontWeight: "600", marginTop: 1 },
    shareBtn: {
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: colors.primary, borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 8,
    },
    shareBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

    loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    loaderText: { color: colors.muted, fontWeight: "600" },

    scroll: { flex: 1 },
    content: { padding: 16, gap: 16, paddingBottom: 32 },

    periodRow: { flexDirection: "row", gap: 8 },
    periodBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 10,
        alignItems: "center", backgroundColor: colors.card,
        borderWidth: 1, borderColor: colors.border,
    },
    periodBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    periodText: { fontWeight: "800", fontSize: 14, color: colors.muted },
    periodTextActive: { color: "#fff" },

    kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    kpiCard: {
        width: "47%", borderRadius: 14, padding: 14,
        borderWidth: 1,
    },
    kpiGreen: { backgroundColor: colors.success + "10", borderColor: colors.success + "30" },
    kpiRed: { backgroundColor: colors.danger + "10", borderColor: colors.danger + "30" },
    kpiBlue: { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" },
    kpiOrange: { backgroundColor: "#F59E0B10", borderColor: "#F59E0B30" },
    kpiLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6 },
    kpiValue: { fontSize: 20, fontWeight: "900" },

    section: {
        backgroundColor: colors.card, borderRadius: 14,
        padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10,
    },
    sectionTitle: { fontSize: 15, fontWeight: "900", color: colors.text },
    listRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    rankBadge: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    rankText: { fontWeight: "900", fontSize: 14 },
    listName: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
    listAmount: { fontSize: 14, fontWeight: "900" },

    // ── Lock Screen ──
    lockContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
    lockTitle: { fontSize: 22, fontWeight: "900", color: colors.text, textAlign: "center" },
    lockDesc: { fontSize: 14, color: colors.muted, textAlign: "center", fontWeight: "600", lineHeight: 20 },
    unlockBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 10 },
    unlockText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
