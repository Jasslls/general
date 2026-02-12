import { useFocusEffect } from "@react-navigation/native";
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
import type { Invoice } from "../../models/types";
import { getItemNullable, setItem } from "../../services/storage";
import { colors } from "../../themes/colors";
import { openWhatsApp } from "../../utils/whatsapp";

type Client = {
    id: string;
    name: string;
    company: string;
    email: string;
    phone: string;
    rfc: string;
};

const KEY_CLIENTS = "clients_v1";
const KEY_INVOICES = "invoices_v1";
const KEY_CLIENTS_INTENT = "clients_intent_open_new_v1";

const SEED: Client[] = [
    { id: "1", name: "María González", company: "Constructora García S.A.", email: "maria@empresa1.com", phone: "+52 55 1234 5678", rfc: "CGS980101ABC" },
    { id: "2", name: "Carlos Ramírez", company: "Distribuidora del Norte", email: "carlos@empresa2.com", phone: "+52 55 9876 5432", rfc: "DDN950315XYZ" },
    { id: "3", name: "Ana Martínez", company: "Servicios Integrales SA", email: "ana@empresa3.com", phone: "+52 33 5555 1234", rfc: "SIS000512DEF" },
    { id: "4", name: "Roberto Sánchez", company: "Tech Solutions México", email: "roberto@empresa4.com", phone: "+52 81 4444 9999", rfc: "TSM100820GHI" },
];

function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function ClientesScreen() {
    const [q, setQ] = useState("");
    const [clients, setClients] = useState<Client[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Client | null>(null);

    // 🔒 Esto evita que se abra el modal sin intención.
    const [shouldOpenNewFromIntent, setShouldOpenNewFromIntent] = useState(false);

    // ✅ load (seed solo si la key NO existe)
    useEffect(() => {
        (async () => {
            const saved = await getItemNullable<Client[]>(KEY_CLIENTS);
            if (saved === null) {
                setClients(SEED);
                await setItem(KEY_CLIENTS, SEED);
            } else {
                setClients(saved); // puede ser []
            }
        })();
    }, []);

    // ✅ persistir incluso si queda vacío []
    useEffect(() => {
        setItem(KEY_CLIENTS, clients);
    }, [clients]);

    // ✅ SOLO si vienes desde "Nueva factura sin clientes"
    useFocusEffect(
        React.useCallback(() => {
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
        }, [])
    );

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return clients;
        return clients.filter((c) =>
            `${c.name} ${c.company} ${c.email} ${c.phone} ${c.rfc}`.toLowerCase().includes(s)
        );
    }, [q, clients]);

    function openNew() {
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(c: Client) {
        setEditing(c);
        setModalOpen(true);
    }

    function saveClient(input: { name: string; company: string; email: string; phone: string; rfc: string }) {
        if (!input.name.trim() || !input.company.trim()) {
            return Alert.alert("Falta info", "Nombre y empresa son obligatorios.");
        }

        if (editing) {
            setClients((prev) => prev.map((x) => (x.id === editing.id ? { ...x, ...input } : x)));
        } else {
            const created: Client = { id: uid(), ...input };
            setClients((prev) => [created, ...prev]);
        }
    }

    async function deleteClientAndInvoices(clientId: string) {
        setClients((p) => p.filter((x) => x.id !== clientId));

        const inv = (await getItemNullable<Invoice[]>(KEY_INVOICES)) ?? [];
        const next = inv.filter((x) => x.clientId !== clientId);
        await setItem(KEY_INVOICES, next);
    }

    async function deleteClient(c: Client) {
        const inv = (await getItemNullable<Invoice[]>(KEY_INVOICES)) ?? [];
        const relatedCount = inv.filter((x) => x.clientId === c.id).length;

        if (relatedCount === 0) {
            if (Platform.OS === "web") {
                setClients((p) => p.filter((x) => x.id !== c.id));
                return;
            }

            Alert.alert("Eliminar cliente", `¿Eliminar a ${c.name}?`, [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: () => setClients((p) => p.filter((x) => x.id !== c.id)) },
            ]);
            return;
        }

        const msg = `${c.name} tiene ${relatedCount} factura(s) asociada(s). Si lo eliminas, puedes borrar también esas facturas para evitar datos huérfanos.`;

        if (Platform.OS === "web") {
            const ok = typeof window !== "undefined" ? window.confirm(msg + "\n\n¿Borrar cliente y sus facturas?") : false;
            if (!ok) return;
            await deleteClientAndInvoices(c.id);
            return;
        }

        Alert.alert("Cliente con facturas", msg, [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Borrar cliente + facturas",
                style: "destructive",
                onPress: () => void deleteClientAndInvoices(c.id),
            },
        ]);
    }

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.h1}>Clientes</Text>
                        <Text style={styles.sub}>Administra tu lista de clientes</Text>
                    </View>

                    {/* ✅ Este botón sigue funcionando normal */}
                    <Pressable onPress={openNew} style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}>
                        <Text style={styles.newBtnText}>＋ Nuevo</Text>
                    </Pressable>
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
                                onEdit={() => openEdit(c)}
                                onDelete={() => void deleteClient(c)}
                                onWhatsApp={() => {
                                    openWhatsApp(c.phone, `Hola ${c.name}, te escribo de PagoFijoHN...`);
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
        marginBottom: 14,
    },
    searchIcon: { fontSize: 16 },
    search: { flex: 1, color: colors.text, fontWeight: "600" },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    cell: { width: "100%", maxWidth: 420, flexGrow: 1, flexBasis: 300 },
});