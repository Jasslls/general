import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState, useCallback } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { InvoiceCard } from "../../components/InvoiceCard";
import { InvoiceDetailsModal } from "../../components/InvoiceDetailsModal";
import { InvoiceFormModal } from "../../components/InvoiceFormModal";
import { PaywallModal } from "../../components/PaywallModal";
import { PeriodSelectorModal } from "../../components/PeriodSelectorModal";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonInvoiceList } from "../../components/SkeletonLoader";
import type { Client, Invoice, InvoiceStatus } from "../../models/types";
import { generateInvoicePDF } from "../../services/pdf";
import { setItem } from "../../services/storage";
import { syncBusinessIntelligence } from "../../services/sync";
import { lightColors, useAppColors } from "../../themes/colors";
import { openWhatsApp } from "../../utils/whatsapp";
import { useAuth } from "../../context/AuthContext";
import { usePremium } from "../../hooks/usePremium";
import { saveSession } from "../../services/auth";
import { uploadImageAsync } from "../../services/firebase";
import {
    addInvoice,
    deleteInvoice,
    getAllInvoices,
    getClients,
    pushActivity,
    updateInvoice,
    updateUserSettings
} from "../../services/firestore";

import { ReminderModal } from "../../components/ReminderModal";

const KEY_CLIENTS_INTENT = "clients_intent_open_new_v1";

function money(n: number | undefined | null) {
    if (n == null || isNaN(n)) return "$0";
    if (n % 1 === 0) {
        return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
    }
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
    const { isPremium } = usePremium();
    const colors = useAppColors();
    const styles = getStyles(colors);
    const { user, setUser } = useAuth();
    const uid = user?.id;

    const [clients, setClients] = useState<Client[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const params = useLocalSearchParams<{ q?: string; filter?: string }>();
    const [q, setQ] = useState("");
    const [filter, setFilter] = useState<"Todos" | InvoiceStatus>("Todos");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Invoice | null>(null);

    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [detailsInvoice, setDetailsInvoice] = useState<Invoice | null>(null);

    const [reminderModalOpen, setReminderModalOpen] = useState(false);
    const [reminderClient, setReminderClient] = useState<Client | null>(null);
    const [reminderInvoice, setReminderInvoice] = useState<Invoice | null>(null);
    const [paywallVisible, setPaywallVisible] = useState(false);

    const [period, setPeriod] = useState<"Todos" | "Diario" | "Semanal" | "Mensual" | "Anual" | "Personalizado">("Todos");
    const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
    const [periodModalOpen, setPeriodModalOpen] = useState(false);

    const viewMode = user?.settings?.viewMode || 'normal';

    const toggleViewMode = async () => {
        if (!uid || !user) return;
        const next = viewMode === 'normal' ? 'compact' : 'normal';
        const newSettings = { ...user.settings!, viewMode: next as any };
        await updateUserSettings(uid, newSettings);
        const updatedSession = { ...user, settings: newSettings };
        await saveSession(updatedSession);
        setUser(updatedSession);
    };

    const getPeriodRange = () => {
        const now = new Date();
        const today = toDayKeyLocal(now);

        if (period === "Diario") return { start: today, end: today };
        if (period === "Semanal") {
            const first = now.getDate() - now.getDay();
            const start = new Date(now.setDate(first));
            const end = new Date(now.setDate(first + 6));
            return { start: toDayKeyLocal(start), end: toDayKeyLocal(end) };
        }
        if (period === "Mensual") {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return { start: toDayKeyLocal(start), end: toDayKeyLocal(end) };
        }
        if (period === "Anual") {
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date(now.getFullYear(), 11, 31);
            return { start: toDayKeyLocal(start), end: toDayKeyLocal(end) };
        }
        if (period === "Personalizado" && customRange) return customRange;
        return null;
    };

    const periodRange = getPeriodRange();


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

    // When invoices refresh (e.g. after background photo upload), keep details modal in sync
    React.useEffect(() => {
        if (detailsInvoice && invoices.length > 0) {
            const fresh = invoices.find(inv => inv.id === detailsInvoice.id && inv.clientId === detailsInvoice.clientId);
            if (fresh && JSON.stringify(fresh) !== JSON.stringify(detailsInvoice)) {
                setDetailsInvoice(fresh);
            }
        }
    }, [invoices]);

    useFocusEffect(
        useCallback(() => {
            if (params.q) {
                setQ(params.q);
            }
            if (params.filter && ["Todos", "Pendiente", "Vencida", "Cobrada"].includes(params.filter)) {
                setFilter(params.filter as any);
            }
            loadAll();
        }, [uid, params.q, params.filter])
    );

    const clientById = useMemo(() => {
        const m = new Map<string, Client>();
        clients.forEach((c) => m.set(c.id, c));
        return m;
    }, [clients]);

    const filtered = useMemo(() => {
        let list = getNormalizedInvoices(invoices, toDayKeyLocal(new Date()));

        if (filter !== "Todos") {
            list = list.filter((inv) => inv.status === filter);
        }

        if (periodRange) {
            list = list.filter(inv => {
                if (!inv.due) return false;
                return inv.due >= periodRange.start && inv.due <= periodRange.end;
            });
        }

        if (q.trim()) {
            const low = q.toLowerCase();
            list = list.filter((inv) => {
                const c = clients.find((cc) => cc.id === inv.clientId);
                return (
                    inv.id.toLowerCase().includes(low) ||
                    inv.desc.toLowerCase().includes(low) ||
                    c?.name.toLowerCase().includes(low) ||
                    c?.company.toLowerCase().includes(low)
                );
            });
        }

        return list.sort(sortInvoicesPro);
    }, [invoices, filter, q, clients, periodRange]);

    function nextInvoiceId() {
        const nums = invoices
            .map((x) => Number(String(x.id ?? "").split("-").pop()))
            .filter((n) => Number.isFinite(n));
        const next = (nums.length ? Math.max(...nums) : 0) + 1;
        return `FAC-2026-${String(next).padStart(3, "0")}`;
    }

    async function openNew() {
        if (!isPremium && invoices.length >= 20) {
            setPaywallVisible(true);
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
        const effectiveClientId = data.clientId || GENERAL_CLIENT_ID;

        try {
            if (editing?.id) {
                let newStatus = data.status;
                const paid = editing.paidAmount || 0;
                
                // Logic fix: Re-calculate status if the invoice is edited while having partial payments
                if (data.amount <= paid) {
                    newStatus = "Cobrada";
                } else if (newStatus === "Cobrada" && data.amount > paid) {
                    const todayKey = toDayKeyLocal(new Date());
                    newStatus = (data.due && data.due < todayKey) ? "Vencida" : "Pendiente";
                }

                let currentProofUri = editing.proofUri || "";
                if (!data.proofUri) {
                    currentProofUri = "";
                } else if (data.proofUri.startsWith("https://firebasestorage.googleapis.com") || data.proofUri.startsWith("data:")) {
                    currentProofUri = data.proofUri;
                }

                const updatedInv: Invoice = {
                    ...editing,
                    clientId: effectiveClientId,
                    desc: data.desc,
                    amount: data.amount,
                    due: data.due,
                    status: newStatus,
                    proofUri: currentProofUri,
                    recurrence: data.recurrence,
                };

                // Optimistic UI update
                setInvoices((prev) => prev.map((item) => (item.id === editing.id ? updatedInv : item)));

                // Save invoice immediately
                await updateInvoice(uid, effectiveClientId, editing.id, {
                    desc: data.desc,
                    amount: data.amount,
                    due: data.due,
                    status: newStatus,
                    proofUri: currentProofUri,
                    recurrence: data.recurrence,
                });

                await pushActivity(uid, {
                    type: "invoice_updated",
                    invoiceId: editing.id,
                    clientId: effectiveClientId,
                    amount: data.amount,
                    status: newStatus,
                    desc: data.desc,
                    due: data.due,
                    ts: new Date().toISOString(),
                });

                // Background image upload if new local file
                if (data.proofUri && !data.proofUri.startsWith("https://firebasestorage.googleapis.com") && !data.proofUri.startsWith("data:")) {
                    const invoiceId = editing.id;
                    uploadImageAsync(uid, data.proofUri)
                        .then((url) => updateInvoice(uid, effectiveClientId, invoiceId, { proofUri: url }))
                        .then(() => loadAll())
                        .catch((err) => {
                            console.error("Background image upload failed:", err);
                        });
                }
            } else {
                if (!isPremium && invoices.length >= 20) {
                    setPaywallVisible(true);
                    throw new Error("PAYWALL_BLOCKED");
                }
                const id = nextInvoiceId();

                const newInv: Invoice = {
                    id,
                    clientId: effectiveClientId,
                    desc: data.desc,
                    amount: data.amount,
                    due: data.due,
                    status: data.status,
                    proofUri: (data.proofUri && data.proofUri.startsWith("data:")) ? data.proofUri : "",
                    recurrence: data.recurrence,
                };

                // Optimistic UI update
                setInvoices((prev) => [newInv, ...prev]);

                const docId = await addInvoice(uid, effectiveClientId, {
                    desc: data.desc,
                    amount: data.amount,
                    due: data.due,
                    status: data.status,
                    proofUri: (data.proofUri && data.proofUri.startsWith("data:")) ? data.proofUri : "",
                    recurrence: data.recurrence,
                });

                await pushActivity(uid, {
                    type: "invoice_created",
                    invoiceId: id,
                    clientId: effectiveClientId,
                    amount: data.amount,
                    status: data.status,
                    desc: data.desc,
                    due: data.due,
                    ts: new Date().toISOString(),
                });

                if (data.proofUri && !data.proofUri.startsWith("data:")) {
                    uploadImageAsync(uid, data.proofUri)
                        .then((url) => updateInvoice(uid, effectiveClientId, docId, { proofUri: url }))
                        .then(() => loadAll())
                        .catch((err) => {
                            console.error("Background image upload failed:", err);
                        });
                }
            }
            
            // Background sync
            if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
            }
            syncBusinessIntelligence(uid).catch((err) => console.error("Background sync failed:", err));
        } catch (error) {
            console.error("Error saving invoice:", error);
            loadAll();
            throw error;
        }
    }

    async function handleAbonar(inv: Invoice, amount: number) {
        if (!uid) return;
        const paid = (inv.paidAmount || 0) + amount;
        const newBalance = inv.amount - paid;
        const newStatus = newBalance <= 0 ? "Cobrada" : inv.status;
        
        // Optimistic UI update
        const updated = { ...inv, paidAmount: paid, status: newStatus };
        setInvoices((prev) => prev.map((item) => (item.id === inv.id ? updated : item)));
        if (detailsInvoice?.id === inv.id) {
            setDetailsInvoice(updated);
        }

        try {
            await updateInvoice(uid, inv.clientId, inv.id, {
                paidAmount: paid,
                status: newStatus,
            });

            await pushActivity(uid, {
                type: "invoice_partial_paid",
                invoiceId: inv.id,
                clientId: inv.clientId,
                amount: amount,
                status: newStatus,
                desc: `Abono de ${money(amount)} a ${inv.id}`,
                ts: new Date().toISOString(),
            });

            if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
            }
            syncBusinessIntelligence(uid).catch((err) => console.error("Background sync failed:", err));
            await loadAll();
        } catch (error) {
            console.error("Error registering abono:", error);
            loadAll();
            const msg = "No se pudo registrar el abono.";
            if (Platform.OS === "web") alert(msg);
            else Alert.alert("Error", msg);
        }
    }

    async function markPaid(inv: Invoice) {
        if (!uid || inv.status === "Cobrada") return;

        const run = async (photoUri?: string) => {
            // Optimistic update
            setInvoices((prev) =>
                prev.map((item) =>
                    item.id === inv.id
                        ? { ...item, status: "Cobrada" as const, paidAmount: item.amount }
                        : item
                )
            );
            if (detailsInvoice?.id === inv.id) {
                setDetailsInvoice({ ...detailsInvoice, status: "Cobrada", paidAmount: detailsInvoice.amount });
            }

            try {
                let uploadedUri = photoUri;
                if (photoUri && !photoUri.startsWith("https://firebasestorage.googleapis.com")) {
                    try {
                        uploadedUri = await uploadImageAsync(uid, photoUri);
                    } catch (err: any) {
                        console.error("Failed to upload markPaid image:", err);
                        uploadedUri = undefined;
                    }
                }

                await updateInvoice(uid, inv.clientId, inv.id, { 
                    status: "Cobrada",
                    paidAmount: inv.amount,
                    proofUri: uploadedUri || inv.proofUri || "",
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
                    proofUri: uploadedUri,
                });

                if (Platform.OS !== "web") {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
                }
                syncBusinessIntelligence(uid).catch((err) => console.error("Background sync failed:", err));
                await loadAll();
            } catch (error) {
                console.error("Error markPaid:", error);
                loadAll();
                const msg = "No se pudo marcar como cobrada.";
                if (Platform.OS === "web") alert(msg);
                else Alert.alert("Error", msg);
            }
        };

        const pickImageAndPaid = async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled) {
                const asset = result.assets[0];
                const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
                await run(uri);
            } else {
                await run();
            }
        };

        if (Platform.OS === "web") {
            await run();
            return;
        }

        Alert.alert(
            "Marcar como cobrada", 
            `¿Marcar ${inv.id} como cobrada?`, 
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Cobrar", onPress: () => void run() },
                { text: "Subir Comprobante", onPress: () => void pickImageAndPaid() },
            ]
        );
    }

    async function handleDeleteInvoice(inv: Invoice) {
        if (!uid) return;
        const run = async () => {
            // Optimistic update
            setInvoices((prev) => prev.filter((item) => item.id !== inv.id));
            if (detailsInvoice?.id === inv.id) {
                setDetailsModalOpen(false);
            }

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
                    ts: new Date().toISOString(),
                });
                if (Platform.OS !== "web") {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{});
                }
                syncBusinessIntelligence(uid).catch((err) => console.error("Background sync failed:", err));
            } catch (error) {
                console.error("Error deleteInvoice:", error);
                loadAll();
                const msg = "No se pudo eliminar la factura.";
                if (Platform.OS === "web") alert(msg);
                else Alert.alert("Error", msg);
            }
        };

        if (Platform.OS === "web") {
            if (window.confirm(`¿Eliminar la factura ${inv.id}?`)) {
                await run();
            }
            return;
        }

        Alert.alert("Eliminar factura", `¿Eliminar ${inv.id}?`, [
            { text: "Cancelar", style: "cancel" },
            { text: "Eliminar", style: "destructive", onPress: () => void run() },
        ]);
    }

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <ScrollView 
                style={styles.screen} 
                contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={loadAll}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
            >
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.h1}>Facturas</Text>
                        <Text style={styles.sub}>Cuentas por cobrar</Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Pressable onPress={toggleViewMode} style={({ pressed }) => [styles.viewToggle, pressed && { opacity: 0.7 }]}>
                            <MaterialIcons 
                                name={viewMode === 'normal' ? "view-agenda" : "view-list"} 
                                size={22} 
                                color={colors.primary} 
                            />
                        </Pressable>

                        <Pressable onPress={() => void openNew()} style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}>
                            <Text style={styles.newBtnText}>＋ Nueva</Text>
                        </Pressable>
                    </View>
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

                <View style={styles.filterStrip}>
                    <Pressable 
                        onPress={() => setPeriodModalOpen(true)}
                        style={({ pressed }) => [styles.dateChip, pressed && { opacity: 0.8 }]}
                    >
                        <Text style={styles.calendarIcon}>📅</Text>
                        <Text style={styles.dateChipText}>
                            {period === "Todos" ? "Cualquier fecha" : 
                             period === "Personalizado" ? `${periodRange?.start} - ${periodRange?.end}` : 
                             period}
                        </Text>
                        <Text style={styles.chevron}>▾</Text>
                    </Pressable>
                    
                    <View style={{ flex: 1 }} />
                    
                    {period !== "Todos" && (
                        <Pressable onPress={() => setPeriod("Todos")}>
                            <Text style={styles.clearText}>Limpiar</Text>
                        </Pressable>
                    )}
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
                    {loading && invoices.length === 0 ? (
                        <SkeletonInvoiceList />
                    ) : filtered.length === 0 && !loading ? (
                        <EmptyState 
                            icon="document-text-outline"
                            title="No hay facturas"
                            description={
                                filter !== "Todos" || q.trim() !== "" || period !== "Todos"
                                    ? "No se encontraron facturas con los filtros actuales."
                                    : "Aún no tienes facturas registradas. Crea una nueva para empezar a cobrar."
                            }
                        />
                    ) : (
                        filtered.map((inv) => {
                            const c = clientById.get(inv.clientId);
                            const isGeneral = !inv.clientId || inv.clientId === "__general__" || !c;
                            const clientDisplayName = c 
                                ? (c.company ? `${c.company} - ${c.name}` : c.name) 
                                : "Cobro General";

                            return (
                                <InvoiceCard
                                    key={inv.id}
                                    id={inv.id}
                                    clientName={clientDisplayName}
                                    desc={inv.desc}
                                    amount={money(inv.amount)}
                                    dueLabel={prettyDue(inv.due)}
                                    status={inv.status}
                                    compact={viewMode === 'compact'}
                                    isRecurring={inv.recurrence !== undefined && inv.recurrence !== "none"}
                                    paidAmount={inv.paidAmount}
                                    onPressCard={() => {
                                        setDetailsInvoice(inv);
                                        setDetailsModalOpen(true);
                                    }}
                                    onEdit={() => openEdit(inv)}
                                    onDelete={() => handleDeleteInvoice(inv)}
                                    onMarkPaid={() => markPaid(inv)}
                                    proofUri={inv.proofUri}
                                    onShare={() => {
                                        const clientData = c || {
                                            id: "__general__",
                                            name: "Cliente General",
                                            company: "Cobro General",
                                            email: "",
                                            phone: "",
                                            rfc: "",
                                        };
                                        generateInvoicePDF(inv, clientData);
                                    }}
                                    onWhatsApp={c?.phone ? () => {
                                        setReminderClient(c);
                                        setReminderInvoice(inv);
                                        setReminderModalOpen(true);
                                    } : undefined}
                                />
                            );
                        })
                    )}
                </View>

                <InvoiceFormModal
                    visible={modalOpen}
                    onClose={() => setModalOpen(false)}
                    onSave={saveInvoiceData}
                    clients={clients}
                    initial={editing}
                />

                <InvoiceDetailsModal
                    visible={detailsModalOpen}
                    onClose={() => setDetailsModalOpen(false)}
                    invoice={detailsInvoice}
                    clientName={detailsInvoice ? (clientById.get(detailsInvoice.clientId)?.company || clientById.get(detailsInvoice.clientId)?.name || "Cobro General") : ""}
                    onAbonar={handleAbonar}
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

                <PeriodSelectorModal
                    visible={periodModalOpen}
                    onClose={() => setPeriodModalOpen(false)}
                    current={period}
                    onSelect={(p) => {
                        setPeriod(p);
                        if (p !== "Personalizado") setPeriodModalOpen(false);
                    }}
                    onCustomRange={(start, end) => {
                        setCustomRange({ start, end });
                        setPeriod("Personalizado");
                        setPeriodModalOpen(false);
                    }}
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

    filterStrip: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        gap: 10,
    },
    dateChip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    calendarIcon: { fontSize: 14 },
    dateChipText: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.primary,
    },
    chevron: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: "900",
    },
    clearText: {
        fontSize: 12,
        color: colors.muted,
        fontWeight: "700",
        marginRight: 4,
    },

    newBtn: { backgroundColor: "#0B1220", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
    newBtnText: { color: "#fff", fontWeight: "900" },

    viewToggle: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },

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
    search: { flex: 1, color: colors.text, fontWeight: "600", fontSize: 16 },

    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
    filterPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    filterText: { fontWeight: "900" },
});
