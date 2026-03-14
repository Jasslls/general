import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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

import { ClientCard } from "../../components/ClientCard";
import { ClientFormModal } from "../../components/ClientFormModal";
import type { Client } from "../../models/types";
import { useAuth } from "../../context/AuthContext";
import { usePremium } from "../../hooks/usePremium";
import { saveSession } from "../../services/auth";
import {
    addClient,
    deleteClient,
    deleteInvoice,
    getClients,
    getInvoicesByClient,
    updateClient,
    updateUserSettings
} from "../../services/firestore";
import { getItemNullable, setItem } from "../../services/storage";
import { lightColors, useAppColors } from "../../themes/colors";
import { openWhatsApp } from "../../utils/whatsapp";
import { PaywallModal } from "../../components/PaywallModal";

const KEY_CLIENTS_INTENT = "clients_intent_open_new_v1";

export default function ClientesScreen() {
    const { status, isPremium } = usePremium();
    const colors = useAppColors();
    const styles = getStyles(colors);
    const { user, setUser } = useAuth();
    const uid = user?.id;

    const params = useLocalSearchParams<{ q?: string }>();
    const [q, setQ] = useState("");
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Client | null>(null);
    const [paywallVisible, setPaywallVisible] = useState(false);

    // 🔒 Esto evita que se abra el modal sin intención.
    const [shouldOpenNewFromIntent, setShouldOpenNewFromIntent] = useState(false);

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

    const loadClients = async () => {
        if (!uid) return;
        setLoading(true);
        try {
            const data = await getClients(uid);
            setClients(data);
        } catch (error) {
            console.error("Error loading clients:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadClients();
    }, [uid]);

    // ✅ SOLO si vienes desde "Nueva factura sin clientes"
    useFocusEffect(
        React.useCallback(() => {
            if (params.q) {
                setQ(params.q);
            }
            (async () => {
                const flag = (await getItemNullable<boolean>(KEY_CLIENTS_INTENT)) ?? false;
                if (flag) {
                    // IMPORTANTÍSIMO: limpiar el flag primero para que NO pase de nuevo
                    await setItem(KEY_CLIENTS_INTENT, false);

                    // marcamos intención y abrimos modal
                    setShouldOpenNewFromIntent(true);
                    setEditing(null);
                    setModalOpen(true);
                } else {
                    setShouldOpenNewFromIntent(false);
                }
            })();
        }, [params.q])
    );

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return clients;
        return clients.filter((c) =>
            `${c.name} ${c.company} ${c.email} ${c.phone} ${c.rfc}`.toLowerCase().includes(s)
        );
    }, [q, clients]);

    function openNew() {
        if (!isPremium && clients.length >= 10) {
            setPaywallVisible(true);
            return;
        }
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(c: Client) {
        setEditing(c);
        setModalOpen(true);
    }

    async function saveClient(input: { name: string; company: string; email: string; phone: string; rfc: string }) {
        if (!uid) return;
        if (!input.name.trim() || !input.company.trim()) {
            return Alert.alert("Falta info", "Nombre y empresa son obligatorios.");
        }

        try {
            if (editing) {
                await updateClient(uid, editing.id, input);
            } else {
                // Double check limit
                if (!isPremium && clients.length >= 10) {
                    setPaywallVisible(true);
                    return;
                }
                await addClient(uid, input);
            }
            setModalOpen(false);
            loadClients();
        } catch (error) {
            Alert.alert("Error", "No se pudo guardar el cliente.");
        }
    }

    async function deleteClientWithInvoices(clientId: string) {
        if (!uid) return;
        try {
            const invoices = await getInvoicesByClient(uid, clientId);
            for (const inv of invoices) {
                await deleteInvoice(uid, clientId, inv.id);
            }
            await deleteClient(uid, clientId);
            loadClients();
        } catch (error) {
            Alert.alert("Error", "No se pudo eliminar el cliente y sus facturas.");
        }
    }

    async function handleDelete(c: Client) {
        if (!uid) return;
        try {
            const invoices = await getInvoicesByClient(uid, c.id);
            const relatedCount = invoices.length;

            if (relatedCount === 0) {
                if (Platform.OS === "web") {
                    await deleteClient(uid, c.id);
                    loadClients();
                    return;
                }

                Alert.alert("Eliminar cliente", `¿Eliminar a ${c.name}?`, [
                    { text: "Cancelar", style: "cancel" },
                    {
                        text: "Eliminar", style: "destructive", onPress: async () => {
                            await deleteClient(uid, c.id);
                            loadClients();
                        }
                    },
                ]);
                return;
            }

            const msg = `${c.name} tiene ${relatedCount} factura(s) asociada(s). Si lo eliminas, se borrarán también esas facturas.`;

            if (Platform.OS === "web") {
                const ok = typeof window !== "undefined" ? window.confirm(msg + "\n\n¿Borrar cliente y sus facturas?") : false;
                if (!ok) return;
                await deleteClientWithInvoices(c.id);
                return;
            }

            Alert.alert("Cliente con facturas", msg, [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Borrar cliente + facturas",
                    style: "destructive",
                    onPress: () => void deleteClientWithInvoices(c.id),
                },
            ]);
        } catch (error) {
            Alert.alert("Error", "No se pudo obtener información del cliente.");
        }
    }

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.h1}>Clientes</Text>
                        <Text style={styles.sub}>Administra tu lista de clientes</Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Pressable onPress={toggleViewMode} style={({ pressed }) => [styles.viewToggle, pressed && { opacity: 0.7 }]}>
                            <MaterialIcons 
                                name={viewMode === 'normal' ? "view-agenda" : "view-list"} 
                                size={22} 
                                color={colors.primary} 
                            />
                        </Pressable>

                        {/* ✅ Este botón sigue funcionando normal */}
                        <Pressable onPress={openNew} style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}>
                            <Text style={styles.newBtnText}>＋ Nuevo</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.searchWrap}>
                    <Text style={styles.searchIcon}>🔎</Text>
                    <TextInput
                        value={q}
                        onChangeText={setQ}
                        placeholder="Buscar cliente, empresa, correo..."
                        placeholderTextColor={colors.muted}
                        style={styles.search}
                    />
                </View>

                <View style={styles.grid}>
                    {filtered.map((c) => (
                        <View key={c.id} style={styles.cell}>
                            <ClientCard
                                name={c.name}
                                company={c.company}
                                email={c.email}
                                phone={c.phone}
                                rfc={c.rfc}
                                riskLevel={c.riskLevel}
                                compact={viewMode === 'compact'}
                                onEdit={() => openEdit(c)}
                                onDelete={() => void handleDelete(c)}
                                onWhatsApp={() => {
                                    openWhatsApp(c.phone, `Hola ${c.name}, le escribimos de PagoFijoHN...`);
                                }}
                            />
                        </View>
                    ))}
                </View>

                <ClientFormModal
                    visible={modalOpen}
                    onClose={() => setModalOpen(false)}
                    onSave={saveClient}
                    initial={
                        editing
                            ? { name: editing.name, company: editing.company, email: editing.email, phone: editing.phone, rfc: editing.rfc }
                            : null
                    }
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
        marginBottom: 14,
    },
    searchIcon: { fontSize: 16 },
    search: { flex: 1, color: colors.text, fontWeight: "600" },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    cell: { width: "100%", maxWidth: 420, flexGrow: 1, flexBasis: 300 },
});