export type Client = {
    id: string;
    name: string;
    company: string;
    email: string;
    phone: string;
    rfc: string;
    riskLevel?: "bajo" | "medio" | "alto" | "indeterminado";
    riskScore?: number;
};

export type InvoiceStatus = "Vencida" | "Pendiente" | "Cobrada";
export type InvoiceRecurrence = "none" | "semanal" | "mensual" | "anual";

export type Invoice = {
    id: string;        // FAC-2026-001
    clientId: string;  // referencia a Client.id
    desc: string;
    amount: number;
    due: string;       // YYYY-MM-DD
    status: InvoiceStatus;
    recurrence?: InvoiceRecurrence;
    lastRecurrenceGeneratedDate?: string;
    proofUri?: string; // URI del comprobante de pago
    paidAmount?: number; // Monto ya pagado mediante abonos
};

// ✅ Nuevo: historial de actividad
export type ActivityType =
    | "invoice_created"
    | "invoice_updated"
    | "invoice_paid"
    | "invoice_partial_paid"
    | "invoice_deleted";

export type Activity = {
    id: string;        // uid
    ts: string;        // ISO datetime
    type: ActivityType;

    invoiceId?: string;
    clientId?: string;

    amount?: number;
    status?: InvoiceStatus;
    desc?: string;
    due?: string;      // YYYY-MM-DD
    proofUri?: string; // ✅ Nuevo
};
// ─── Premium ─────────────────────────────────────────────────────────────────
export type PremiumPlan = "none" | "trial" | "monthly" | "annual";

export interface PremiumStatus {
    plan: PremiumPlan;
    activatedAt: string | null;
    expiresAt: string | null;
    isActive: boolean;
}
