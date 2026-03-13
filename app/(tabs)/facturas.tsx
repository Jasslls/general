import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { InvoiceCard } from "../../components/InvoiceCard";
import { InvoiceFormModal } from "../../components/InvoiceFormModal";
import { PaywallModal } from "../../components/PaywallModal";
import { ReminderModal } from "../../components/ReminderModal";

import type { Client, Invoice, InvoiceStatus } from "../../models/types";
import {
    addInvoice,
    deleteInvoice,
    getAllInvoices,
    getClients,
    pushActivity,
    updateInvoice
} from "../../services/firestore";
import { generateInvoicePDF } from "../../services/pdf";
import { setItem } from "../../services/storage";
import { syncBusinessIntelligence } from "../../services/sync";
import { lightColors, useAppColors } from "../../themes/colors";
import { openWhatsApp } from "../../utils/whatsapp";
import { useAuth } from "../../context/AuthContext";

const KEY_CLIENTS_INTENT = "clients_intent_open_new_v1";

function money(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function prettyDue(due: string) {
    const [y, m, d] = String(due ?? "").split("-").map((x) => Number(x));
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    if (!y || !m || !d) return `Vence: ${due}`;
    return `Vence: ${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}

function toDayKeyLocal(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function isValidYYYYMMDD(s: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function cmpYmd(a: string, b: string) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

// ✅ Auto: Pendiente -> Vencida si ya pasó la fecha (no toca Cobrada)
function getNormalizedInvoices(invoices: Invoice[], todayKey: string) {
    return invoices.map((inv) => {
        if (inv.status === "Cobrada") return inv;
        if (!inv.due || !isValidYYYYMMDD(inv.due)) return inv;

        const isPast = cmpYmd(inv.due, todayKey) === -1;
        if (isPast && inv.status !== "Vencida") {
            return { ...inv, status: "Vencida" as const };
        }
        return inv;
    });
}

// ✅ Orden pro (solo UI)
function sortInvoicesPro(a: Invoice, b: Invoice) {
    const rank = (s: InvoiceStatus) => (s === "Vencida" ? 0 : s === "Pendiente" ? 1 : 2);

    const ra = rank(a.status);
    const rb = rank(b.status);
    if (ra !== rb) return ra - rb;

    const ad = a.due && isValidYYYYMMDD(a.due) ? a.due : "9999-12-31";
    const bd = b.due && isValidYYYYMMDD(b.due) ? b.due : "9999-12-31";

    if (a.status === "Vencida" && b.status === "Vencida") return cmpYmd(ad, bd); // vieja primero
    if (a.status === "Pendiente" && b.status === "Pendiente") return cmpYmd(ad, bd); // próxima primero
    if (a.status === "Cobrada" && b.status === "Cobrada") return cmpYmd(bd, ad); // reciente primero
    return 0;
}

export default function FacturasScreen() {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const { user } = useAuth();
    const uid = user?.id;

    const [clients, setClients] = useState<Client[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [filter, setFilter] = useState<"Todos" | InvoiceStatus>("Todos");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Invoice | null>(null);

    // ReminderModal state
    const [reminderModalOpen, setReminderModalOpen] = useState(false);
    const [reminderClient, setReminderClient] = useState<Client | null>(null);
    const [reminderInvoice, setReminderInvoice] = useState<Invoice | null>(null);
    const [paywallVisible, setPaywallVisible] = useState(false);


    async function loadAll() {
        if (!uid) return;
        setLoading(true);
        try {
            const [c, invs] = await Promise.all([
                getClients(uid),
                getAllInvoices(uid)
            ]);
            setClients(c);

            const todayKey = toDayKeyLocal(new Date());
            const normalized = getNormalizedInvoices(invs, todayKey);
            setInvoices(normalized);
        } catch (error) {
            console.error("Error loading facturas data:", error);
        } finally {
            setLoading(false);
        }
    }

    useFocusEffect(
        React.useCallback(() => {
            loadAll();
        }, [uid])
    );

    const clientById = useMemo(() => {
        const m = new Map<string, Client>();
        clients.forEach((c) => m.set(c.id, c));
        return m;
    }, [clients]);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();

        const base = invoices.filter((x) => {
            const c = clientById.get(x.clientId);
            const byText =
                !s ||
                String(x.id ?? "").toLowerCase().includes(s) ||
                String(x.desc ?? "").toLowerCase().includes(s) ||
                (c?.name ?? "").toLowerCase().includes(s) ||
                (c?.company ?? "").toLowerCase().includes(s);

            const byFilter = filter === "Todos" ? true : x.status === filter;
            return byText && byFilter;
        });

        return [...base].sort(sortInvoicesPro);
    }, [q, filter, invoices, clientById]);

    function nextInvoiceId() {
        const nums = invoices
            .map((x) => Number(String(x.id ?? "").split("-").pop()))
            .filter((n) => Number.isFinite(n));
        const next = (nums.length ? Math.max(...nums) : 0) + 1;
        return `FAC-2026-${String(next).padStart(3, "0")}`;
    }

    // ✅ Si no hay clientes, NO abrir modal: ir a Clientes y abrir modal allá
    async function openNew() {
        if (!clients.length) {
            await setItem(KEY_CLIENTS_INTENT, true);
            router.push("/clientes");
            return;
        }
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(inv: Invoice) {
        setEditing(inv);
        setModalOpen(true);
    }

    async function saveInvoiceData(data: Omit<Invoice, "id"> & { id?: string }) {
        if (!uid) return;
        try {
            if (editing?.id) {
                await updateInvoice(uid, data.clientId, editing.id, {
                    desc: data.desc,
                    amount: data.amount,
                    due: data.due,
                    status: data.status
                });

                await pushActivity(uid, {
                    type: "invoice_updated",
                    invoiceId: editing.id,
                    clientId: data.clientId,
                    amount: data.amount,
                    status: data.status,
                    desc: data.desc,
                    due: data.due,
                    ts: new Date().toISOString()
                });
            } else {
                const id = nextInvoiceId();
                await addInvoice(uid, data.clientId, {
                    desc: data.desc,
                    amount: data.amount,
                    due: data.due,
                    status: data.status
                });

                await pushActivity(uid, {
                    type: "invoice_created",
                    invoiceId: id,
                    clientId: data.clientId,
                    amount: data.amount,
                    status: data.status,
                    desc: data.desc,
                    due: data.due,
                    ts: new Date().toISOString()
                });
            }
            setModalOpen(false);
            await syncBusinessIntelligence(uid); // Update Risk Scores
            loadAll();
        } catch (error) {
            Alert.alert("Error", "No se pudo guardar la factura.");
        }
    }

    async function markPaid(inv: Invoice) {
        if (!uid || inv.status === "Cobrada") return;

        const run = async (photoUri?: string) => {
            try {
                await updateInvoice(uid, inv.clientId, inv.id, { 
                    status: "Cobrada",
                    proofUri: photoUri
                });
                await pushActivity(uid, {
                    type: "invoice_paid",
                    invoiceId: inv.id,
                    clientId: inv.clientId,
                    amount: inv.amount,
                    status: "Cobrada",
                    desc: inv.desc,
                    due: inv.due,
                    ts: new Date().toISOString(),
                    proofUri: photoUri
                });
                await syncBusinessIntelligence(uid); // Update Risk Scores
                loadAll();
            } catch (error) {
                Alert.alert("Error", "No se pudo marcar como cobrada.");
            }
        };

        const pickImageAndPaid = async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.7,
            });

            if (!result.canceled) {
                run(result.assets[0].uri);
            } else {
                run(); // Mark as paid without photo
            }
        };

        if (Platform.OS === "web") return run();

        Alert.alert(
            "Marcar como cobrada", 
            `¿Marcar ${inv.id} como cobrada?`, 
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Cobrar", onPress: () => run() },
                { text: "Subir Comprobante", onPress: pickImageAndPaid },
            ]
        );
    }

    async function handleDeleteInvoice(inv: Invoice) {
        if (!uid) return;
        const run = async () => {
            try {
                await deleteInvoice(uid, inv.clientId, inv.id);
                await pushActivity(uid, {
                    type: "invoice_deleted",
                    invoiceId: inv.id,
                    clientId: inv.clientId,
                    amount: inv.amount,
                    status: inv.status,
                    desc: inv.desc,
                    due: inv.due,
                    ts: new Date().toISOString()
                });
                await syncBusinessIntelligence(uid); // Update Risk Scores
                loadAll();
            } catch (error) {
                Alert.alert("Error", "No se pudo eliminar la factura.");
            }
        };

        if (Platform.OS === "web") return run();

        Alert.alert("Eliminar factura", `¿Eliminar ${inv.id}?`, [
            { text: "Cancelar", style: "cancel" },
            { text: "Eliminar", style: "destructive", onPress: run },
        ]);
    }

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.h1}>Facturas</Text>
                        <Text style={styles.sub}>Cuentas por cobrar</Text>
                    </View>

                    <Pressable onPress={() => void openNew()} style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}>
                        <Text style={styles.newBtnText}>＋ Nueva</Text>
                    </Pressable>
                </View>

                <View style={styles.searchWrap}>
                    <Text style={styles.searchIcon}>🔎</Text>
                    <TextInput
                        value={q}
                        onChangeText={setQ}
                        placeholder="Buscar por número, cliente o descripción..."
                        placeholderTextColor={colors.muted}
                        style={styles.search}
                    />
                </View>

                <View style={styles.filterRow}>
                    {(["Todos", "Pendiente", "Vencida", "Cobrada"] as const).map((x) => {
                        const active = x === filter;
                        return (
                            <Pressable
                                key={x}
                                onPress={() => setFilter(x)}
                                style={[
                                    styles.filterPill,
                                    {
                                        borderColor: active ? colors.primary : colors.border,
                                        backgroundColor: active ? colors.primary + "1A" : "transparent",
                                    },
                                ]}
                            >
                                <Text style={[styles.filterText, { color: active ? colors.primary : colors.text }]}>{x}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                <View style={{ height: 12 }} />

                <View style={{ gap: 12 }}>
                    {filtered.map((inv) => {
                        const c = clientById.get(inv.clientId);
                        return (
                            <InvoiceCard
                                key={inv.id}
                                id={inv.id}
                                clientName={c ? (c.company ? `${c.company} - ${c.name}` : c.name) : "Cliente"}
                                desc={inv.desc}
                                amount={money(inv.amount)}
                                dueLabel={prettyDue(inv.due)}
                                status={inv.status}
                                onEdit={() => openEdit(inv)}
                                onDelete={() => handleDeleteInvoice(inv)}
                                onMarkPaid={() => markPaid(inv)}
                                proofUri={inv.proofUri}
                                onShare={() => {
                                    if (c) generateInvoicePDF(inv, c);
                                }}
                                onWhatsApp={() => {
                                    if (!c) return;
                                    setReminderClient(c);
                                    setReminderInvoice(inv);
                                    setReminderModalOpen(true);
                                }}
                            />
                        );
                    })}
                </View>

                <InvoiceFormModal
                    visible={modalOpen}
                    onClose={() => setModalOpen(false)}
                    onSave={saveInvoiceData}
                    clients={clients}
                    initial={editing}
                />

                <ReminderModal
                    visible={reminderModalOpen}
                    onClose={() => setReminderModalOpen(false)}
                    client={reminderClient}
                    invoice={reminderInvoice}
                    onPremiumRequired={() => setPaywallVisible(true)}
                />

                <PaywallModal
                    visible={paywallVisible}
                    onClose={() => setPaywallVisible(false)}
                    onActivated={() => setPaywallVisible(false)}
                />

            </ScrollView>
        </SafeAreaView>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    screen: { flex: 1, backgroundColor: colors.bg },

    headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
    h1: { fontSize: 22, fontWeight: "900", color: colors.text },
    sub: { color: colors.muted, marginTop: 4, fontWeight: "600" },

    newBtn: { backgroundColor: "#0B1220", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
    newBtnText: { color: "#fff", fontWeight: "900" },

    searchWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 46,
        marginBottom: 10,
    },
    searchIcon: { fontSize: 16 },
    search: { flex: 1, color: colors.text, fontWeight: "600" },

    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
    filterPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    filterText: { fontWeight: "900" },
});
