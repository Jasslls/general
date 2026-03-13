import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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

import type { Client, Invoice, InvoiceRecurrence, InvoiceStatus } from "../models/types";
import { setItem } from "../services/storage";
import { lightColors, useAppColors } from "../themes/colors";
import { DateField } from "./DateField";
import { usePremium } from "../hooks/usePremium";
import { PaywallModal } from "./PaywallModal";


type Form = {
    clientId: string;
    desc: string;
    amount: string;
    due: string; // "YYYY-MM-DD"
    status: InvoiceStatus;
    recurrence: InvoiceRecurrence;
};

const KEY_CLIENTS_INTENT = "clients_intent_open_new_v1";

function onlyDigits(s: string) {
    return s.replace(/[^\d]/g, "");
}

function isValidYYYYMMDD(s: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function InvoiceFormModal({
    visible,
    onClose,
    onSave,
    clients,
    initial,
}: {
    visible: boolean;
    onClose: () => void;
    onSave: (data: Omit<Invoice, "id"> & { id?: string }) => void;
    clients: Client[];
    initial?: Invoice | null;
}) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const { isPremium } = usePremium();
    const [paywallVisible, setPaywallVisible] = useState(false);

    const [form, setForm] = useState<Form>({
        clientId: "",
        desc: "",
        amount: "",
        due: "",
        status: "Pendiente",
        recurrence: "none",
    });

    useEffect(() => {
        if (!visible) return;

        if (initial) {
            setForm({
                clientId: initial.clientId,
                desc: initial.desc ?? "",
                amount: String(initial.amount ?? ""),
                due: initial.due ?? "",
                status: initial.status,
                recurrence: initial.recurrence || "none",
            });
            return;
        }

        setForm({
            clientId: clients[0]?.id ?? "",
            desc: "",
            amount: "",
            due: "",
            status: "Pendiente",
            recurrence: "none",
        });
    }, [visible, initial, clients]);

    // Si borraste clientes y quedó apuntando a uno inexistente
    useEffect(() => {
        if (!visible) return;
        if (!clients.length) return;
        const exists = clients.some((c) => c.id === form.clientId);
        if (!exists) setForm((p) => ({ ...p, clientId: clients[0]?.id ?? "" }));
    }, [clients, visible]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectedClient = useMemo(
        () => clients.find((c) => c.id === form.clientId),
        [clients, form.clientId]
    );

    function set<K extends keyof Form>(k: K, v: Form[K]) {
        if (k === "recurrence" && v !== "none" && !isPremium) {
            setPaywallVisible(true);
            return;
        }

        setForm((p) => {
            const next = { ...p, [k]: v };
            
            // Auto Pendiente si la fecha es en el futuro
            if (k === "due") {
                const today = new Date().toISOString().split("T")[0];
                if (v > today) {
                    next.status = "Pendiente";
                }
            }
            
            return next;
        });
    }

    async function goToClientsAndOpenNew() {
        // ✅ marca “al entrar a clientes abrir modal”
        await setItem(KEY_CLIENTS_INTENT, true);

        // ✅ cierra el modal actual y cambia de pestaña
        onClose();
        router.push("/clientes");
    }

    function save() {
        if (!clients.length) return;

        const amt = Number(form.amount);
        if (!form.clientId) return;
        if (!form.desc.trim()) return;
        if (!Number.isFinite(amt) || amt <= 0) return;
        if (!isValidYYYYMMDD(form.due)) return;

        onSave({
            id: initial?.id,
            clientId: form.clientId,
            desc: form.desc.trim(),
            amount: amt,
            due: form.due,
            status: form.status,
            recurrence: form.recurrence,
        });

        onClose();
    }

    return (
        <>
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    style={{ width: "100%" }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
                >
                    <View style={styles.card}>
                        <Text style={styles.title}>{initial ? "Editar Factura" : "Nueva Factura"}</Text>

                        {!clients.length ? (
                            <>
                                <View style={styles.emptyBox}>
                                    <Text style={styles.emptyTitle}>No hay clientes</Text>
                                    <Text style={styles.emptyText}>
                                        Primero crea un cliente para poder registrar facturas.
                                    </Text>
                                </View>

                                <View style={styles.footer}>
                                    <Pressable onPress={onClose} style={styles.cancel}>
                                        <Text style={styles.cancelText}>Cerrar</Text>
                                    </Pressable>

                                    <Pressable onPress={goToClientsAndOpenNew} style={styles.save}>
                                        <Text style={styles.saveText}>Ir a Clientes</Text>
                                    </Pressable>
                                </View>
                            </>
                        ) : (
                            <>
                                <ScrollView
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingBottom: 12 }}
                                >
                                    <Text style={styles.label}>Cliente</Text>

                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={{ gap: 10, paddingVertical: 6 }}
                                        keyboardShouldPersistTaps="handled"
                                    >
                                        {clients.map((c) => {
                                            const active = c.id === form.clientId;
                                            return (
                                                <Pressable
                                                    key={c.id}
                                                    onPress={() => set("clientId", c.id)}
                                                    style={[
                                                        styles.pill,
                                                        {
                                                            borderColor: active ? colors.primary : colors.border,
                                                            backgroundColor: active ? colors.primary + "1A" : "transparent",
                                                        },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[styles.pillText, { color: active ? colors.primary : colors.text }]}
                                                        numberOfLines={1}
                                                    >
                                                        {c.name}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </ScrollView>

                                    {!!selectedClient && <Text style={styles.hint}>{selectedClient.company}</Text>}

                                    <Text style={styles.label}>Descripción</Text>
                                    <TextInput
                                        value={form.desc}
                                        onChangeText={(v) => set("desc", v)}
                                        style={styles.input}
                                        placeholder="Ej: Mantenimiento mensual"
                                        placeholderTextColor={colors.muted}
                                    />

                                    <Text style={styles.label}>Monto (USD)</Text>
                                    <TextInput
                                        value={form.amount}
                                        onChangeText={(v) => set("amount", onlyDigits(v))}
                                        style={styles.input}
                                        keyboardType="numeric"
                                        placeholder="Ej: 15000"
                                        placeholderTextColor={colors.muted}
                                    />

                                    {/* Calendario */}
                                    <DateField label="Vencimiento" value={form.due} onChange={(ymd) => set("due", ymd)} />

                                    <Text style={styles.label}>Estado</Text>
                                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                                        {((form.due > new Date().toISOString().split("T")[0] ? ["Pendiente"] : ["Pendiente", "Vencida", "Cobrada"]) as InvoiceStatus[]).map((s) => {
                                            const active = s === form.status;
                                            return (
                                                <Pressable
                                                    key={s}
                                                    onPress={() => set("status", s)}
                                                    style={[
                                                        styles.pill,
                                                        {
                                                            borderColor: active ? colors.primary : colors.border,
                                                            backgroundColor: active ? colors.primary + "1A" : "transparent",
                                                        },
                                                    ]}
                                                >
                                                    <Text style={[styles.pillText, { color: active ? colors.primary : colors.text }]}>
                                                        {s}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>

                                    <Text style={styles.label}>Facturación Recurrente</Text>
                                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                                        {[
                                            { val: "none", label: "Ninguna" },
                                            { val: "semanal", label: "Semanal" },
                                            { val: "mensual", label: "Mensual" },
                                            { val: "anual", label: "Anual" },
                                        ].map((opt) => {
                                            const active = opt.val === form.recurrence;
                                            return (
                                                <Pressable
                                                    key={opt.val}
                                                    onPress={() => set("recurrence", opt.val as InvoiceRecurrence)}
                                                    style={[
                                                        styles.pill,
                                                        {
                                                            borderColor: active ? colors.primary : colors.border,
                                                            backgroundColor: active ? colors.primary + "1A" : "transparent",
                                                        },
                                                    ]}
                                                >
                                                    <Text style={[styles.pillText, { color: active ? colors.primary : colors.text }]}>
                                                        {opt.label}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                    
                                    {form.recurrence !== "none" && (
                                        <Text style={styles.recurrenceHint}>
                                            ⏱ Se creará una nueva factura automáticamente cada {
                                                form.recurrence === "semanal" ? "semana" : 
                                                form.recurrence === "mensual" ? "mes" : "año"
                                            } después de la fecha de vencimiento inicial.
                                        </Text>
                                    )}
                                </ScrollView>

                                <View style={styles.footer}>
                                    <Pressable onPress={onClose} style={styles.cancel}>
                                        <Text style={styles.cancelText}>Cancelar</Text>
                                    </Pressable>

                                    <Pressable onPress={save} style={styles.save}>
                                        <Text style={styles.saveText}>Guardar</Text>
                                    </Pressable>
                                </View>
                            </>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>

        <PaywallModal 
            visible={paywallVisible} 
            onClose={() => setPaywallVisible(false)} 
            onActivated={() => setPaywallVisible(false)}
        />
        </>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 16 },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, maxHeight: "85%" },
    title: { fontSize: 18, fontWeight: "900", color: colors.text, marginBottom: 10 },

    label: { color: colors.muted, fontWeight: "800", marginTop: 10, marginBottom: 6 },
    hint: { color: colors.muted, marginBottom: 6, fontWeight: "600" },
    recurrenceHint: { 
        backgroundColor: colors.primary + "15", 
        color: colors.primary, 
        padding: 10, 
        borderRadius: 8, 
        fontWeight: "600",
        fontSize: 13,
        overflow: "hidden"
    },

    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        color: colors.text,
        backgroundColor: "transparent",
    },

    pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 180 },
    pillText: { fontWeight: "800" },

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
    cancelText: { color: colors.text, fontWeight: "800" },
    save: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, alignItems: "center", paddingVertical: 12 },
    saveText: { color: "#fff", fontWeight: "900" },

    emptyBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, marginTop: 10 },
    emptyTitle: { color: colors.text, fontWeight: "900", marginBottom: 4 },
    emptyText: { color: colors.muted, fontWeight: "600" },
});