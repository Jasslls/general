import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Client, Invoice } from "../models/types";
import { lightColors, useAppColors } from "../themes/colors";

/* Utils */
function sum(list: number[]) {
    return list.reduce((a, b) => a + b, 0);
}

function money(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function daysDiff(due: string) {
    const today = new Date();
    const d = new Date(due + "T00:00:00");
    return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

export function AgingBarCard({ invoices }: { invoices: Invoice[] }) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const data = useMemo(() => {
        const buckets = { vigente: 0, d30: 0, d60: 0, d90: 0, d90p: 0 };

        invoices.forEach((i) => {
            if (i.status === "Cobrada") return;

            const due = String(i.due ?? "");
            if (!due) return;

            const d = daysDiff(due);
            if (d <= 0) buckets.vigente += i.amount;
            else if (d <= 30) buckets.d30 += i.amount;
            else if (d <= 60) buckets.d60 += i.amount;
            else if (d <= 90) buckets.d90 += i.amount;
            else buckets.d90p += i.amount;
        });

        return buckets;
    }, [invoices]);

    const max = Math.max(...Object.values(data), 1);

    const rows: Array<[label: string, value: number]> = [
        ["Vigente", data.vigente],
        ["1-30 días", data.d30],
        ["31-60 días", data.d60],
        ["61-90 días", data.d90],
        ["90+ días", data.d90p],
    ];

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Antigüedad de Saldos</Text>

            {rows.map(([label, value]) => (
                <View key={label} style={styles.barRow}>
                    <Text style={styles.barLabel}>{label}</Text>

                    <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${(value / max) * 100}%` }]} />
                    </View>

                    <Text style={styles.barValue}>{money(value)}</Text>
                </View>
            ))}
        </View>
    );
}

export function TopClientsBarCard({
    invoices,
    clients,
}: {
    invoices: Invoice[];
    clients: Client[];
}) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const rows = useMemo(() => {
        const map = new Map<string, { paid: number; pending: number }>();

        invoices.forEach((i) => {
            const r = map.get(i.clientId) ?? { paid: 0, pending: 0 };
            if (i.status === "Cobrada") r.paid += i.amount;
            else r.pending += i.amount;
            map.set(i.clientId, r);
        });

        return [...map.entries()]
            .map(([id, v]) => ({
                name: clients.find((c) => c.id === id)?.company ?? "Cliente",
                paid: v.paid,
                pending: v.pending,
                total: v.paid + v.pending,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [invoices, clients]);

    const max = Math.max(...rows.map((r) => r.total), 1);

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Top Clientes por Facturación</Text>

            {rows.map((r) => (
                <View key={r.name} style={{ marginBottom: 10 }}>
                    <Text style={styles.clientName}>{r.name}</Text>

                    <View style={styles.stackTrack}>
                        <View style={[styles.stackPaid, { width: `${(r.paid / max) * 100}%` }]} />
                        <View style={[styles.stackPending, { width: `${(r.pending / max) * 100}%` }]} />
                    </View>

                    <Text style={styles.barValue}>
                        {money(r.total)} (Pagado {money(r.paid)} • Pendiente {money(r.pending)})
                    </Text>
                </View>
            ))}
        </View>
    );
}

export function CashFlowLineCard({ invoices }: { invoices: Invoice[] }) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const paid = sum(invoices.filter((i) => i.status === "Cobrada").map((i) => i.amount));
    const pending = sum(invoices.filter((i) => i.status !== "Cobrada").map((i) => i.amount));

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Flujo de Efectivo Mensual</Text>
            <Text style={styles.hint}>Vista resumida</Text>

            <View style={{ marginTop: 10, gap: 6 }}>
                <Text style={{ color: colors.success, fontWeight: "800" }}>
                    Ingresos cobrados: {money(paid)}
                </Text>
                <Text style={{ color: colors.warning, fontWeight: "800" }}>
                    Por cobrar: {money(pending)}
                </Text>
            </View>
        </View>
    );
}

export function ReportsKpis({ invoices }: { invoices: Invoice[] }) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const paid = sum(invoices.filter((i) => i.status === "Cobrada").map((i) => i.amount));
    const pending = sum(invoices.filter((i) => i.status !== "Cobrada").map((i) => i.amount));

    const avg = paid / Math.max(1, 3);

    return (
        <View style={styles.kpiRow}>
            <Kpi title="Total Cobrado" value={money(paid)} color={colors.success} />
            <Kpi title="Total Pendiente" value={money(pending)} color={colors.warning} />
            <Kpi title="Promedio Mensual" value={money(avg)} color={colors.primary} />
        </View>
    );
}

function Kpi({ title, value, color }: { title: string; value: string; color: string }) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    return (
        <View style={styles.kpi}>
            <Text style={styles.kpiTitle}>{title}</Text>
            <Text style={[styles.kpiValue, { color }]}>{value}</Text>
        </View>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    card: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: { fontSize: 16, fontWeight: "900", color: colors.text, marginBottom: 10 },
    hint: { color: colors.muted, fontWeight: "600" },

    barRow: { marginBottom: 10 },
    barLabel: { fontWeight: "800", color: colors.text },
    barTrack: {
        height: 8,
        backgroundColor: colors.border,
        borderRadius: 999,
        marginTop: 6,
    },
    barFill: { height: 8, backgroundColor: colors.primary, borderRadius: 999 },
    barValue: { color: colors.muted, fontSize: 12, marginTop: 6, fontWeight: "700" },

    clientName: { fontWeight: "800", color: colors.text },
    stackTrack: {
        height: 10,
        backgroundColor: colors.border,
        borderRadius: 999,
        flexDirection: "row",
        overflow: "hidden",
        marginTop: 6,
    },
    stackPaid: { backgroundColor: colors.success },
    stackPending: { backgroundColor: colors.warning },

    kpiRow: { flexDirection: "row", gap: 12 },
    kpi: {
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    kpiTitle: { color: colors.muted, fontWeight: "800" },
    kpiValue: { fontSize: 16, fontWeight: "900", marginTop: 4 },
});
