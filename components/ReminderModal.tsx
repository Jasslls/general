import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
import * as MailComposer from "expo-mail-composer";
import type { Client, Invoice } from "../models/types";
import { getCollectionMessages } from "../services/aiService";
import type { GeneratedMessages, Tone } from "../services/gemini";
import { lightColors, useAppColors } from "../themes/colors";
import { openWhatsApp } from "../utils/whatsapp";
import { usePremium } from "../hooks/usePremium";
import { PaywallModal } from "./PaywallModal";
import { useAuth } from "../context/AuthContext";

export function ReminderModal({
    visible,
    onClose,
    invoice,
    client,
    initialChannel,
    onPremiumRequired,
}: {
    visible: boolean;
    onClose: () => void;
    invoice: Invoice | null;
    client: Client | null;
    initialChannel?: "whatsapp" | "email";
    onPremiumRequired?: () => void;
}) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const { isPremium } = usePremium();
    const { user } = useAuth();


    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<GeneratedMessages | null>(null);
    const [selectedTone, setSelectedTone] = useState<Tone>("amigable");
    const [editedText, setEditedText] = useState("");
    const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
    const [isIAMode, setIsIAMode] = useState(false);

    useEffect(() => {
        if (!visible || !invoice || !client) {
            if (!visible) {
                setMessages(null);
                setEditedText("");
                setLoading(false);
                setIsIAMode(false);
            }
            return;
        }

        if (initialChannel) {
            setChannel(initialChannel);
        }
    }, [visible, invoice, client, initialChannel]);

    const fetchMessages = async () => {
        if (!client || !invoice) return;
        if (!isPremium) {
        onClose();
            setTimeout(() => {
                onPremiumRequired?.();
            }, 300);
            return;
        }
        setLoading(true);
        setIsIAMode(true);

        try {
            const businessName = user?.businessName || user?.name || "mi negocio";
            const result = await getCollectionMessages(client, invoice, businessName);
            setMessages(result);
            setSelectedTone(result.recommended);
            setEditedText(result[result.recommended]);
        } catch (error: any) {
            Alert.alert("Error de IA", error.message || "No se pudo generar el mensaje.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectTone = (tone: Tone) => {
        setSelectedTone(tone);
        if (messages) {
            setEditedText(messages[tone]);
        }
    };

    const handleSend = async () => {
        if (!client || !editedText.trim()) return;
        
        if (channel === "whatsapp") {
            openWhatsApp(client.phone, editedText.trim());
        } else {
            const isAvailable = await MailComposer.isAvailableAsync();
            if (isAvailable) {
                await MailComposer.composeAsync({
                    recipients: [client.email],
                    subject: `Recordatorio de Pago — ${client.company || client.name}`,
                    body: editedText.trim(),
                });
            } else {
                Alert.alert("Error", "La aplicación de correo no está disponible en este dispositivo.");
            }
        }
        onClose();
    };

    return (
        <>
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    style={{ width: "100%", maxHeight: "92%" }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <View style={styles.card}>
                        <ScrollView style={styles.scrollableContent}>
                            <View style={styles.cardContent}>
                                <Text style={styles.title}>Asistente de Cobranza IA</Text>
                                <Text style={styles.subtitle}>
                                    La IA redacta mensajes únicos analizando el nivel de mora y riesgo comercial del cliente en tiempo real.
                                </Text>

                                {/* Channel Selector (Always visible) */}
                                <View style={{ marginBottom: 10 }}>
                                    <Text style={[styles.label, { marginBottom: 4, fontSize: 13 }]}>Enviar por:</Text>
                                    <View style={styles.channelRow}>
                                        <Pressable 
                                            onPress={() => setChannel("whatsapp")}
                                            style={[styles.channelBtn, channel === "whatsapp" && styles.channelBtnActive]}
                                        >
                                            <Text style={[styles.channelText, channel === "whatsapp" && styles.channelTextActive, { fontSize: 13 }]}>📲 WhatsApp</Text>
                                        </Pressable>
                                        <Pressable 
                                            onPress={() => setChannel("email")}
                                            style={[styles.channelBtn, channel === "email" && styles.channelBtnActive]}
                                        >
                                            <Text style={[styles.channelText, channel === "email" && styles.channelTextActive, { fontSize: 13 }]}>📧 Correo</Text>
                                        </Pressable>
                                    </View>
                                </View>

                                <View>
                                {loading ? (
                                    <View style={styles.loadingBox}>
                                        <ActivityIndicator size="large" color={colors.primary} />
                                        <Text style={styles.loadingText}>Analizando cliente y redactando...</Text>
                                    </View>
                                ) : messages ? (
                                    <>
                                        {isIAMode && (
                                            <>
                                                <View style={styles.infoBox}>
                                                    <Text style={styles.infoText}>
                                                        <Text style={{ fontWeight: "800" }}>Recomendación IA:</Text> Dado que el nivel de riesgo de {client?.name} es <Text style={{ color: client?.riskLevel === "alto" ? colors.danger : client?.riskLevel === "medio" ? "#F59E0B" : colors.success, fontWeight: "900" }}>{client?.riskLevel}</Text>, te sugiero usar el tono <Text style={{ fontWeight: "800", textTransform: "uppercase" }}>{messages.recommended}</Text>.
                                                    </Text>
                                                </View>

                                                <Text style={styles.label}>Elige un Tono:</Text>
                                                <View style={styles.toneRow}>
                                                    {(["amigable", "formal", "urgente"] as Tone[]).map((t) => {
                                                        const active = t === selectedTone;
                                                        const isRecommended = t === messages.recommended;
                                                        const tColor = t === "amigable" ? colors.success : t === "formal" ? "#4F46E5" : colors.danger;
                                                        
                                                        return (
                                                            <Pressable
                                                                key={t}
                                                                onPress={() => handleSelectTone(t)}
                                                                style={[
                                                                    styles.toneBtn,
                                                                    {
                                                                        borderColor: active ? tColor : colors.border,
                                                                        backgroundColor: active ? tColor + "1A" : "transparent"
                                                                    }
                                                                ]}
                                                            >
                                                                <Text style={[
                                                                    styles.toneText,
                                                                    { color: active ? tColor : colors.muted }
                                                                ]}>
                                                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                                                </Text>
                                                                {isRecommended && (
                                                                    <View style={styles.starBadge}>
                                                                        <Text style={{ fontSize: 10 }}>⭐</Text>
                                                                    </View>
                                                                )}
                                                            </Pressable>
                                                        );
                                                    })}
                                                </View>
                                            </>
                                        )}
                                        
                                        <Text style={[styles.label, { marginTop: 12 }]}>Mensaje a Enviar:</Text>
                                        <TextInput
                                            value={editedText}
                                            onChangeText={setEditedText}
                                            style={styles.textArea}
                                            multiline
                                            textAlignVertical="top"
                                        />
                                    </>
                                ) : (
                                    <View style={{ gap: 7, paddingBottom: 10 }}>
                                        <Pressable 
                                            onPress={fetchMessages}
                                            style={({ pressed }) => [styles.aiBtn, pressed && { opacity: 0.8 }]}
                                        >
                                            <View style={styles.standardBtnContent}>
                                                <Text style={styles.aiBtnText}>✨ Redactar con IA (Recomendado)</Text>
                                            </View>
                                        </Pressable>

                                        <Pressable 
                                            onPress={() => {
                                                if (client && invoice) {
                                                    const defaultText = `Hola ${client.name}, te recordamos tu pago de ${invoice.amount} con fecha ${invoice.due}.`;
                                                    setEditedText(defaultText);
                                                    setMessages({ amigable: defaultText, formal: defaultText, urgente: defaultText, recommended: "amigable" });
                                                    setIsIAMode(false);
                                                }
                                            }} 
                                            style={({ pressed }) => [styles.genericBtn, pressed && { opacity: 0.8 }]}
                                        >
                                            <View style={styles.standardBtnContent}>
                                                <Text style={styles.genericBtnText}>💬 Mensaje Estándar</Text>
                                            </View>
                                        </Pressable>

                                        <Pressable 
                                            onPress={onClose} 
                                            style={({ pressed }) => [styles.genericBtn, pressed && { opacity: 0.8 }]}
                                        >
                                            <Text style={styles.genericBtnText}>Cancelar</Text>
                                        </Pressable>
                                    </View>
                                )}
                                </View>
                            </View>
                        </ScrollView>

                        {messages && (
                            <View style={styles.footer}>
                                <Pressable onPress={onClose} style={styles.cancelBtnFull}>
                                    <Text style={styles.cancelText}>Cancelar</Text>
                                </Pressable>

                                <Pressable 
                                    onPress={handleSend} 
                                    style={[styles.saveFull, loading && { opacity: 0.5 }, channel === "email" && { backgroundColor: colors.primary }]} 
                                    disabled={loading}
                                >
                                    <Text style={styles.saveText}>
                                        {channel === "whatsapp" ? "Enviar WhatsApp" : "Enviar Correo"}
                                    </Text>
                                </Pressable>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    </>
    );
}


const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 16 },
    card: { 
        backgroundColor: colors.card, 
        borderRadius: 16, 
        overflow: "hidden",
        maxHeight: "92%",
        flexShrink: 1,
    },
    scrollableContent: {
        flexShrink: 1,
    },
    cardContent: {
        paddingTop: 12,
        paddingBottom: 8,
        paddingHorizontal: 16,
    },
    title: { fontSize: 17, fontWeight: "900", color: colors.text, marginBottom: 1, textAlign: "center" },
    subtitle: { fontSize: 12, color: colors.muted, textAlign: "center", marginBottom: 4, paddingHorizontal: 10 },

    loadingBox: { padding: 40, alignItems: "center", gap: 16 },
    loadingText: { color: colors.primary, fontWeight: "800", fontSize: 16 },

    infoBox: { 
        backgroundColor: colors.primary + "15", 
        padding: 12, 
        borderRadius: 12, 
        marginBottom: 16 
    },
    infoText: { color: colors.text, fontSize: 14, lineHeight: 20 },

    label: { color: colors.muted, fontWeight: "800", marginBottom: 8 },
    
    toneRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
    toneBtn: {
        flex: 1,
        borderWidth: 2,
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: "center",
        position: "relative"
    },
    toneText: { fontWeight: "900", fontSize: 13 },
    starBadge: {
        position: "absolute",
        top: -6,
        right: -6,
        backgroundColor: "#FBBF24",
        borderRadius: 10,
        width: 18,
        height: 18,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#FFF"
    },

    textArea: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 12,
        minHeight: 120,
        color: colors.text,
        backgroundColor: "transparent",
        fontSize: 15,
        lineHeight: 22,
    },

    channelRow: { flexDirection: "row", gap: 8, marginTop: 4 },
    channelBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center"
    },
    channelBtnActive: {
        backgroundColor: colors.primary + "1A",
        borderColor: colors.primary
    },
    channelText: { fontWeight: "700", color: colors.muted },
    channelTextActive: { color: colors.primary },

    footer: {
        flexDirection: "row",
        gap: 12,
        paddingTop: 12,
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        marginTop: 8,
    },
    cancelText: { color: colors.text, fontWeight: "800", fontSize: 15 },
    saveText: { color: "#fff", fontWeight: "900", fontSize: 15 },
    aiBtn: {
        backgroundColor: colors.primary + "1A",
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 8, // Super compact
        alignItems: "center",
    },
    aiBtnText: { color: colors.primary, fontWeight: "900", fontSize: 15 },
    
    standardBtnContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    genericBtn: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingVertical: 8,
        alignItems: "center",
    },
    genericBtnText: { color: colors.text, fontWeight: "800", fontSize: 15 },

    cancelBtnFull: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
    },
    saveFull: { 
        flex: 1.2, 
        backgroundColor: "#22c55e",
        borderRadius: 12, 
        alignItems: "center", 
        justifyContent: "center",
        paddingVertical: 14,
    },
});
