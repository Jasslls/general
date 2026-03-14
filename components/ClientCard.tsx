import { FontAwesome } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { lightColors, useAppColors } from "../themes/colors";
import { usePremium } from "../hooks/usePremium";
import { PaywallModal } from "./PaywallModal";


type Props = {
    name: string;
    company: string;
    email: string;
    phone: string;
    rfc: string;
    onEdit?: () => void;
    onDelete?: () => void;
    onWhatsApp?: () => void;
    riskLevel?: string;
    compact?: boolean;
};

export function ClientCard({ name, company, email, phone, rfc, riskLevel, onEdit, onDelete, onWhatsApp, compact }: Props) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const { isPremium } = usePremium();
    const [paywallVisible, setPaywallVisible] = useState(false);

    return (
        <>
        <View style={[styles.card, compact && styles.cardCompact]}>
            <View style={styles.topRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.iconBox, compact && styles.iconBoxCompact]}>
                        <Text style={[styles.iconText, compact && { fontSize: 14 }]}>🏢</Text>
                    </View>
                    {riskLevel && ["bajo", "medio", "alto"].includes(riskLevel) && (
                        <Pressable 
                            onPress={() => !isPremium && setPaywallVisible(true)}
                            style={[
                                styles.riskBadge, 
                                { backgroundColor: riskLevel === "alto" ? colors.danger + "20" : riskLevel === "medio" ? "#F59E0B20" : colors.success + "20" },
                                !isPremium && { opacity: 0.5 },
                                compact && { paddingHorizontal: 6, paddingVertical: 2 }
                            ]}
                        >
                            <Text style={[
                                styles.riskText, 
                                { color: riskLevel === "alto" ? colors.danger : riskLevel === "medio" ? "#F59E0B" : colors.success },
                                !isPremium && { opacity: 0.2 },
                                compact && { fontSize: 10 }
                            ]}>
                                {isPremium ? (compact ? riskLevel.charAt(0).toUpperCase() : `Riesgo ${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}`) : "🔒"}
                            </Text>
                        </Pressable>
                    )}
                </View>

                <View style={styles.actions}>
                    {onWhatsApp && (
                        <Pressable onPress={onWhatsApp} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }, compact && { paddingHorizontal: 6 }]}>
                            <FontAwesome name="whatsapp" size={compact ? 16 : 20} color={colors.success} />
                        </Pressable>
                    )}
                    <Pressable onPress={onEdit} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }, compact && { paddingHorizontal: 6 }]}>
                        <Text style={[styles.actionText, compact && { fontSize: 14 }]}>✎</Text>
                    </Pressable>
                    <Pressable onPress={onDelete} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }, compact && { paddingHorizontal: 6 }]}>
                        <Text style={[styles.actionText, { color: colors.danger }, compact && { fontSize: 14 }]}>🗑</Text>
                    </Pressable>
                </View>
            </View>
            
            <View style={compact ? { marginTop: 8 } : {}}>
                <Text style={[styles.name, compact && { marginTop: 0, fontSize: 14 }]} numberOfLines={1}>{name}</Text>
                <Text style={[styles.company, compact && { fontSize: 12 }]} numberOfLines={1}>{company}</Text>
            </View>

            {!compact && (
                <>
                    <View style={{ height: 10 }} />
                    <Text style={styles.line}>✉ {email}</Text>
                    <Text style={styles.line}>📞 {phone}</Text>
                    <View style={styles.divider} />
                    <Text style={styles.rfc}>RFC: {rfc}</Text>
                </>
            )}
        </View>

        <PaywallModal 
            visible={paywallVisible} 
            onClose={() => setPaywallVisible(false)} 
            onActivated={() => setPaywallVisible(false)}
        />
        </>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    card: {
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 180,
    },
    cardCompact: {
        minHeight: 0,
        padding: 10,
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
    iconBoxCompact: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    iconText: { fontSize: 18 },

    actions: { flexDirection: "row", gap: 8 },
    actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    actionText: { fontSize: 16, color: colors.text },

    name: { marginTop: 14, fontSize: 16, fontWeight: "900", color: colors.text },
    company: { marginTop: 2, color: colors.muted, fontWeight: "600" },

    line: { color: colors.text, marginTop: 6, fontWeight: "600" },

    divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
    rfc: { color: colors.muted, fontWeight: "700" },

    riskBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    riskText: { fontSize: 11, fontWeight: "900" },
});
