import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { InvoiceStatus } from "../models/types";
import { colors } from "../themes/colors";

function badgeStyle(status: InvoiceStatus) {
    if (status === "Vencida") return { bg: colors.danger + "1A", fg: colors.danger };
    if (status === "Cobrada") return { bg: colors.success + "1A", fg: colors.success };
    return { bg: colors.border, fg: colors.text };
}

export function InvoiceCard({
    id,
    clientName,
    desc,
    amount,
    dueLabel,
    status,
    onEdit,
    onDelete,
    onMarkPaid,
    onShare,
    onWhatsApp,
}: {
    id: string;
    clientName: string;
    desc: string;
    amount: string;
    dueLabel: string;
    status: InvoiceStatus;
    onEdit?: () => void;
    onDelete?: () => void;
    onMarkPaid?: () => void;
    onShare?: () => void;
    onWhatsApp?: () => void;
}) {
    const b = badgeStyle(status);
    const canMarkPaid = status !== "Cobrada";

    return (
        <View style={styles.card}>
            <View style={styles.topRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.id}>{id}</Text>
                    <Text style={styles.client}>{clientName}</Text>
                </View>

                <View style={styles.actions}>
                    {onWhatsApp && (
                        <Pressable onPress={onWhatsApp} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
                            <FontAwesome name="whatsapp" size={20} color={colors.success} />
                        </Pressable>
                    )}
                    <Pressable onPress={onShare} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
                        <Text style={styles.actionText}>📤</Text>
                    </Pressable>
                    <Pressable onPress={onEdit} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
                        <Text style={styles.actionText}>✎</Text>
                    </Pressable>
                    <Pressable onPress={onDelete} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
                        <Text style={[styles.actionText, { color: colors.danger }]}>🗑</Text>
                    </Pressable>
                </View>
            </View>

            <Text style={styles.desc}>{desc}</Text>

            <View style={styles.bottomRow}>
                <Text style={styles.amount}>{amount}</Text>

                <View style={styles.meta}>
                    <Text style={styles.due}>{dueLabel}</Text>

                    <View style={styles.metaRow}>
                        <View style={[styles.badge, { backgroundColor: b.bg }]}>
                            <Text style={[styles.badgeText, { color: b.fg }]}>{status}</Text>
                        </View>

                        {canMarkPaid && (
                            <Pressable
                                onPress={onMarkPaid}
                                style={({ pressed }) => [styles.paidBtn, pressed && { opacity: 0.85 }]}
                            >
                                <Text style={styles.paidBtnText}>✓ Cobrar</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
    },
    topRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    actions: { flexDirection: "row", gap: 8 },
    actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    actionText: { fontSize: 16, color: colors.text },

    id: { color: colors.text, fontWeight: "900" },
    client: { color: colors.muted, marginTop: 2, fontWeight: "600" },

    desc: { color: colors.text, marginTop: 10, fontWeight: "600" },

    bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 },
    amount: { color: colors.text, fontWeight: "900", fontSize: 16 },

    meta: { alignItems: "flex-end", gap: 8 },
    due: { color: colors.muted, fontWeight: "700", fontSize: 12 },

    metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },

    badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    badgeText: { fontWeight: "900", fontSize: 12 },

    paidBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.success,
        backgroundColor: colors.success + "14",
    },
    paidBtnText: { fontWeight: "900", fontSize: 12, color: colors.success },
});
