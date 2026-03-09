import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Invoice } from "../models/types";
import { lightColors, useAppColors } from "../themes/colors";

/* ---------------- helpers ---------------- */

function isValidYYYYMMDD(s: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toMonthKey(d: Date) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
}

function addMonths(d: Date, delta: number) {
    const x = new Date(d.getFullYear(), d.getMonth() + delta, 1);
    return x;
}

function monthLabelEs(d: Date) {
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${months[d.getMonth()]}`;
}

/* ---------------- BAR CARD ---------------- */
/**
 * “Ingresos Mensuales”
 * - Cobrado: suma de facturas Cobrada del mes (por due)
 * - Proyectado: suma de NO cobradas del mes (Pendiente/Vencida) (por due)
 * - Últimos 5 meses (incluyendo el actual)
 */
export function CashFlowBarCard({ invoices }: { invoices: Invoice[] }) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const series = useMemo(() => {
        const now = new Date();
        // últimos 5 meses (4 atrás + actual)
        const months = Array.from({ length: 5 }).map((_, i) => {
            const d = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), i - 4);
            return {
                key: toMonthKey(d),
                label: monthLabelEs(d),
                cobradas: 0,
                proyectado: 0,
            };
        });

        const idx = new Map<string, number>();
        months.forEach((m, i) => idx.set(m.key, i));

        for (const inv of invoices ?? []) {
            if (!inv?.due || !isValidYYYYMMDD(inv.due)) continue;

            const [y, m] = inv.due.split("-").map(Number);
            const key = `${y}-${String(m).padStart(2, "0")}`;

            const pos = idx.get(key);
            if (pos === undefined) continue;

            const amt = Number(inv.amount ?? 0);
            if (!Number.isFinite(amt) || amt <= 0) continue;

            if (inv.status === "Cobrada") months[pos].cobradas += amt;
            else months[pos].proyectado += amt;
        }

        return months;
    }, [invoices]);

    const hasAny = useMemo(() => {
        return (invoices ?? []).some((x) => Number(x?.amount ?? 0) > 0);
    }, [invoices]);

    if (!invoices || invoices.length === 0 || !hasAny) {
        return (
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Ingresos Mensuales</Text>
                <Text style={styles.empty}>No hay facturas para graficar.</Text>
            </View>
        );
    }

    const max = Math.max(
        1,
        ...series.map((m) => Math.max(m.cobradas, m.proyectado))
    );

    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Ingresos Mensuales</Text>

            <View style={styles.barRow}>
                {series.map((d) => {
                    const hCob = Math.round((d.cobradas / max) * 100);
                    const hPro = Math.round((d.proyectado / max) * 100);

                    return (
                        <View key={d.key} style={styles.barItem}>
                            <View style={styles.barStack}>
                                <View style={[styles.bar, styles.barCobrado, { height: `${hCob}%` }]} />
                                <View style={[styles.bar, styles.barProyectado, { height: `${hPro}%` }]} />
                            </View>

                            <Text style={styles.barLabel}>{d.label}</Text>
                        </View>
                    );
                })}
            </View>

            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
                    <Text style={styles.legendText}>Cobrado</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: colors.success }]} />
                    <Text style={styles.legendText}>Proyectado</Text>
                </View>
            </View>
        </View>
    );
}

/* ---------------- PIE (LIST) CARD ---------------- */
/**
 * “Estado de Facturas”
 * - Pendientes: status "Pendiente"
 * - Atrasadas: status "Vencida"
 * - Pagadas: status "Cobrada"
 * - % sobre total de facturas (count)
 */
export function InvoiceStatusPieCard({ invoices }: { invoices: Invoice[] }) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const stats = useMemo(() => {
        const total = invoices?.length ?? 0;
        let pendientes = 0;
        let vencidas = 0;
        let cobradas = 0;

        for (const inv of invoices ?? []) {
            if (inv.status === "Pendiente") pendientes++;
            else if (inv.status === "Vencida") vencidas++;
            else if (inv.status === "Cobrada") cobradas++;
        }

        const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

        return {
            total,
            pendientes,
            vencidas,
            cobradas,
            pctPendientes: pct(pendientes),
            pctVencidas: pct(vencidas),
            pctCobradas: pct(cobradas),
        };
    }, [invoices]);

    if (!invoices || invoices.length === 0) {
        return (
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Estado de Facturas</Text>
                <Text style={styles.empty}>No hay facturas para mostrar.</Text>
            </View>
        );
    }

    const data = [
        { label: "Pendientes", value: stats.pctPendientes, color: colors.primary },
        { label: "Atrasadas", value: stats.pctVencidas, color: colors.danger },
        { label: "Pagadas", value: stats.pctCobradas, color: colors.success },
    ];

    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Estado de Facturas</Text>

            {data.map((d) => (
                <View key={d.label} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: d.color }]} />
                    <Text style={styles.rowLabel}>{d.label}</Text>
                    <Text style={styles.rowValue}>{d.value}%</Text>
                </View>
            ))}
        </View>
    );
}

/* ---------------- STYLES ---------------- */

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    card: {
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        marginTop: 12,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: colors.text,
        marginBottom: 12,
    },

    empty: {
        color: colors.muted,
        fontWeight: "700",
        paddingVertical: 6,
    },

    barRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        height: 150,
        gap: 10,
    },
    barItem: { flex: 1, alignItems: "center" },

    // dos barras en “stack” (lado a lado se vería raro en móvil)
    barStack: {
        width: "100%",
        flex: 1,
        justifyContent: "flex-end",
        gap: 6,
    },
    bar: {
        width: "100%",
        borderRadius: 10,
    },
    barCobrado: {
        backgroundColor: colors.primary,
    },
    barProyectado: {
        backgroundColor: colors.success,
    },

    barLabel: {
        marginTop: 8,
        fontSize: 12,
        color: colors.muted,
        fontWeight: "700",
        textTransform: "capitalize",
    },

    legendRow: {
        marginTop: 10,
        flexDirection: "row",
        gap: 16,
        alignItems: "center",
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    legendSwatch: {
        width: 10,
        height: 10,
        borderRadius: 3,
    },
    legendText: {
        fontSize: 12,
        color: colors.muted,
        fontWeight: "700",
    },

    row: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 999,
        marginRight: 8,
    },
    rowLabel: {
        flex: 1,
        color: colors.text,
        fontWeight: "700",
    },
    rowValue: {
        color: colors.muted,
        fontWeight: "700",
    },
});
