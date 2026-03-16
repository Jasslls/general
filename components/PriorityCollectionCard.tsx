import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PriorityInvoice } from "../services/riskEngine";
import { lightColors, useAppColors } from "../themes/colors";

function money(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

interface Props {
    items: PriorityInvoice[];
    onSetSearch: (query: string) => void;
}

export function PriorityCollectionCard({ items, onSetSearch }: Props) {
    const colors = useAppColors();
    const styles = getStyles(colors);

    if (items.length === 0) return null;

    return (
        <View style={styles.card}>
            <View style={styles.titleRow}>
                <Text style={styles.title}>Atención Prioritaria</Text>
                <Text style={styles.subtitle}>Facturas más urgentes para cobrar hoy</Text>
            </View>

            {items.slice(0, 5).map((item, idx) => {
                const isOverdue = item.daysOverdue > 0;
                const today = new Date();
                const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
                const dueMonth = (item.invoice.due ?? "").substring(0, 7);
                const isPastMonth = dueMonth < todayMonth;
                const dayNum = (item.invoice.due ?? "").split("-")[2] ?? "?";
                const pillColor = isPastMonth ? colors.danger : colors.success;

                return (
                    <View
                        key={item.invoice.id}
                        style={[styles.row, idx !== items.length - 1 && styles.rowBorder]}
                    >
                        <View style={[styles.scorePill, { backgroundColor: pillColor + "25" }]}>
                            <Text style={[styles.scoreText, { color: pillColor }]}>
                                {dayNum}
                            </Text>
                        </View>

                        <View style={styles.info}>
                            <Text style={styles.clientName} numberOfLines={1}>
                                {item.client?.name ?? "Cliente"}
                            </Text>
                            <Text style={[styles.badge, { color: isOverdue ? colors.danger : "#F59E0B" }]}>
                                {item.badge}
                            </Text>
                        </View>

                        <View style={styles.right}>
                            <Text style={[styles.amount, { color: isOverdue ? colors.danger : colors.text }]}>
                                {money(item.invoice.amount ?? 0)}
                            </Text>
                            <Pressable
                                onPress={() => {
                                    router.push("/facturas");
                                }}
                                style={({ pressed }) => [styles.cobrarbtn, pressed && { opacity: 0.75 }]}
                            >
                                <Text style={styles.cobrarText}>Cobrar</Text>
                            </Pressable>
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    card: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.danger + "40",
        marginBottom: 12,
    },
    titleRow: {
        marginBottom: 16,
    },
    fire: { fontSize: 28 },
    title: { fontSize: 16, fontWeight: "900", color: colors.text },
    subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },

    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        gap: 10,
    },
    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },

    scorePill: {
        width: 46,
        height: 46,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    scoreText: { fontSize: 16, fontWeight: "900" },

    info: { flex: 1 },
    clientName: { fontSize: 14, fontWeight: "800", color: colors.text },
    badge: { fontSize: 12, fontWeight: "600", marginTop: 2 },

    right: { alignItems: "flex-end", gap: 4 },
    amount: { fontSize: 14, fontWeight: "900" },
    cobrarbtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 8,
    },
    cobrarText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
