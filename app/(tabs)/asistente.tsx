import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    Alert,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { ReminderModal } from "../../components/ReminderModal";
import { PaywallModal } from "../../components/PaywallModal";
import { usePremium } from "../../hooks/usePremium";
import { useAuth } from "../../context/AuthContext";
import type { Client, Invoice } from "../../models/types";
import { getAllInvoices, getClients } from "../../services/firestore";
import {
    askFinancialAssistant,
    type ChatMessage,
    type FinancialContext,
} from "../../services/gemini";
import { getTodayYMD } from "../../services/riskEngine";
import { lightColors, useAppColors } from "../../themes/colors";

function buildContext(clients: Client[], invoices: Invoice[]): FinancialContext {
    let pendingAmount = 0;
    let overdueAmount = 0;
    let collectedAmount = 0;
    let overdueCount = 0;
    let pendingCount = 0;

    const today = getTodayYMD();

    for (const inv of invoices) {
        const amt = inv.amount ?? 0;
        if (inv.status === "Cobrada") collectedAmount += amt;
        else if (inv.status === "Vencida" || (inv.status === "Pendiente" && inv.due < today)) {
            overdueAmount += amt;
            overdueCount++;
            pendingAmount += amt;
        } else {
            pendingAmount += amt;
            pendingCount++;
        }
    }

    const clientMap = new Map<string, Client>(clients.map((c) => [c.id, c]));
    const topDebtors = invoices
        .filter((i) => i.status !== "Cobrada")
        .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
        .slice(0, 5)
        .map((inv) => {
            const c = clientMap.get(inv.clientId);
            const daysOverdue = inv.due
                ? Math.max(0, (new Date(today).getTime() - new Date(inv.due).getTime()) / 86_400_000)
                : 0;
            return { name: c?.name ?? "Desconocido", amount: inv.amount ?? 0, status: inv.status, daysOverdue };
        });

    const recentPayments = invoices
        .filter((i) => i.status === "Cobrada")
        .sort((a, b) => String(b.due).localeCompare(String(a.due)))
        .slice(0, 4)
        .map((inv) => ({
            client: clientMap.get(inv.clientId)?.name ?? "Desconocido",
            amount: inv.amount ?? 0,
            date: inv.due ?? "",
        }));

    const upcomingInvoices = invoices
        .filter((i) => {
            if (i.status !== "Pendiente" || !i.due) return false;
            const diffMs = new Date(i.due).getTime() - new Date(today).getTime();
            return diffMs >= 0 && diffMs / 86_400_000 <= 30;
        })
        .sort((a, b) => String(a.due).localeCompare(String(b.due)))
        .slice(0, 8)
        .map((inv) => {
            const c = clientMap.get(inv.clientId);
            const daysLeft = Math.round((new Date(inv.due!).getTime() - new Date(today).getTime()) / 86_400_000);
            return { client: c?.name ?? "Desconocido", amount: inv.amount ?? 0, dueDate: inv.due!, daysLeft };
        });

    return {
        totalClients: clients.length, totalInvoices: invoices.length,
        pendingAmount, overdueAmount, collectedAmount, overdueCount, pendingCount,
        topDebtors, recentPayments, upcomingInvoices,
    };
}

/** Returns the first client whose name appears (case-insensitive) in the given text */
function detectMentionedClient(text: string, clients: Client[]): Client | null {
    const lower = text.toLowerCase();
    return clients.find((c) => c.name && lower.includes(c.name.toLowerCase())) ?? null;
}

/** Gets the most urgent unpaid invoice for a client */
function getMostUrgentInvoice(clientId: string, invoices: Invoice[]): Invoice | null {
    const today = getTodayYMD();
    const pending = invoices
        .filter((i) => i.clientId === clientId && i.status !== "Cobrada")
        .sort((a, b) => {
            // vencidas first, then by due date asc
            const aOver = a.status === "Vencida" || a.due < today ? 0 : 1;
            const bOver = b.status === "Vencida" || b.due < today ? 0 : 1;
            if (aOver !== bOver) return aOver - bOver;
            return String(a.due).localeCompare(String(b.due));
        });
    return pending[0] ?? null;
}

const QUICK_QUESTIONS = [
    "¿Cuánto dinero está vencido?",
    "¿Quién me debe más?",
    "¿Qué facturas vencen pronto?",
    "Ver mis reportes de cobranza",
    "¿Qué mensaje le envío al cliente que más debe?",
    "Quiero crear una nueva factura",
];

interface ChatAction {
    type: "collect" | "navigate" | "danger";
    label: string;
    payload: any;
}

interface MessageEntry {
    msg: ChatMessage;
    actions?: ChatAction[];
}

export default function AsistenteScreen() {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const { user } = useAuth();
    const uid = user?.id;
    const { isPremium, loading: premiumLoading } = usePremium();
    const [paywallVisible, setPaywallVisible] = useState(false);

    const [entries, setEntries] = useState<MessageEntry[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [contextLoading, setContextLoading] = useState(true);
    const [ctx, setCtx] = useState<FinancialContext | null>(null);
    const [clients, setClients] = useState<Client[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);

    // ReminderModal state
    const [modalVisible, setModalVisible] = useState(false);
    const [modalClient, setModalClient] = useState<Client | null>(null);
    const [modalInvoice, setModalInvoice] = useState<Invoice | null>(null);

    const scrollRef = useRef<ScrollView>(null);
    const historyForAI = useMemo(() => entries.map((e) => e.msg), [entries]);

    useFocusEffect(
        useCallback(() => {
            if (!uid) return;
            (async () => {
                setContextLoading(true);
                try {
                    const [c, invs] = await Promise.all([getClients(uid), getAllInvoices(uid)]);
                    setClients(c);
                    setInvoices(invs);
                    setCtx(buildContext(c, invs));
                } finally {
                    setContextLoading(false);
                }
            })();
        }, [uid])
    );

    const handleAction = (action: ChatAction) => {
        if (action.type === "collect") {
            const { client, invoice } = action.payload;
            setModalClient(client);
            setModalInvoice(invoice);
            setModalVisible(true);
        } else if (action.type === "navigate") {
            const { route, params } = action.payload;
            router.push({ pathname: route, params });
        } else if (action.type === "danger") {
            // Danger = destructive confirmation
            const { message, onConfirm } = action.payload;
            Alert.alert("Confirmar", message, [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: onConfirm },
            ]);
        }
    };

    const sendMessage = async (text: string) => {
        if (!text.trim() || loading || !ctx) return;
        const userEntry: MessageEntry = { msg: { role: "user", text: text.trim() } };
        const newEntries = [...entries, userEntry];
        setEntries(newEntries);
        setInput("");
        setLoading(true);
        try {
            const reply = await askFinancialAssistant(text.trim(), historyForAI, ctx);

            // Detect specialized intents
            const actions: ChatAction[] = [];
            
            // 1. Collection Intent (notify a specific client)
            const mentionedClient = detectMentionedClient(reply, clients);
            const notifyIntent = /mensaje|notific|envi[ao]|record[ao]|avis[ao]|cobre|cobra|cobro|whatsapp/i.test(text);
            const actionInvoice = mentionedClient ? getMostUrgentInvoice(mentionedClient.id, invoices) : null;
            if (mentionedClient && actionInvoice && (notifyIntent || /mensaje|notific|enviar?|recordar?|avisar?/i.test(reply))) {
                actions.push({
                    type: "collect",
                    label: `📲 Notificar a ${mentionedClient.name}`,
                    payload: { client: mentionedClient, invoice: actionInvoice }
                });
            }

            // 2. View/Edit a specific client
            if (mentionedClient && /editar|ver|detalle|perfil|informaci[oó]n|cliente/i.test(text + " " + reply)) {
                actions.push({
                    type: "navigate",
                    label: `👤 Ver a ${mentionedClient.name}`,
                    payload: { route: "/(tabs)/clientes", params: { q: mentionedClient.name, highlightId: mentionedClient.id } }
                });
            }

            // 3. Delete client intent
            if (mentionedClient && /elimin|borrar|quitar|remov/i.test(text)) {
                actions.push({
                    type: "danger",
                    label: `🗑 Eliminar cliente`,
                    payload: {
                        message: `¿Eliminar a ${mentionedClient.name}? Esta acción no se puede deshacer.`,
                        onConfirm: () => router.push({ pathname: "/(tabs)/clientes", params: { deleteId: mentionedClient.id } })
                    }
                });
            }

            // 4. Reports Intent
            if (/reporte|estadistica|gr[aá]fic|analisis|cuanto debo|cuanto me deben|resumen|flujo|ingresos|facturaci[oó]n/i.test(text + " " + reply)) {
                actions.push({
                    type: "navigate",
                    label: "📊 Abrir Reportes",
                    payload: { route: "/reportes" }
                });
            }

            // 5. Overdue / Priority Invoices Intent
            if (/vencid|atraso|mora|deudores|prioridad|urgen/i.test(text + " " + reply)) {
                actions.push({
                    type: "navigate",
                    label: "📑 Ver Facturas Vencidas",
                    payload: { 
                        route: "/(tabs)/facturas", 
                        params: { 
                            filter: "Vencida",
                            q: mentionedClient ? mentionedClient.name : undefined 
                        } 
                    }
                });
            }

            // 6. New invoice intent
            if (/crear|nueva factura|agregar factura|registrar factura|factura para/i.test(text)) {
                actions.push({
                    type: "navigate",
                    label: "➕ Nueva Factura",
                    payload: { route: "/(tabs)/facturas" }
                });
            }

            // 7. New client intent
            if (/crear|nuevo cliente|agregar cliente|registrar cliente/i.test(text)) {
                actions.push({
                    type: "navigate",
                    label: "🧑‍💼 Nuevo Cliente",
                    payload: { route: "/(tabs)/clientes", params: { openNew: "1" } }
                });
            }

            const assistEntry: MessageEntry = {
                msg: { role: "assistant", text: reply },
                actions: actions.length > 0 ? actions : undefined
            };
            setEntries([...newEntries, assistEntry]);
        } catch (e: any) {
            setEntries([...newEntries, { msg: { role: "assistant", text: e?.message ?? "Ocurrió un error inesperado. Intenta de nuevo." } }]);
        } finally {
            setLoading(false);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
        }
    };

    const openCollection = (client: Client, invoice: Invoice) => {
        setModalClient(client);
        setModalInvoice(invoice);
        setModalVisible(true);
    };

    // ── Premium lock screen ──────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <View style={styles.header}>
                <View style={styles.avatarBox}>
                    <Text style={styles.avatarText}>✦</Text>
                </View>
                <View>
                    <Text style={styles.h1}>Fijito</Text>
                    <Text style={styles.sub}>Asistente Financiero IA</Text>
                </View>
            </View>

            {!premiumLoading && !isPremium ? (
                <View style={styles.lockScreen}>
                    <Text style={styles.lockCrown}>👑</Text>
                    <Text style={styles.lockTitle}>Fijito es Premium</Text>
                    <Text style={styles.lockDesc}>
                        Tu asistente financiero con inteligencia artificial. Responde preguntas, sugiere cobros y envía mensajes inteligentes.
                    </Text>

                    <View style={styles.lockBenefits}>
                        {["Consultas en lenguaje natural", "Generación de mensajes IA", "Acciones directas desde el chat", "Sugerencias de cobranza"].map((b) => (
                            <View key={b} style={styles.lockBenefitRow}>
                                <Text style={styles.lockCheck}>✓</Text>
                                <Text style={styles.lockBenefitText}>{b}</Text>
                            </View>
                        ))}
                    </View>

                    <Pressable
                        onPress={() => setPaywallVisible(true)}
                        style={({ pressed }) => [styles.lockCTA, pressed && { opacity: 0.85 }]}
                    >
                        <Text style={styles.lockCTAText}>👑 Desbloquear Fijito</Text>
                    </Pressable>
                </View>
            ) : (
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={0}
                >
                    <ScrollView
                        ref={scrollRef}
                        style={styles.chatArea}
                        contentContainerStyle={styles.chatContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Welcome */}
                        {entries.length === 0 && !contextLoading && (
                            <View style={styles.welcomeWrap}>
                                <View style={[styles.bubble, styles.assistBubble]}>
                                    <Text style={styles.assistText}>
                                        ¡Hola! Soy <Text style={{ fontWeight: "900" }}>Fijito</Text>, tu asistente financiero de PagoFijoHN.
                                        Puedo ayudarte a entender tus cobros, analizar deudores y hasta iniciar la cobranza de una factura. ¿En qué te puedo ayudar?
                                    </Text>
                                </View>
                                <Text style={styles.quickTitle}>Preguntas frecuentes:</Text>
                                <View style={styles.quickGrid}>
                                    {QUICK_QUESTIONS.map((q) => (
                                        <Pressable key={q} onPress={() => sendMessage(q)} style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.7 }]}>
                                            <Text style={styles.quickText}>{q}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        )}

                        {contextLoading && (
                            <View style={styles.ctxLoading}>
                                <ActivityIndicator color={colors.primary} />
                                <Text style={styles.ctxLoadText}>Cargando datos financieros...</Text>
                            </View>
                        )}

                        {/* Messages */}
                        {entries.map((entry, i) => (
                            <View key={i} style={[styles.bubbleWrap, entry.msg.role === "user" ? styles.userWrap : styles.assistWrap]}>
                                <View style={[styles.bubble, entry.msg.role === "user" ? styles.userBubble : styles.assistBubble]}>
                                    <Text style={entry.msg.role === "user" ? styles.userText : styles.assistText}>
                                        {entry.msg.text}
                                    </Text>
                                </View>

                                {/* Actions */}
                                {entry.msg.role === "assistant" && entry.actions && (
                                    <View style={styles.actionsRow}>
                                        {entry.actions.map((act, idx) => (
                                            <Pressable
                                                key={idx}
                                                onPress={() => handleAction(act)}
                                                style={({ pressed }) => [
                                                    styles.actionChip, 
                                                    act.type === "navigate" && styles.navChip,
                                                    act.type === "danger" && styles.dangerChip,
                                                    pressed && { opacity: 0.75 }
                                                ]}
                                            >
                                                <Text style={[
                                                    styles.actionChipText, 
                                                    act.type === "navigate" && styles.navChipText,
                                                    act.type === "danger" && styles.dangerChipText,
                                                ]}>
                                                    {act.label}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ))}

                        {/* Typing */}
                        {loading && (
                            <View style={[styles.bubbleWrap, styles.assistWrap]}>
                                <View style={[styles.bubble, styles.assistBubble, styles.typingBubble]}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <Text style={[styles.assistText, { marginLeft: 8 }]}>Analizando...</Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Input bar */}
                    <View style={styles.inputBar}>
                        <TextInput
                            value={input}
                            onChangeText={setInput}
                            placeholder="Pregúntale a Fijito..."
                            placeholderTextColor={colors.muted}
                            style={styles.input}
                            multiline
                            maxLength={500}
                            onSubmitEditing={() => sendMessage(input)}
                            returnKeyType="send"
                            blurOnSubmit
                        />
                        <Pressable
                            onPress={() => sendMessage(input)}
                            disabled={loading || !input.trim() || !ctx}
                            style={({ pressed }) => [
                                styles.sendBtn,
                                (loading || !input.trim() || !ctx) && { opacity: 0.4 },
                                pressed && { opacity: 0.7 },
                            ]}
                        >
                            <Text style={styles.sendIcon}>➤</Text>
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            )}

            <ReminderModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                client={modalClient}
                invoice={modalInvoice}
                onPremiumRequired={() => setPaywallVisible(true)}
            />

            <PaywallModal
                visible={paywallVisible}
                onClose={() => setPaywallVisible(false)}
                onActivated={() => setPaywallVisible(false)}
            />

        </SafeAreaView>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        backgroundColor: colors.card,
    },
    avatarBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 20, color: "#fff" },
    h1: { fontSize: 17, fontWeight: "900", color: colors.text },
    sub: { fontSize: 12, color: colors.muted, fontWeight: "600", marginTop: 1 },

    chatArea: { flex: 1 },
    chatContent: { padding: 16, gap: 12, paddingBottom: 8 },

    welcomeWrap: { gap: 12 },
    quickTitle: { color: colors.muted, fontWeight: "800", fontSize: 13, marginTop: 4 },
    quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    quickBtn: { backgroundColor: colors.primary + "18", borderWidth: 1, borderColor: colors.primary + "40", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
    quickText: { color: colors.primary, fontWeight: "700", fontSize: 13 },

    ctxLoading: { alignItems: "center", gap: 8, paddingTop: 40 },
    ctxLoadText: { color: colors.muted, fontWeight: "600" },

    bubbleWrap: { width: "100%", gap: 6 },
    userWrap: { alignItems: "flex-end" },
    assistWrap: { alignItems: "flex-start" },

    bubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
    userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    assistBubble: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
    typingBubble: { flexDirection: "row", alignItems: "center" },
    userText: { color: "#fff", fontWeight: "600", fontSize: 15, lineHeight: 22 },
    assistText: { color: colors.text, fontWeight: "500", fontSize: 15, lineHeight: 22 },
 
    actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, alignSelf: "flex-start" },
    actionChip: {
        backgroundColor: "#22c55e15",
        borderWidth: 1,
        borderColor: "#22c55e",
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 7,
    },
    actionChipText: { color: "#22c55e", fontWeight: "800", fontSize: 13 },
    navChip: {
        backgroundColor: colors.primary + "15",
        borderColor: colors.primary,
    },
    navChipText: { color: colors.primary },
    dangerChip: {
        backgroundColor: colors.danger + "15",
        borderColor: colors.danger,
    },
    dangerChipText: { color: colors.danger },

    inputBar: {
        flexDirection: "row", alignItems: "flex-end", gap: 10,
        padding: 12, borderTopWidth: 1, borderTopColor: colors.border,
        backgroundColor: colors.card,
    },
    input: {
        flex: 1, minHeight: 44, maxHeight: 120,
        backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
        borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
        color: colors.text, fontSize: 15, fontWeight: "500",
    },
    sendBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    sendIcon: { color: "#fff", fontSize: 18, fontWeight: "900" },

    // ── Premium Lock Screen ──
    lockScreen: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        gap: 16,
    },
    lockCrown: { fontSize: 64 },
    lockTitle: { fontSize: 22, fontWeight: "900", color: colors.text, textAlign: "center" },
    lockDesc: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 22, fontWeight: "600" },
    lockBenefits: { width: "100%", gap: 10, marginTop: 4 },
    lockBenefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    lockCheck: { color: "#22c55e", fontWeight: "900", fontSize: 18, width: 24 },
    lockBenefitText: { color: colors.text, fontWeight: "600", fontSize: 14 },
    lockCTA: {
        backgroundColor: colors.primary,
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 32,
        alignItems: "center",
        marginTop: 8,
        width: "100%",
    },
    lockCTAText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
