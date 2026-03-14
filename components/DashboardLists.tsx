import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Client, Invoice } from "../models/types";
import { lightColors, useAppColors } from "../themes/colors";
import { InvoiceRow } from "./InvoiceRow";

function isValidYYYYMMDD(s: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toDayKeyLocal(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function money(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function OverduePaymentsCard({
    invoices,
    clientsById,
}: {
    invoices: Invoice[];
    clientsById: Map<string, Client>;
}) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const list = useMemo(() => {
        const today = toDayKeyLocal(new Date());
        return invoices
            .filter((x) => x.status !== "Cobrada" && isValidYYYYMMDD(x.due) && x.due < today)
            .sort((a, b) => (a.due < b.due ? -1 : 1))
            .slice(0, 3);
    }, [invoices]);

    return (
        <View style={[styles.card, { flex: 1 }]}>
            {list.length === 0 ? (
                <Text style={styles.empty}>No hay atrasos</Text>
            ) : (
                <View style={{ marginTop: 0, gap: 10 }}>
                    {list.map((inv) => {
                        const c = clientsById.get(inv.clientId);
                        return (
                            <InvoiceRow
                                key={inv.id}
                                id={inv.id}
                                client={c?.company ?? c?.name ?? "Cliente"}
                                amount={money(inv.amount || 0)}
                                status={"Vencida"}
                                subtitle={`Vence: ${inv.due}`}
                            />
                        );
                    })}
                </View>
            )}
        </View>
    );
}

export function UpcomingPaymentsCard({
    invoices,
    clientsById,
}: {
    invoices: Invoice[];
    clientsById: Map<string, Client>;
}) {
    const colors = useAppColors();
    const styles = getStyles(colors);
    const list = useMemo(() => {
        const today = toDayKeyLocal(new Date());
        return invoices
            .filter((x) => x.status !== "Cobrada" && isValidYYYYMMDD(x.due) && x.due >= today)
            .sort((a, b) => (a.due < b.due ? -1 : 1))
            .slice(0, 3);
    }, [invoices]);

    return (
        <View style={[styles.card, { flex: 1 }]}>
            {list.length === 0 ? (
                <Text style={styles.empty}>Nada por vencer</Text>
            ) : (
                <View style={{ marginTop: 0, gap: 10 }}>
                    {list.map((inv) => {
                        const c = clientsById.get(inv.clientId);
                        return (
                            <InvoiceRow
                                key={inv.id}
                                id={inv.id}
                                client={c?.company ?? c?.name ?? "Cliente"}
                                amount={money(inv.amount || 0)}
                                status={inv.status}
                                subtitle={`Vence: ${inv.due}`}
                            />
                        );
                    })}
                </View>
            )}
        </View>
    );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    card: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 14,
    },
    title: { fontSize: 15, fontWeight: "900", color: colors.text },
    empty: { marginTop: 10, color: colors.muted, fontWeight: "700" },
});
