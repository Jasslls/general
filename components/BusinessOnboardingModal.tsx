// components/BusinessOnboardingModal.tsx
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { saveSession } from "../services/auth";
import { updateUserProfile } from "../services/firestore";
import { useAppColors } from "../themes/colors";

export function BusinessOnboardingModal() {
    const { user, setUser } = useAuth();
    const colors = useAppColors();
    const styles = getStyles(colors);

    const [visible, setVisible] = useState(false);
    const [businessName, setBusinessName] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Show if user is logged in but missing businessName
        if (user && !user.businessName) {
            setVisible(true);
        } else {
            setVisible(false);
        }
    }, [user]);

    const handleSave = async () => {
        if (!user?.id || !businessName.trim()) return;

        setLoading(true);
        try {
            await updateUserProfile(user.id, { businessName: businessName.trim() });

            const updatedSession = { ...user, businessName: businessName.trim() };
            await saveSession(updatedSession);
            setUser(updatedSession);
            setVisible(false);
        } catch (error) {
            console.error("Error saving business name:", error);
            if (Platform.OS === "web") {
                window.alert("Error: No se pudo guardar el nombre de la empresa.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => { }} // Mandatory
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.overlay}
            >
                <View style={styles.content}>
                    <Text style={styles.title}>¡Bienvenido a PagoFijo! 🚀</Text>
                    <Text style={styles.subtitle}>
                        Danos el nombre de tu negocio para comenzar.
                    </Text>

                    <Text style={styles.label}>Nombre del Negocio</Text>
                    <TextInput
                        style={styles.input}
                        placeholder=""
                        placeholderTextColor={colors.muted}
                        value={businessName}
                        onChangeText={setBusinessName}
                        autoFocus
                    />

                    <Pressable
                        style={[
                            styles.saveBtn,
                            (!businessName.trim() || loading) && { opacity: 0.6 }
                        ]}
                        onPress={handleSave}
                        disabled={!businessName.trim() || loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveBtnText}>Comenzar</Text>
                        )}
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const getStyles = (c: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.85)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    content: {
        backgroundColor: c.card,
        borderRadius: 24,
        padding: 28,
        width: "100%",
        maxWidth: 400,
        borderWidth: 1,
        borderColor: c.border,
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        color: c.text,
        textAlign: "center",
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 15,
        color: c.muted,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 28,
    },
    label: {
        fontSize: 13,
        fontWeight: "700",
        color: c.text,
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: c.bg,
        borderWidth: 1.5,
        borderColor: c.border,
        borderRadius: 14,
        padding: 16,
        fontSize: 16,
        color: c.text,
        marginBottom: 24,
    },
    saveBtn: {
        backgroundColor: c.primary,
        borderRadius: 14,
        padding: 16,
        alignItems: "center",
        shadowColor: c.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
});
