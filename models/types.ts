export type Client = {
    id: string;
    name: string;
    company: string;
    email: string;
    phone: string;
    rfc: string;
};

export type InvoiceStatus = "Vencida" | "Pendiente" | "Cobrada";

export type Invoice = {
    id: string;        // FAC-2026-001
    clientId: string;  // referencia a Client.id
    desc: string;
    amount: number;
    due: string;       // YYYY-MM-DD
    status: InvoiceStatus;
};

// ✅ Nuevo: historial de actividad
export type ActivityType =
    | "invoice_created"
    | "invoice_updated"
    | "invoice_paid"
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
};
