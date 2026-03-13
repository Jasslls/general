import type { Client, Invoice } from "../models/types";
import { updateClient } from "./firestore";

export const RISK_LEVELS = {
    LOW: "bajo",
    MEDIUM: "medio",
    HIGH: "alto",
    UNKNOWN: "indeterminado",
} as const;

/**
 * Calculates the difference in days between two YYYY-MM-DD dates.
 */
function diffDays(date1: string, date2: string) {
    const d1 = new Date(date1).getTime();
    const d2 = new Date(date2).getTime();
    return (d1 - d2) / (1000 * 3600 * 24);
}

/**
 * Returns today's date in YYYY-MM-DD format
 */
export function getTodayYMD() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
}

/**
 * Calculates the Risk Score (0-100) and Level (bajo/medio/alto/indeterminado)
 * based on a client's invoice history.
 *
 * Rules:
 * 1. Base score: 0 (Min risk) to 100 (Max risk).
 * 2. Calculate percentage of unpaid/overdue invoices.
 * 3. Calculate max delay in days.
 */
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

    // 1. Percentage of overdue invoices (Weight: 60%)
    const overdueRatio = overdueCount / totalInvoices;
    const ratioScore = overdueRatio * 60; // Max 60 points

    // 2. Max Delay (Weight: 40%) - Cap at 30 days for max punishment
    const cappedDelay = Math.min(Math.max(maxDaysOverdue, 0), 30);
    const delayScore = (cappedDelay / 30) * 40; // Max 40 points

    const totalScore = Math.min(Math.round(ratioScore + delayScore), 100);

    let level: string = RISK_LEVELS.LOW;

    if (totalScore === 0 && overdueCount === 0) {
        // Si no tiene facturas vencidas, es Riesgo Bajo, pero si TODAS sus facturas están "Cobradas",
        // es riesgo bajo perfecto.
        level = RISK_LEVELS.LOW;
    }

    if (totalScore >= 70) {
        level = RISK_LEVELS.HIGH;
    } else if (totalScore >= 30) {
        level = RISK_LEVELS.MEDIUM;
    }

    // Special case: if there are no overdue invoices and client has paid everything, score is 0 and LOW.
    
    return { score: totalScore, level };
}

/**
 * Updates a client's risk score in Firestore by fetching their invoices, 
 * calculating their risk, and saving the updated Client document.
 * This should be called whenever an invoice state changes.
 */
export async function updateClientRiskFirestore(uid: string, clientId: string, invoices: Invoice[]) {
    const { score, level } = calculateClientRisk(invoices);
    
    // Solo actualizar (Parcial)
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
    daysOverdue: number;   // negative means days until due (upcoming)
    badge: string;         // human-readable reason for being in the list
}

/**
 * Ranks all pending/overdue invoices by urgency for the "Priority Collection" dashboard widget.
 *
 * Score Breakdown (0-100):
 *  - Overdue days (35 pts max): 1 pt per day, capped at 35 days.
 *  - Risk Multiplier: alto ×2, medio ×1.5, bajo ×1.
 *  - Amount bonus (15 pts): normalized against the highest invoice in the batch.
 *  - Upcoming penalty (10 pts): for Pendiente invoices about to expire in ≤7 days.
 */
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

        // Days overdue (positive = already past due)
        const daysOverdue = diffDays(today, inv.due ?? today);

        // 1. Overdue base bonus: VENCIDA status always gets a guaranteed head-start
        const isAlreadyOverdue = inv.status === "Vencida" || daysOverdue > 0;
        const overdueBonus = isAlreadyOverdue ? 40 : 0;

        // 2. Overdue accumulation (1pt/day, max 35)
        const overduePoints = isAlreadyOverdue ? Math.min(daysOverdue, 35) : 0;

        // 3. Upcoming penalty (max 10) — only for non-overdue
        const upcomingPoints = !isAlreadyOverdue && daysOverdue <= 0 && daysOverdue >= -7 ? 10 : 0;

        // Raw score before risk multiplier
        const rawScore = overdueBonus + overduePoints + upcomingPoints;

        // 3. Risk multiplier
        const multiplier = riskLevel === "alto" ? 2 : riskLevel === "medio" ? 1.5 : 1;

        // 4. Amount bonus (max 15)
        const amountBonus = Math.round(((inv.amount ?? 0) / maxAmount) * 15);

        const urgencyScore = Math.min(Math.round(rawScore * multiplier + amountBonus), 100);

        // Human-readable badge (time-based only, no risk level shown)
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
