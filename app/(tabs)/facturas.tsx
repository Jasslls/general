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

import { InvoiceCard } from "../../components/InvoiceCard";
import { InvoiceFormModal } from "../../components/InvoiceFormModal";
import type { Activity, Client, Invoice, InvoiceStatus } from "../../models/types";
import { generateInvoicePDF } from "../../services/pdf";
import { getItem, getItemNullable, setItem } from "../../services/storage";
import { colors } from "../../themes/colors";
import { openWhatsApp } from "../../utils/whatsapp";

const KEY_CLIENTS = "clients_v1";
const KEY_INVOICES = "invoices_v1";
const KEY_ACTIVITY = "activity_v1";
const KEY_CLIENTS_INTENT = "clients_intent_open_new_v1";

const SEED: Invoice[] = [
    { id: "FAC-2026-001", clientId: "1", desc: "Servicios de consultoría - Enero 2026", amount: 25000, due: "2026-02-14", status: "Vencida" },
    { id: "FAC-2026-002", clientId: "2", desc: "Materiales construcción - Lote A", amount: 45000, due: "2026-02-19", status: "Pendiente" },
    { id: "FAC-2026-003", clientId: "3", desc: "Desarrollo de software - Fase 1", amount: 78000, due: "2026-02-07", status: "Pendiente" },
    { id: "FAC-2026-004", clientId: "4", desc: "Mantenimiento equipos - Diciembre", amount: 15000, due: "2026-01-19", status: "Vencida" },
];

function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

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
function normalizeOverdue(invoices: Invoice[], todayKey: string) {
    let changed = false;

    const next = invoices.map((inv) => {
        if (inv.status === "Cobrada") return inv;
        if (!inv.due || !isValidYYYYMMDD(inv.due)) return inv;

        const isPast = cmpYmd(inv.due, todayKey) === -1;
        if (isPast && inv.status !== "Vencida") {
            changed = true;
            return { ...inv, status: "Vencida" as const };
        }
        return inv;
    });

    return { next, changed };
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
    const [clients, setClients] = useState<Client[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [q, setQ] = useState("");
    const [filter, setFilter] = useState<"Todos" | InvoiceStatus>("Todos");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Invoice | null>(null);

    async function loadAll() {
        const c = await getItem<Client[]>(KEY_CLIENTS, []);
        setClients(c);

        const savedAct = await getItem<Activity[]>(KEY_ACTIVITY, []);
        setActivity(savedAct);

        const saved = await getItemNullable<Invoice[]>(KEY_INVOICES);
        const todayKey = toDayKeyLocal(new Date());

        if (saved === null) {
            const normalized = normalizeOverdue(SEED, todayKey);
            setInvoices(normalized.next);
            await setItem(KEY_INVOICES, normalized.next);
        } else {
            const normalized = normalizeOverdue(saved, todayKey);
            setInvoices(normalized.next);
            if (normalized.changed) await setItem(KEY_INVOICES, normalized.next);
        }
    }

    useFocusEffect(
        React.useCallback(() => {
            loadAll();
        }, [])
    );

    React.useEffect(() => {
        setItem(KEY_INVOICES, invoices);
    }, [invoices]);

    React.useEffect(() => {
        setItem(KEY_ACTIVITY, activity);
    }, [activity]);

    function pushActivity(a: Omit<Activity, "id" | "ts">) {
        const entry: Activity = { id: uid(), ts: new Date().toISOString(), ...a };
        setActivity((prev) => [entry, ...prev].slice(0, 50));
    }

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

    function saveInvoice(data: Omit<Invoice, "id"> & { id?: string }) {
        if (editing?.id) {
            setInvoices((prev) =>
                prev.map((x) => (x.id === editing.id ? { ...x, ...data, id: editing.id } : x))
            );

            pushActivity({
                type: "invoice_updated",
                invoiceId: editing.id,
                clientId: data.clientId,
                amount: data.amount,
                status: data.status,
                desc: data.desc,
                due: data.due,
            });
        } else {
            const id = nextInvoiceId();
            const created: Invoice = { ...data, id } as Invoice;
            setInvoices((prev) => [created, ...prev]);

            pushActivity({
                type: "invoice_created",
                invoiceId: id,
                clientId: created.clientId,
                amount: created.amount,
                status: created.status,
                desc: created.desc,
                due: created.due,
            });
        }
    }

    function markPaid(inv: Invoice) {
        if (inv.status === "Cobrada") return;

        const run = () => {
            setInvoices((prev) =>
                prev.map((x) => (x.id === inv.id ? { ...x, status: "Cobrada" as const } : x))
            );
            pushActivity({
                type: "invoice_paid",
                invoiceId: inv.id,
                clientId: inv.clientId,
                amount: inv.amount,
                status: "Cobrada",
                desc: inv.desc,
                due: inv.due,
            });
        };

        if (Platform.OS === "web") return run();

        Alert.alert("Marcar como cobrada", `¿Marcar ${inv.id} como cobrada?`, [
            { text: "Cancelar", style: "cancel" },
            { text: "Sí, cobrada", onPress: run },
        ]);
    }

    function deleteInvoice(inv: Invoice) {
        const run = () => {
            setInvoices((p) => p.filter((x) => x.id !== inv.id));
            pushActivity({
                type: "invoice_deleted",
                invoiceId: inv.id,
                clientId: inv.clientId,
                amount: inv.amount,
                status: inv.status,
                desc: inv.desc,
                due: inv.due,
            });
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
                                clientName={c?.company ?? c?.name ?? "Cliente"}
                                desc={inv.desc}
                                amount={money(inv.amount)}
                                dueLabel={prettyDue(inv.due)}
                                status={inv.status}
                                onEdit={() => openEdit(inv)}
                                onDelete={() => deleteInvoice(inv)}
                                onMarkPaid={() => markPaid(inv)}
                                onShare={() => {
                                    if (c) generateInvoicePDF(inv, c);
                                }}
                                onWhatsApp={() => {
                                    if (!c) return;
                                    const msg = `Hola ${c.name}, le escribimos de PagoFijoHN para recordarle su factura ${inv.id} por $${inv.amount} que vence el ${inv.due}. Gracias.`;
                                    openWhatsApp(c.phone, msg);
                                }}
                            />
                        );
                    })}
                </View>

                <InvoiceFormModal
                    visible={modalOpen}
                    onClose={() => setModalOpen(false)}
                    onSave={saveInvoice}
                    clients={clients}
                    initial={editing}
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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