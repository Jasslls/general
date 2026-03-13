import type { Client, Invoice } from "../models/types";

export type ReportPeriod = "month" | "quarter" | "all";

function getStartDate(period: ReportPeriod): string {
    const d = new Date();
    if (period === "month") {
        d.setDate(1);
    } else if (period === "quarter") {
        d.setMonth(d.getMonth() - 2);
        d.setDate(1);
    } else {
        return "1970-01-01";
    }
    return d.toISOString().split("T")[0];
}

function filterByPeriod(invoices: Invoice[], period: ReportPeriod): Invoice[] {
    const start = getStartDate(period);
    return invoices.filter((i) => (i.due ?? "") >= start);
}

/** Tasa de cobro: % de facturas (por monto) que están Cobradas */
export function getCollectionRate(invoices: Invoice[], period: ReportPeriod = "all"): number {
    const filtered = filterByPeriod(invoices, period);
    if (filtered.length === 0) return 0;
    const total = filtered.reduce((s, i) => s + (i.amount ?? 0), 0);
    const collected = filtered
        .filter((i) => i.status === "Cobrada")
        .reduce((s, i) => s + (i.amount ?? 0), 0);
    return total === 0 ? 0 : Math.round((collected / total) * 100);
}

/** Monto total cobrado en el período */
export function getCollectedAmount(invoices: Invoice[], period: ReportPeriod = "all"): number {
    return filterByPeriod(invoices, period)
        .filter((i) => i.status === "Cobrada")
        .reduce((s, i) => s + (i.amount ?? 0), 0);
}

/** Monto total pendiente/vencido en el período */
export function getPendingAmount(invoices: Invoice[], period: ReportPeriod = "all"): number {
    return filterByPeriod(invoices, period)
        .filter((i) => i.status !== "Cobrada")
        .reduce((s, i) => s + (i.amount ?? 0), 0);
}

/** Promedio de días que tarda un cliente en pagar (solo facturas Cobradas) */
export function getAvgDaysToPay(invoices: Invoice[]): number {
    const paid = invoices.filter((i) => i.status === "Cobrada" && i.due);
    if (paid.length === 0) return 0;
    const today = new Date().toISOString().split("T")[0];
    const daysArr = paid.map((i) => {
        const due = i.due!;
        const diff = (new Date(today).getTime() - new Date(due).getTime()) / 86_400_000;
        return Math.max(0, diff);
    });
    return Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length);
}

/** Top N clientes que MÁS han pagado (monto cobrado total) */
export function getTopPayers(
    clients: Client[],
    invoices: Invoice[],
    n = 3
): Array<{ client: Client; totalPaid: number }> {
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const totals = new Map<string, number>();
    for (const inv of invoices) {
        if (inv.status !== "Cobrada") continue;
        totals.set(inv.clientId, (totals.get(inv.clientId) ?? 0) + (inv.amount ?? 0));
    }
    return [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([id, totalPaid]) => ({ client: clientMap.get(id)!, totalPaid }))
        .filter((x) => x.client);
}

/** Top N clientes con MAYOR deuda activa (pendiente + vencida) */
export function getTopDebtors(
    clients: Client[],
    invoices: Invoice[],
    n = 3
): Array<{ client: Client; totalDebt: number }> {
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const totals = new Map<string, number>();
    for (const inv of invoices) {
        if (inv.status === "Cobrada") continue;
        totals.set(inv.clientId, (totals.get(inv.clientId) ?? 0) + (inv.amount ?? 0));
    }
    return [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([id, totalDebt]) => ({ client: clientMap.get(id)!, totalDebt }))
        .filter((x) => x.client);
}

/** Builds a shareable plain-text summary */
export function buildShareText(
    period: ReportPeriod,
    collectionRate: number,
    collected: number,
    pending: number,
    avgDays: number,
    topPayers: Array<{ client: Client; totalPaid: number }>,
    topDebtors: Array<{ client: Client; totalDebt: number }>
): string {
    const periodLabel = period === "month" ? "este mes" : period === "quarter" ? "últimos 3 meses" : "todo el tiempo";
    const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const lines = [
        `📊 Reporte PagoFijoHN — ${periodLabel}`,
        "",
        `✅ Cobrado: ${money(collected)}`,
        `⏳ Pendiente: ${money(pending)}`,
        `📈 Tasa de cobro: ${collectionRate}%`,
        `⏱️ Promedio días para cobrar: ${avgDays}`,
        "",
        "🏆 Mejores pagadores:",
        ...topPayers.map((p, i) => `  ${i + 1}. ${p.client.name} — ${money(p.totalPaid)}`),
        "",
        "🔴 Mayores deudores:",
        ...topDebtors.map((d, i) => `  ${i + 1}. ${d.client.name} — ${money(d.totalDebt)}`),
        "",
        "Generado con PagoFijoHN",
    ];
    return lines.join("\n");
}
