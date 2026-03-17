import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { InvoiceStatus } from "../models/types";
import { lightColors, useAppColors } from "../themes/colors";
import { Image } from "expo-image";

function badgeStyle(status: InvoiceStatus, colors: any) {
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
    proofUri,
    compact,
    isRecurring,
    paidAmount,
    onPressCard,
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
    proofUri?: string;
    compact?: boolean;
    isRecurring?: boolean;
    paidAmount?: number;
    onPressCard?: () => void;
}) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const b = badgeStyle(status, colors);
    const canMarkPaid = status !== "Cobrada";

    if (compact) {
        return (
            <Pressable onPress={onPressCard} style={({ pressed }) => [styles.card, styles.cardCompact, pressed && { opacity: 0.9 }]}>
                <View style={styles.compactRow}>
                    <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {isRecurring && <MaterialIcons name="event-repeat" size={16} color={colors.primary} />}
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.id, { fontSize: 13 }]} numberOfLines={1}>{clientName}</Text>
                            <Text style={[styles.client, { fontSize: 11 }]} numberOfLines={1}>#{id}</Text>
                        </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.amount, { fontSize: 14 }]}>{amount}</Text>
                        <View style={[styles.badge, { backgroundColor: b.bg, paddingVertical: 2, paddingHorizontal: 6, marginTop: 2 }]}>
                            <Text style={[styles.badgeText, { color: b.fg, fontSize: 10 }]}>{status}</Text>
                        </View>
                    </View>
                </View>
                <View style={[styles.compactActions, { marginTop: 8 }]}>
                    <Text style={[styles.due, { flex: 1, fontSize: 11, marginTop: 0 }]}>{dueLabel}</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                        {onWhatsApp && (
                            <Pressable onPress={onWhatsApp} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }, { paddingHorizontal: 6, paddingVertical: 4 }]}>
                                <MaterialIcons name="notifications-none" size={18} color={colors.primary} />
                            </Pressable>
                        )}
                        <Pressable onPress={onShare} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }, { paddingHorizontal: 6, paddingVertical: 4 }]}>
                            <Text style={{ fontSize: 14 }}>📤</Text>
                        </Pressable>
                        <Pressable onPress={onEdit} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }, { paddingHorizontal: 6, paddingVertical: 4 }]}>
                            <Text style={{ fontSize: 14 }}>✎</Text>
                        </Pressable>
                        <Pressable onPress={onDelete} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }, { paddingHorizontal: 6, paddingVertical: 4 }]}>
                            <Text style={[{ fontSize: 14, color: colors.danger }]}>🗑</Text>
                        </Pressable>
                    </View>
                </View>
            </Pressable>
        );
    }

    return (
        <Pressable onPress={onPressCard} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
            <View style={styles.topRow}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {isRecurring && <MaterialIcons name="event-repeat" size={18} color={colors.primary} />}
                        <Text style={styles.id} numberOfLines={2}>{clientName}</Text>
                    </View>
                    <Text style={styles.client} numberOfLines={1}>#{id}</Text>
                </View>

                <View style={styles.actions}>
                    {onWhatsApp && (
                        <Pressable onPress={onWhatsApp} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
                            <MaterialIcons name="notifications-none" size={22} color={colors.primary} />
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
                        {proofUri && (
                            <View style={styles.proofContainer}>
                                <Image 
                                    source={{ uri: proofUri }} 
                                    style={styles.proofThumb}
                                    contentFit="cover"
                                />
                                <View style={styles.proofBadge}>
                                    <Text style={{ fontSize: 10 }}>📄</Text>
                                </View>
                            </View>
                        )}
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
        </Pressable>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    card: {
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardCompact: {
        padding: 10,
    },
    compactRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
    },
    compactActions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
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
    
    proofContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: colors.border,
        overflow: "hidden",
        position: "relative"
    },
    proofThumb: { width: "100%", height: "100%" },
    proofBadge: {
        position: "absolute",
        bottom: -2,
        right: -2,
        backgroundColor: "#fff",
        borderRadius: 6,
        padding: 2,
        borderWidth: 1,
        borderColor: colors.border
    },

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
