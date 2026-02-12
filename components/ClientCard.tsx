import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../themes/colors";

type Props = {
    name: string;
    company: string;
    email: string;
    phone: string;
    rfc: string;
    onEdit?: () => void;
    onDelete?: () => void;
    onWhatsApp?: () => void;
};

export function ClientCard({ name, company, email, phone, rfc, onEdit, onDelete, onWhatsApp }: Props) {
    return (
        <View style={styles.card}>
            <View style={styles.topRow}>
                <View style={styles.iconBox}>
                    <Text style={styles.iconText}>🏢</Text>
                </View>

                <View style={styles.actions}>
                    {onWhatsApp && (
                        <Pressable onPress={onWhatsApp} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
                            <FontAwesome name="whatsapp" size={20} color={colors.success} />
                        </Pressable>
                    )}
                    <Pressable onPress={onEdit} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
                        <Text style={styles.actionText}>✎</Text>
                    </Pressable>
                    <Pressable onPress={onDelete} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
                        <Text style={[styles.actionText, { color: colors.danger }]}>🗑</Text>
                    </Pressable>
                </View>
            </View>

            <Text style={styles.name}>{name}</Text>
            <Text style={styles.company}>{company}</Text>

            <View style={{ height: 10 }} />

            <Text style={styles.line}>✉ {email}</Text>
            <Text style={styles.line}>📞 {phone}</Text>

            <View style={styles.divider} />

            <Text style={styles.rfc}>RFC: {rfc}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 180,
    },
    topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },

    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.primary + "1A",
        alignItems: "center",
        justifyContent: "center",
    },
    iconText: { fontSize: 18 },

    actions: { flexDirection: "row", gap: 8 },
    actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    actionText: { fontSize: 16, color: colors.text },

    name: { marginTop: 10, fontSize: 16, fontWeight: "900", color: colors.text },
    company: { marginTop: 2, color: colors.muted, fontWeight: "600" },

    line: { color: colors.text, marginTop: 6, fontWeight: "600" },

    divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
    rfc: { color: colors.muted, fontWeight: "700" },
});
