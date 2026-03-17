import { FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from "react-native";
import type { Invoice, InvoiceRecurrence, Activity } from "../models/types";
import { lightColors, useAppColors } from "../themes/colors";
import { useAuth } from "../context/AuthContext";
import { getInvoiceActivities } from "../services/firestore";

function money(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(dateStr: string) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateTime(dateStr: string) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const datePart = date.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const timePart = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return `${datePart}, ${timePart}`;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    invoice: Invoice | null;
    clientName: string;
    onAbonar: (invoice: Invoice, amount: number) => Promise<void>;
}

export function InvoiceDetailsModal({ visible, onClose, invoice, clientName, onAbonar }: Props) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const { user } = useAuth();
    const [abonoAmount, setAbonoAmount] = useState("");
    const [isAbonando, setIsAbonando] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActs, setLoadingActs] = useState(false);

    useEffect(() => {
        if (visible && invoice && user?.id) {
            setLoadingActs(true);
            getInvoiceActivities(user.id, invoice.id)
                .then(acts => {
                    const payments = acts.filter(a => a.type === "invoice_partial_paid" || a.type === "invoice_paid");
                    setActivities(payments);
                })
                .catch(console.error)
                .finally(() => setLoadingActs(false));
        } else if (!visible) {
            setActivities([]);
            setIsAbonando(false);
            setAbonoAmount("");
        }
    }, [visible, invoice?.id, user?.id]);

    if (!invoice) return null;

    const total = invoice.amount || 0;
    const paid = invoice.paidAmount || 0;
    const balance = Math.max(0, total - paid);
    
    // Si ya está cobrada o el balance es 0
    const isFullyPaid = invoice.status === "Cobrada" || balance === 0;

    const handleAbonar = async () => {
        const amt = parseFloat(abonoAmount);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert("Error", "Ingresa un monto válido");
            return;
        }
        if (amt > balance) {
            Alert.alert("Error", "El abono no puede ser mayor al saldo pendiente");
            return;
        }

        try {
            setLoading(true);
            await onAbonar(invoice, amt);
            setAbonoAmount("");
            setIsAbonando(false);

            if (user?.id) {
                const acts = await getInvoiceActivities(user.id, invoice.id);
                setActivities(acts.filter(a => a.type === "invoice_partial_paid" || a.type === "invoice_paid"));
            }
        } catch (error) {
            Alert.alert("Error", "No se pudo registrar el abono");
        } finally {
            setLoading(false);
        }
    };

    const recurrenceText: Record<string, string> = {
        "none": "No se repite",
        "semanal": "Semanalmente",
        "mensual": "Mensualmente",
        "anual": "Anualmente"
    };

    const isRecurring = invoice.recurrence && invoice.recurrence !== "none";

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Text style={styles.title}>Detalle de Factura</Text>
                    <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.id}>#{invoice.id}</Text>
                        <View style={[styles.statusBadge, {
                            backgroundColor: invoice.status === "Vencida" ? colors.danger + "20"
                                : invoice.status === "Cobrada" ? colors.success + "20"
                                    : colors.warning + "20"
                        }]}>
                            <Text style={[styles.statusText, {
                                color: invoice.status === "Vencida" ? colors.danger
                                    : invoice.status === "Cobrada" ? colors.success
                                        : colors.warning
                            }]}>{invoice.status}</Text>
                        </View>
                    </View>

                    <Text style={styles.client}>{clientName}</Text>
                    <Text style={styles.desc}>{invoice.desc}</Text>

                    <View style={styles.amountBox}>
                        <View style={styles.amountRow}>
                            <Text style={styles.amountLabel}>Total Factura</Text>
                            <Text style={styles.amountValue}>{money(total)}</Text>
                        </View>
                        <View style={styles.amountRow}>
                            <Text style={styles.amountLabel}>Pagado (Abonos)</Text>
                            <Text style={[styles.amountValue, { color: colors.success }]}>{money(paid)}</Text>
                        </View>
                        <View style={styles.amountDivider} />
                        <View style={styles.amountRow}>
                            <Text style={[styles.amountLabel, { fontWeight: "900", color: colors.text }]}>Saldo Pendiente</Text>
                            <Text style={[styles.amountValue, { fontSize: 24, color: invoice.status === "Vencida" ? colors.danger : colors.text }]}>
                                {money(balance)}
                            </Text>
                        </View>
                    </View>

                    {/* Frecuencia / Recurrencia */}
                    {isRecurring && (
                        <View style={styles.recurrenceBox}>
                            <View style={styles.recurrenceHeader}>
                                <MaterialIcons name="event-repeat" size={20} color={colors.primary} />
                                <Text style={styles.recurrenceTitle}>Factura Recurrente</Text>
                            </View>
                            <Text style={styles.recurrenceDesc}>
                                Esta factura se regenera <Text style={{fontWeight: "800"}}>{recurrenceText[invoice.recurrence!]}</Text>.
                                La próxima generación se basará en la fecha de vencimiento.
                            </Text>
                        </View>
                    )}

                    {!isRecurring && invoice.recurrence === "none" && (
                        <View style={styles.infoRow}>
                            <MaterialIcons name="event" size={20} color={colors.muted} />
                            <Text style={styles.infoText}>Vence: <Text style={{ fontWeight: "800" }}>{formatDate(invoice.due)}</Text></Text>
                        </View>
                    )}

                    {isRecurring && (
                        <View style={styles.infoRow}>
                            <MaterialIcons name="event" size={20} color={colors.muted} />
                            <Text style={styles.infoText}>Próximo pago: <Text style={{ fontWeight: "800" }}>{formatDate(invoice.due)}</Text></Text>
                        </View>
                    )}

                    {/* Area de Abonos */}
                    <View style={styles.abonoSection}>
                        <Text style={styles.sectionTitle}>Abonos y Pagos</Text>
                        
                        {!isFullyPaid && !isAbonando && (
                            <Pressable 
                                onPress={() => setIsAbonando(true)} 
                                style={({ pressed }) => [styles.abonarBtnInit, pressed && { opacity: 0.8 }]}
                            >
                                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                                <Text style={styles.abonarBtnInitText}>Registrar un abono</Text>
                            </Pressable>
                        )}

                        {loadingActs ? (
                            <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
                        ) : activities.length > 0 ? (
                            <View style={styles.actsList}>
                                {activities.map(act => {
                                    const isFullSync = act.type === "invoice_paid" && !act.desc?.includes("Abono");
                                    return (
                                        <View key={act.id} style={styles.actItem}>
                                            <View style={styles.actIconBox}>
                                                <Ionicons name={isFullSync ? "checkmark-done" : "cash-outline"} size={16} color={colors.primary} />
                                            </View>
                                            <View style={styles.actInfo}>
                                                <Text style={styles.actDesc}>{isFullSync ? "Pago completo" : "Abono registrado"}</Text>
                                                <Text style={styles.actDate}>{formatDateTime(act.ts)}</Text>
                                            </View>
                                            <Text style={styles.actAmount}>
                                                {isFullSync && act.amount ? money(act.amount) : (act.amount ? money(act.amount) : "")}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <Text style={styles.noActs}>Aún no hay abonos registrados.</Text>
                        )}

                        {isAbonando && (
                            <View style={styles.abonoForm}>
                                <Text style={styles.abonoFormLabel}>Monto a abonar:</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ej. 500.00"
                                    keyboardType="numeric"
                                    value={abonoAmount}
                                    onChangeText={setAbonoAmount}
                                    editable={!loading}
                                />
                                <View style={styles.abonoActions}>
                                    <Pressable 
                                        onPress={() => setIsAbonando(false)} 
                                        style={styles.cancelBtn}
                                        disabled={loading}
                                    >
                                        <Text style={styles.cancelBtnText}>Cancelar</Text>
                                    </Pressable>
                                    <Pressable 
                                        onPress={handleAbonar} 
                                        style={[styles.saveBtn, loading && { opacity: 0.5 }]}
                                        disabled={loading}
                                    >
                                        <Text style={styles.saveBtnText}>{loading ? "Guardando..." : "Guardar Abono"}</Text>
                                    </Pressable>
                                </View>
                            </View>
                        )}

                        {isFullyPaid && (
                            <View style={styles.fullyPaidBanner}>
                                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                                <Text style={styles.fullyPaidText}>Factura pagada en su totalidad.</Text>
                            </View>
                        )}
                    </View>

                </ScrollView>
            </View>
        </Modal>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        borderBottomWidth: 1,
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.text },
    closeBtn: { padding: 4 },
    content: { padding: 20 },
    
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    id: { fontSize: 14, fontWeight: "900", color: colors.muted },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    statusText: { fontSize: 12, fontWeight: "900" },

    client: { fontSize: 24, fontWeight: "900", color: colors.text, marginBottom: 4 },
    desc: { fontSize: 16, color: colors.text, fontWeight: "500", marginBottom: 24 },

    amountBox: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 24,
    },
    amountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
    amountLabel: { fontSize: 14, color: colors.muted, fontWeight: "700" },
    amountValue: { fontSize: 16, fontWeight: "900", color: colors.text },
    amountDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

    recurrenceBox: {
        backgroundColor: colors.primary + "10",
        borderWidth: 1,
        borderColor: colors.primary + "40",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    recurrenceHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    recurrenceTitle: { fontSize: 15, fontWeight: "900", color: colors.primary },
    recurrenceDesc: { fontSize: 14, color: colors.text, lineHeight: 20 },

    infoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24, paddingHorizontal: 4 },
    infoText: { fontSize: 15, color: colors.text },

    abonoSection: { marginTop: 8 },
    sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 16 },

    abonarBtnInit: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: colors.primary + "1A",
        borderWidth: 1,
        borderColor: colors.primary,
        borderStyle: "dashed",
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    abonarBtnInitText: { color: colors.primary, fontWeight: "800", fontSize: 15 },

    actsList: {
        gap: 12,
        marginBottom: 16,
    },
    actItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    actIconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary + "1A",
        alignItems: "center",
        justifyContent: "center",
    },
    actInfo: { flex: 1 },
    actDesc: { color: colors.text, fontWeight: "700", fontSize: 13 },
    actDate: { color: colors.muted, fontSize: 11, marginTop: 2 },
    actAmount: { color: colors.success, fontWeight: "900", fontSize: 14 },
    noActs: { color: colors.muted, fontSize: 13, fontStyle: "italic", marginBottom: 16 },

    abonoForm: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 16,
    },
    abonoFormLabel: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 8 },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: colors.text,
        marginBottom: 16,
        backgroundColor: colors.bg,
    },
    abonoActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
    cancelBtn: { padding: 12, borderRadius: 8 },
    cancelBtnText: { color: colors.danger, fontWeight: "700", fontSize: 14 },
    saveBtn: { backgroundColor: colors.primary, padding: 12, borderRadius: 8, paddingHorizontal: 20 },
    saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

    fullyPaidBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: colors.success + "1A",
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.success + "40",
    },
    fullyPaidText: { color: colors.success, fontWeight: "800", fontSize: 15 },
});
