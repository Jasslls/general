import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, ViewStyle } from "react-native";
import { useAppColors } from "../themes/colors";

export function SkeletonLoader({ style }: { style?: ViewStyle }) {
    const colors = useAppColors();
    const animValue = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(animValue, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(animValue, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [animValue]);

    return (
        <Animated.View
            style={[
                styles.skeleton,
                { backgroundColor: colors.border, opacity: animValue },
                style,
            ]}
        />
    );
}

export function SkeletonInvoiceList() {
    return (
        <View style={{ gap: 12 }}>
            {[1, 2, 3].map((key) => (
                <View key={key} style={styles.invoiceCard}>
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <SkeletonLoader style={{ width: "60%", height: 16, marginBottom: 8, borderRadius: 4 }} />
                            <SkeletonLoader style={{ width: "40%", height: 12, borderRadius: 4 }} />
                        </View>
                        <SkeletonLoader style={{ width: 60, height: 20, borderRadius: 4 }} />
                    </View>
                </View>
            ))}
        </View>
    );
}

export function SkeletonClientList() {
    return (
        <View style={{ gap: 12 }}>
            {[1, 2, 3, 4].map((key) => (
                <View key={key} style={styles.clientCard}>
                    <SkeletonLoader style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                        <SkeletonLoader style={{ width: "70%", height: 16, marginBottom: 8, borderRadius: 4 }} />
                        <SkeletonLoader style={{ width: "50%", height: 12, borderRadius: 4 }} />
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    skeleton: {
        overflow: "hidden",
    },
    invoiceCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "transparent",
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    clientCard: {
        padding: 16,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
    },
});
