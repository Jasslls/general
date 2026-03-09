import { StyleSheet, Text, View } from "react-native";
import { lightColors, useAppColors } from "../themes/colors";

type Props = {
    id: string;
    client: string;
    amount: string;
    status: "Vencida" | "Pendiente" | "Cobrada";
    subtitle?: string;
};

export function InvoiceRow({ id, client, amount, status, subtitle }: Props) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const badgeColor =
        status === "Vencida"
            ? colors.danger
            : status === "Pendiente"
                ? colors.warning
                : colors.success;

    return (
        <View style={styles.row}>
            {/* ✅ CLAVE: minWidth:0 para que no rompa texto en cascada */}
            <View style={styles.left}>
                <Text style={styles.id} numberOfLines={1}>
                    {id}
                </Text>
                <Text style={styles.client} numberOfLines={1}>
                    {client}
                </Text>
                {!!subtitle && (
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {subtitle}
                    </Text>
                )}
            </View>

            <View style={styles.right}>
                <Text style={styles.amount} numberOfLines={1}>
                    {amount}
                </Text>
                <View style={[styles.badge, { borderColor: badgeColor, backgroundColor: badgeColor + "1A" }]}>
                    <Text style={[styles.badgeText, { color: badgeColor }]} numberOfLines={1}>
                        {status}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    row: {
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
    },

    // ✅ anti-cascada
    left: {
        flex: 1,
        minWidth: 0,
        paddingRight: 12,
    },
    right: {
        alignItems: "flex-end",
        flexShrink: 0,
    },

    id: { fontWeight: "800", color: colors.text },
    client: { color: colors.text, marginTop: 4, fontWeight: "600" },
    subtitle: { color: colors.muted, marginTop: 6, fontSize: 12 },

    amount: { fontWeight: "800", color: colors.text },
    badge: {
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
    },
    badgeText: { fontSize: 12, fontWeight: "800" },
});
