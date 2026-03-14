import React, { useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { lightColors, useAppColors } from "../themes/colors";

type Period = "Todos" | "Diario" | "Semanal" | "Mensual" | "Anual" | "Personalizado";

interface Props {
    visible: boolean;
    onClose: () => void;
    current: Period;
    onSelect: (p: Period) => void;
    onCustomRange: (start: string, end: string) => void;
}

export function PeriodSelectorModal({ visible, onClose, current, onSelect, onCustomRange }: Props) {
    const colors = useAppColors();
    const styles = getStyles(colors);

    const [showCustom, setShowCustom] = useState(false);
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");

    const options: { label: string; value: Period }[] = [
        { label: "Todos los periodos", value: "Todos" },
        { label: "Diario (Hoy)", value: "Diario" },
        { label: "Esta Semana", value: "Semanal" },
        { label: "Este Mes", value: "Mensual" },
        { label: "Este Año", value: "Anual" },
        { label: "Rango personalizado", value: "Personalizado" },
    ];

    const handleSelect = (p: Period) => {
        if (p === "Personalizado") {
            setShowCustom(true);
        } else {
            onSelect(p);
        }
    };

    const applyCustom = () => {
        if (!start || !end) return;
        onCustomRange(start, end);
        setShowCustom(false);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={() => {}}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Elige el periodo que quieres ver:</Text>
                        <Pressable onPress={onClose}>
                            <Text style={styles.close}>✕</Text>
                        </Pressable>
                    </View>

                    {showCustom ? (
                        <View style={styles.customBody}>
                            <Text style={styles.label}>Fecha Inicio (YYYY-MM-DD)</Text>
                            <TextInput 
                                value={start} 
                                onChangeText={setStart} 
                                placeholder="2024-01-01" 
                                style={styles.input}
                                placeholderTextColor={colors.muted}
                            />
                            
                            <Text style={styles.label}>Fecha Fin (YYYY-MM-DD)</Text>
                            <TextInput 
                                value={end} 
                                onChangeText={setEnd} 
                                placeholder="2024-01-31" 
                                style={styles.input}
                                placeholderTextColor={colors.muted}
                            />

                            <Pressable onPress={applyCustom} style={styles.applyBtn}>
                                <Text style={styles.applyBtnText}>Aplicar Rango</Text>
                            </Pressable>
                            
                            <Pressable onPress={() => setShowCustom(false)} style={{ marginTop: 12, alignItems: 'center' }}>
                                <Text style={{ color: colors.muted, fontWeight: '700' }}>Volver</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={styles.list}>
                            {options.map((opt) => (
                                <Pressable 
                                    key={opt.value} 
                                    onPress={() => handleSelect(opt.value)}
                                    style={[styles.item, current === opt.value && styles.itemActive]}
                                >
                                    <Text style={[styles.itemText, current === opt.value && styles.itemTextActive]}>
                                        {opt.label}
                                    </Text>
                                    {current === opt.value && <Text style={styles.check}>✓</Text>}
                                </Pressable>
                            ))}
                        </ScrollView>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        padding: 24,
    },
    sheet: {
        backgroundColor: colors.card,
        borderRadius: 28,
        padding: 24,
        maxHeight: "85%",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: "900",
        color: colors.text,
        flex: 1,
    },
    close: {
        fontSize: 22,
        color: colors.muted,
        padding: 4,
        fontWeight: "300",
    },
    list: {
        gap: 10,
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    itemActive: {
        backgroundColor: colors.primary + "08",
        borderColor: colors.primary,
        borderWidth: 2,
    },
    itemText: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.text,
    },
    itemTextActive: {
        color: colors.primary,
        fontWeight: "900",
    },
    check: {
        color: colors.primary,
        fontWeight: "900",
        fontSize: 16,
    },
    customBody: {
        gap: 12,
    },
    label: {
        fontSize: 12,
        fontWeight: "800",
        color: colors.muted,
        textTransform: "uppercase",
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        color: colors.text,
    },
    applyBtn: {
        backgroundColor: colors.primary,
        padding: 16,
        borderRadius: 14,
        alignItems: "center",
        marginTop: 8,
    },
    applyBtnText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 16,
    },
});
