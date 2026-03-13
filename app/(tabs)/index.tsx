import { useFocusEffect } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../context/AuthContext";
import { usePremium } from "../../hooks/usePremium";

import { CashFlowBarCard, InvoiceStatusPieCard } from "../../components/Charts";
import { OverduePaymentsCard, UpcomingPaymentsCard } from "../../components/DashboardLists";
import { InvoiceRow } from "../../components/InvoiceRow";
import { PaywallModal } from "../../components/PaywallModal";
import { PriorityCollectionCard } from "../../components/PriorityCollectionCard";
import { StatCard } from "../../components/StatCard";
import type { Client, Invoice } from "../../models/types";
import { getAllInvoices, getClients } from "../../services/firestore";
import { getPriorityRanking } from "../../services/riskEngine";
import { lightColors, useAppColors } from "../../themes/colors";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function isValidYYYYMMDD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toDayKeyLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetweenYmd(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

function normalizeOverdue(invoices: Invoice[], todayKey: string) {
  return invoices.map((inv) => {
    if (inv.status === "Cobrada") return inv;
    if (!inv.due || !isValidYYYYMMDD(inv.due)) return inv;
    if (inv.due < todayKey && inv.status !== "Vencida") return { ...inv, status: "Vencida" as const };
    return inv;
  });
}

export default function DashboardScreen() {
  const colors = useAppColors();
  const styles = getStyles(colors);
  const { user } = useAuth();
  const uid = user?.id;
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const colStyle = isWide ? styles.col2 : styles.col1;
  const { isPremium } = usePremium();
  const [paywallVisible, setPaywallVisible] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      const { auth } = require("../../services/firebase");
      // Importante: No cargar datos hasta que Firebase Auth esté listo y coincida con el UID del contexto
      if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) {
        console.log("Dashboard: Waiting for Firebase Auth sync...", { uid, fbUid: auth.currentUser?.uid });
        return;
      }

      (async () => {
        setLoading(true);
        try {
          console.log("Dashboard: Fetching data for UID:", uid);
          const [c, invs] = await Promise.all([
            getClients(uid),
            getAllInvoices(uid)
          ]);
          const todayKey = toDayKeyLocal(new Date());
          const normalized = normalizeOverdue(invs, todayKey);

          setClients(c);
          setInvoices(normalized);
        } catch (error: any) {
          console.error("Dashboard Load Error:", {
            message: error.message,
            code: error.code,
            uid: uid,
            fbUid: auth.currentUser?.uid,
            timestamp: new Date().toISOString()
          });
        } finally {
          setLoading(false);
        }
      })();
    }, [uid])
  );

  const clientById = useMemo(() => {
    const m = new Map<string, Client>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const priorityItems = useMemo(() => getPriorityRanking(invoices, clientById, 5), [invoices, clientById]);

  const todayKey = useMemo(() => toDayKeyLocal(new Date()), []);

  const kpis = useMemo(() => {
    let overdue = 0;
    let next30 = 0;
    let pendingTotal = 0;
    let projected = 0;

    for (const inv of invoices) {
      projected += inv.amount || 0;

      if (inv.status !== "Cobrada") pendingTotal += inv.amount || 0;
      if (inv.status === "Vencida") overdue += inv.amount || 0;

      if (inv.status !== "Cobrada" && isValidYYYYMMDD(inv.due)) {
        const d = daysBetweenYmd(todayKey, inv.due);
        if (d >= 0 && d <= 30) next30 += inv.amount || 0;
      }
    }

    return { overdue, next30, pendingTotal, projected };
  }, [invoices, todayKey]);

  const recentInvoices = useMemo(() => {
    const safeDue = (d: string) => (isValidYYYYMMDD(d) ? d : "9999-12-31");
    return [...invoices]
      .sort((a, b) => {
        const ad = safeDue(a.due);
        const bd = safeDue(b.due);
        if (ad !== bd) return ad < bd ? -1 : 1;
        return String(b.id ?? "").localeCompare(String(a.id ?? ""));
      })
      .slice(0, 5);
  }, [invoices]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>PagoFijo</Text>
            <Text style={styles.sub}>Bienvenido a PagoFijo – administra tus clientes y facturas fácilmente</Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <StatCard title="Pagos Atrasados" value={money(kpis.overdue)} color={colors.danger} />
          <StatCard title="Próximos 30 días" value={money(kpis.next30)} color={colors.warning} />
        </View>
        <View style={styles.kpiRow}>
          <StatCard title="Pendiente Total" value={money(kpis.pendingTotal)} color={colors.primary} />
          <StatCard title="Flujo Proyectado" value={money(kpis.projected)} color={colors.success} />
        </View>

        {/* ── Premium Teaser (only when not premium) ── */}
        {!isPremium && (
          <Pressable
            onPress={() => setPaywallVisible(true)}
            style={styles.premiumCard}
          >
            <View style={styles.premiumCardHeader}>
              <View>
                <Text style={styles.premiumCardTitle}>🚀 Funciones Inteligentes</Text>
                <Text style={styles.premiumCardSub}>Herramientas pro para escalar tu negocio</Text>
              </View>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>👑 Premium</Text>
              </View>
            </View>

            {/* Expanded 2x2 Grid preview */}
            <View style={styles.premiumPreviewGrid}>
              <View style={styles.premiumPreviewCard}>
                <Text style={styles.premiumPreviewLabel}>Cliente que más debe</Text>
                <View style={styles.blurBlock} />
                <View style={[styles.blurBlock, { width: "60%" }]} />
              </View>
              <View style={styles.premiumPreviewCard}>
                <Text style={styles.premiumPreviewLabel}>Ganancias del mes</Text>
                <View style={[styles.blurBlock, { backgroundColor: colors.success + "60" }]} />
                <View style={[styles.blurBlock, { width: "55%", backgroundColor: colors.success + "40" }]} />
              </View>
              <View style={styles.premiumPreviewCard}>
                <Text style={styles.premiumPreviewLabel}>Asistente inteligente Fijito </Text>
                <View style={[styles.blurBlock, { backgroundColor: colors.primary + "30" }]} />
                <View style={[styles.blurBlock, { width: "70%", backgroundColor: colors.primary + "20" }]} />
              </View>
              <View style={styles.premiumPreviewCard}>
                <Text style={styles.premiumPreviewLabel}>Notificaciones generadas con IA</Text>
                <View style={[styles.blurBlock, { backgroundColor: colors.warning + "30" }]} />
                <View style={[styles.blurBlock, { width: "45%", backgroundColor: colors.warning + "20" }]} />
              </View>
            </View>
          </Pressable>
        )}

        {/* Priority Collection Widget */}
        {priorityItems.length > 0 && (
          <PriorityCollectionCard items={priorityItems} onSetSearch={() => { }} />
        )}

        <PaywallModal
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          onActivated={() => setPaywallVisible(false)}
        />


        {/* ✅ GRID como Figma: 2 arriba (charts) + 2 abajo (listas) */}
        <View style={styles.grid}>
          <View style={[styles.cell, colStyle]}>
            <CashFlowBarCard invoices={invoices} />
          </View>

          <View style={[styles.cell, colStyle]}>
            <InvoiceStatusPieCard invoices={invoices} />
          </View>

          <View style={[styles.cell, colStyle]}>
            <OverduePaymentsCard invoices={invoices} clientsById={clientById} />
          </View>

          <View style={[styles.cell, colStyle]}>
            <UpcomingPaymentsCard invoices={invoices} clientsById={clientById} />
          </View>
        </View>

        {/* Recientes */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Facturas recientes</Text>
        </View>

        {recentInvoices.map((inv) => {
          const c = clientById.get(inv.clientId);
          const clientName = c?.company ?? c?.name ?? "Cliente";
          const subtitle = `${inv.desc} • Vence: ${inv.due}`;
          return (
            <InvoiceRow
              key={inv.id}
              id={inv.id}
              client={clientName}
              amount={money(inv.amount || 0)}
              status={inv.status}
              subtitle={subtitle}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: typeof lightColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 28 },

  h1: { fontSize: 22, fontWeight: "800", color: colors.text },
  sub: { color: colors.muted, marginTop: 4, marginBottom: 14, fontWeight: "600" },

  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 12 },

  // GRID responsive
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
  cell: { flexGrow: 1 },

  // 2 columnas (web/tablet grande)
  col2: { flexBasis: "49%", minWidth: 420 },

  // 1 columna (móvil)
  col1: { flexBasis: "100%", minWidth: 0 },

  sectionHeader: { marginTop: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },

  // ── Premium Teaser ──
  premiumCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  premiumCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  premiumCardTitle: { fontSize: 15, fontWeight: "900", color: colors.text },
  premiumCardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  premiumBadge: {
    backgroundColor: "#1e3a8a",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  premiumBadgeText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  premiumPreviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8
  },
  premiumPreviewCard: {
    width: "48%", // For 2 columns
    flexGrow: 1,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  premiumPreviewLabel: { fontSize: 11, fontWeight: "800", color: colors.muted, marginBottom: 2 },
  blurBlock: {
    height: 12,
    width: "80%",
    backgroundColor: colors.border,
    borderRadius: 6,
    opacity: 0.7,
  },

  premiumCTA: {
    alignItems: "center",
    paddingVertical: 4,
  },
  premiumCTAText: { color: colors.primary, fontWeight: "800", fontSize: 14, textDecorationLine: "underline" },
});


