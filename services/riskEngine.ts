import type { Client, Invoice } from "../models/types";
import { updateClient } from "./firestore";

export const RISK_LEVELS = {
    LOW: "bajo",
    MEDIUM: "medio",
    HIGH: "alto",
    UNKNOWN: "indeterminado",
} as const;

function diffDays(date1: string, date2: string) {
    const d1 = new Date(date1).getTime();
    const d2 = new Date(date2).getTime();
    return (d1 - d2) / (1000 * 3600 * 24);
}

export function getTodayYMD() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
}

export function calculateClientRisk(invoices: Invoice[]): { score: number, level: string } {
    if (!invoices || invoices.length === 0) {
        return { score: 0, level: RISK_LEVELS.UNKNOWN };
    }

    const today = getTodayYMD();
    let totalInvoices = invoices.length;
    let overdueCount = 0;
    let maxDaysOverdue = 0;

    for (const inv of invoices) {
        if (inv.status === "Cobrada") continue;

        const isOverdue = inv.status === "Vencida" || (inv.status === "Pendiente" && inv.due < today);
        
        if (isOverdue) {
            overdueCount++;
            const daysOverdue = diffDays(today, inv.due);
            if (daysOverdue > maxDaysOverdue) {
                maxDaysOverdue = daysOverdue;
            }
        }
    }

    const overdueRatio = overdueCount / totalInvoices;
    const ratioScore = overdueRatio * 60; // Max 60 points

    const cappedDelay = Math.min(Math.max(maxDaysOverdue, 0), 30);
    const delayScore = (cappedDelay / 30) * 40; // Max 40 points

    const totalScore = Math.min(Math.round(ratioScore + delayScore), 100);

    let level: string = RISK_LEVELS.LOW;

    if (totalScore === 0 && overdueCount === 0) {
        level = RISK_LEVELS.LOW;
    }

    if (totalScore >= 70) {
        level = RISK_LEVELS.HIGH;
    } else if (totalScore >= 30) {
        level = RISK_LEVELS.MEDIUM;
    }

    
    return { score: totalScore, level };
}

export async function updateClientRiskFirestore(uid: string, clientId: string, invoices: Invoice[]) {
    const { score, level } = calculateClientRisk(invoices);
    
    await updateClient(uid, clientId, {
        riskScore: score,
        riskLevel: level as any,
    });
    
    return { score, level };
}
export interface PriorityInvoice {
    invoice: Invoice;
    client: Client | null;
    urgencyScore: number;
    daysOverdue: number;
    badge: string;
}

export function getPriorityRanking(
    invoices: Invoice[],
    clientMap: Map<string, Client>,
    limit = 5
): PriorityInvoice[] {
    const today = getTodayYMD();

    const pending = invoices.filter((inv) => inv.status !== "Cobrada");
    if (pending.length === 0) return [];

    const maxAmount = Math.max(...pending.map((i) => i.amount ?? 0), 1);

    const scored: PriorityInvoice[] = pending.map((inv) => {
        const client = clientMap.get(inv.clientId) ?? null;
        const riskLevel = client?.riskLevel ?? "indeterminado";

        const daysOverdue = diffDays(today, inv.due ?? today);

        const isAlreadyOverdue = inv.status === "Vencida" || daysOverdue > 0;
        const overdueBonus = isAlreadyOverdue ? 40 : 0;

        const overduePoints = isAlreadyOverdue ? Math.min(daysOverdue, 35) : 0;

        const upcomingPoints = !isAlreadyOverdue && daysOverdue <= 0 && daysOverdue >= -7 ? 10 : 0;

        const rawScore = overdueBonus + overduePoints + upcomingPoints;

        const multiplier = riskLevel === "alto" ? 2 : riskLevel === "medio" ? 1.5 : 1;

        const amountBonus = Math.round(((inv.amount ?? 0) / maxAmount) * 15);

        const urgencyScore = Math.min(Math.round(rawScore * multiplier + amountBonus), 100);

        let badge = "";
        if (daysOverdue > 0) {
            badge = `${Math.round(daysOverdue)} día${Math.round(daysOverdue) !== 1 ? "s" : ""} vencida`;
        } else if (daysOverdue >= -7) {
            badge = `Vence en ${Math.round(-daysOverdue)} día${Math.round(-daysOverdue) !== 1 ? "s" : ""}`;
        } else {
            badge = `Pendiente`;
        }

        return { invoice: inv, client, urgencyScore, daysOverdue, badge };
    });

    return scored
        .sort((a, b) => b.urgencyScore - a.urgencyScore)
        .slice(0, limit);
}
