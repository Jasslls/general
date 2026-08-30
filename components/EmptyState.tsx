import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppColors } from "../themes/colors";

interface EmptyStateProps {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
    const colors = useAppColors();

    return (
        <View style={styles.container}>
            <View style={[styles.iconContainer, { backgroundColor: colors.border }]}>
                <Ionicons name={icon} size={48} color={colors.muted} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        marginTop: 40,
    },
    iconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 8,
        textAlign: "center",
    },
    description: {
        fontSize: 15,
        textAlign: "center",
        lineHeight: 22,
    },
});
