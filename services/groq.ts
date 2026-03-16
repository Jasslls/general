import type { Client, Invoice } from "../models/types";

const API_KEY = (process.env.EXPO_PUBLIC_GROQ_API_KEY || "").trim();
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const MODEL = "llama-3.3-70b-versatile"; 

export interface GeneratedMessages {
    amigable: string;
    formal: string;
    urgente: string;
    recommended: "amigable" | "formal" | "urgente";
}

export interface ChatMessage {
    role: "user" | "assistant";
    text: string;
}

export interface FinancialContext {
    totalClients: number;
    totalInvoices: number;
    pendingAmount: number;
    overdueAmount: number;
    collectedAmount: number;
    overdueCount: number;
    pendingCount: number;
    topDebtors: Array<{ name: string; amount: number; status: string; daysOverdue: number }>;
    recentPayments: Array<{ client: string; amount: number; date: string }>;
    upcomingInvoices: Array<{ client: string; amount: number; dueDate: string; daysLeft: number }>;
}

async function callGroq(messages: any[]) {
    if (!API_KEY) {
        throw new Error("GROQ_API_KEY is missing");
    }

    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: 0.7,
            max_tokens: 1024,
            response_format: { type: "json_object" }
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error("Groq API error:", error);
        throw new Error(error.error?.message || "Error calling Groq API");
    }

    return await response.json();
}

export async function generateCollectionMessagesGroq(
    client: Client, 
    invoice: Invoice,
    businessName: string = "tu negocio"
): Promise<GeneratedMessages> {
    const prompt = `
Eres un asistente de cobranza financiera experto en la redacción de mensajes de WhatsApp.
Tu negocio se llama "${businessName}". Siempre asume que escribes en representación de "${businessName}".

Detalles del cliente y factura:
- Cliente: ${client.name} (Riesgo: ${client.riskLevel})
- Factura: ${invoice.id}, Monto: ${invoice.amount} USD, Vencimiento: ${invoice.due}

Genera 3 mensajes de cobro (JSON):
1. "amigable": recordatorio suave.
2. "formal": profesional y directo.
3. "urgente": serio por atraso.

REGLAS DE RECOMENDACIÓN:
- Urgente: Si la factura ya venció o el riesgo es "alto".
- Formal: Si vence pronto (2 días o menos) o el monto es alto (>1000 USD).
- Amigable: Si aún faltan varios días para el vencimiento.

REGLAS OBLIGATORIAS:
- Todos los mensajes deben incluir un saludo cordial (ej: "Hola ${client.name}") y mencionar que escribes en nombre de "${businessName}".
- El cliente debe saber quién le escribe desde la primera frase.

Devuelve la respuesta ESTRICTAMENTE en este JSON:
{
  "amigable": "texto...",
  "formal": "texto...",
  "urgente": "texto...",
  "recommended": "amigable|formal|urgente"
}
`;

    const result = await callGroq([
        { role: "system", content: "You are a helpful assistant that outputs JSON." },
        { role: "user", content: prompt }
    ]);

    const content = result.choices[0].message.content;
    return JSON.parse(content) as GeneratedMessages;
}

export async function askFinancialAssistantGroq(
    userMessage: string,
    history: ChatMessage[],
    context: FinancialContext
): Promise<string> {
    if (!API_KEY) {
        throw new Error("No has configurado tu API Key de Groq en el archivo .env todavía.");
    }
    const systemContext = `
Eres "Fijito", el asistente financiero inteligente de PagoFijoHN.
Responde en español, máximo 4 oraciones. Sé profesional y amable.

REGLAS DE COMPORTAMIENTO:
- NUNCA escribas propuestas de mensajes de WhatsApp o correo en este chat. 
- Si el usuario quiere cobrar o enviar un mensaje, indícale que puede usar el botón "📲 Notificar" que aparece debajo de tu respuesta o en las opciones de la factura.
- No ofrezcas redactar el mensaje tú mismo, ya que hay una función dedicada para eso.

ESTADO FINANCIERO:
- Clientes: ${context.totalClients}, Facturas: ${context.totalInvoices}
- Cobrado: $${context.collectedAmount.toFixed(2)}, Pendiente: $${context.pendingAmount.toFixed(2)}, Vencido: $${context.overdueAmount.toFixed(2)}
- Vencidas: ${context.overdueCount}, Pendientes: ${context.pendingCount}

${context.topDebtors.length > 0 ? `DEUDORES: ${context.topDebtors.map(d => `${d.name} ($${d.amount})`).join(", ")}` : ""}
`;

    const messages = [
        { role: "system", content: systemContext },
        ...history.map(msg => ({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.text
        })),
        { role: "user", content: userMessage }
    ];

    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: 0.5,
            max_tokens: 512,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Groq Assistant Error:", errorData);
        throw new Error(`Error en Groq: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content.trim();
}
