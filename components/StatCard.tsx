import { colors } from "@/themes/colors";
import { StyleSheet, Text, View } from "react-native";

export function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
    return (
        <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={[styles.value, { color }]}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        flex: 1,
    },
    title: { color: colors.muted, fontSize: 13 },
    value: { fontSize: 20, fontWeight: "700", marginTop: 6 },
});
