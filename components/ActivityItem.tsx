import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Activity, Client, InvoiceStatus } from "../models/types";
import { colors } from "../themes/colors";

function badgeStyle(status?: InvoiceStatus) {
  if (status === "Vencida") return { bg: colors.danger + "1A", fg: colors.danger };
  if (status === "Cobrada") return { bg: colors.success + "1A", fg: colors.success };
  if (status === "Pendiente") return { bg: colors.primary + "1A", fg: colors.primary };
  return { bg: colors.border, fg: colors.text };
}

function labelForType(t: Activity["type"]) {
  switch (t) {
    case "invoice_created":
      return "Creada";
    case "invoice_updated":
      return "Actualizada";
    case "invoice_paid":
      return "Cobrada";
    case "invoice_deleted":
      return "Eliminada";
  }
}

function iconForType(t: Activity["type"]) {
  switch (t) {
    case "invoice_created":
      return "🧾";
    case "invoice_updated":
      return "✏️";
    case "invoice_paid":
      return "✅";
    case "invoice_deleted":
      return "🗑️";
  }
}

function fmtTs(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function ActivityItem({ a, client }: { a: Activity; client?: Client }) {
  const b = badgeStyle(a.status);

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (a.desc) parts.push(a.desc);
    if (a.due) parts.push(`Vence: ${a.due}`);
    return parts.join(" • ");
  }, [a.desc, a.due]);

  return (
    <View style={styles.card}>
      <View style={styles.leftIcon}>
        <Text style={{ fontSize: 18 }}>{iconForType(a.type)}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <Text style={styles.id}>{a.invoiceId ?? "Factura"}</Text>

          {!!a.status && (
            <View style={[styles.badge, { backgroundColor: b.bg }]}>
              <Text style={[styles.badgeText, { color: b.fg }]}>{a.status}</Text>
            </View>
          )}
        </View>

        <Text style={styles.company}>{client?.company ?? client?.name ?? "Cliente"}</Text>

        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

        <Text style={styles.meta}>
          {labelForType(a.type)} • {fmtTs(a.ts)}
        </Text>
      </View>

      {!!a.amount && (
        <Text style={styles.amount}>
          {a.amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leftIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  id: { color: colors.text, fontWeight: "900" },
  company: { color: colors.muted, marginTop: 2, fontWeight: "700" },
  subtitle: { color: colors.text, marginTop: 6, fontWeight: "600" },
  meta: { color: colors.muted, marginTop: 6, fontWeight: "600", fontSize: 12 },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontWeight: "900", fontSize: 12 },

  amount: { color: colors.text, fontWeight: "900", marginLeft: 8 },
});
