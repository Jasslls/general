import React, { useEffect, useState } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { lightColors, useAppColors } from "../themes/colors";

type Client = {
    name: string;
    company: string;
    email: string;
    phone: string;
    rfc: string;
};

type Props = {
    visible: boolean;
    onClose: () => void;
    onSave: (client: Client) => void;
    initial?: Client | null;
};

const EMPTY: Client = { name: "", company: "", email: "", phone: "", rfc: "" };

export function ClientFormModal({ visible, onClose, onSave, initial }: Props) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const [form, setForm] = useState<Client>(EMPTY);

    useEffect(() => {
        if (!visible) return;
        if (initial) setForm(initial);
        else setForm(EMPTY);
    }, [initial, visible]);

    function update(key: keyof Client, value: string) {
        setForm((p) => ({ ...p, [key]: value }));
    }

    function save() {
        onSave({
            name: form.name.trim(),
            company: form.company.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            rfc: form.rfc.trim(),
        });
        onClose();
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    style={{ width: "100%" }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
                >
                    <View style={styles.card}>
                        <Text style={styles.title}>{initial ? "Editar Cliente" : "Nuevo Cliente"}</Text>

                        {/* ✅ Inputs scrolleables */}
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 12 }}
                        >
                            <TextInput
                                placeholder="Nombre"
                                value={form.name}
                                onChangeText={(v) => update("name", v)}
                                style={styles.input}
                                returnKeyType="next"
                            />
                            <TextInput
                                placeholder="Empresa"
                                value={form.company}
                                onChangeText={(v) => update("company", v)}
                                style={styles.input}
                                returnKeyType="next"
                            />
                            <TextInput
                                placeholder="Email"
                                value={form.email}
                                onChangeText={(v) => update("email", v)}
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                returnKeyType="next"
                            />
                            <TextInput
                                placeholder="Teléfono"
                                value={form.phone}
                                onChangeText={(v) => update("phone", v)}
                                style={styles.input}
                                keyboardType="phone-pad"
                                returnKeyType="next"
                            />
                            <TextInput
                                placeholder="RFC"
                                value={form.rfc}
                                onChangeText={(v) => update("rfc", v.toUpperCase())}
                                style={styles.input}
                                autoCapitalize="characters"
                                returnKeyType="done"
                            />
                        </ScrollView>

                        {/* ✅ Botones fijos: NO se los come el teclado */}
                        <View style={styles.footer}>
                            <Pressable onPress={onClose} style={styles.cancel}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </Pressable>

                            <Pressable onPress={save} style={styles.save}>
                                <Text style={styles.saveText}>Guardar</Text>
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        padding: 16,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        maxHeight: "85%",
    },
    title: {
        fontSize: 18,
        fontWeight: "900",
        color: colors.text,
        marginBottom: 12,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        marginBottom: 10,
        color: colors.text,
    },

    footer: {
        flexDirection: "row",
        gap: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    cancel: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        alignItems: "center",
        paddingVertical: 12,
    },
    cancelText: { color: colors.text, fontWeight: "700" },
    save: {
        flex: 1,
        backgroundColor: colors.primary,
        borderRadius: 12,
        alignItems: "center",
        paddingVertical: 12,
    },
    saveText: { color: "#fff", fontWeight: "900" },
});
