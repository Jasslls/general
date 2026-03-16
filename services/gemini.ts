import { GoogleGenerativeAI } from "@google/generative-ai";
import Constants from "expo-constants";
import type { Client, Invoice } from "../models/types";

const API_KEY = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || "").trim();

if (!API_KEY) {
    console.warn("EXPO_PUBLIC_GEMINI_API_KEY is missing. Gemini features won't work.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function getQuotaMessage(error: unknown): string | null {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate")) {
        return "Hoy ya se agotó la cuota diaria gratuita de IA. La cuota se renueva automáticamente a las 00:00 UTC (revisa en unas horas o mañana). Vuelve a intentarlo pronto 😊";
    }
    return null;
}


export type Tone = "amigable" | "formal" | "urgente";

export interface GeneratedMessages {
    amigable: string;
    formal: string;
    urgente: string;
    recommended: Tone;
}

export async function generateCollectionMessages(
    client: Client, 
    invoice: Invoice, 
    businessName: string = "tu negocio"
): Promise<GeneratedMessages> {
    if (!API_KEY) {
        throw new Error("No has configurado tu API Key de Gemini en el archivo .env todavía.");
    }

    const prompt = `
Eres un asistente de cobranza financiera experto en la redacción de mensajes de WhatsApp.
Tu negocio se llama "${businessName}". Siempre asume que escribes en representación de "${businessName}".
NUNCA inventes números de cuenta bancaria ni menciones los métodos de pago disponibles.

A continuación, tienes los detalles del cliente y de la factura pendiente:

**Cliente:**
- Nombre: ${client.name}
- Empresa: ${client.company || "No especificada"}
- Nivel de Riesgo de Impago: ${client.riskLevel}

**Factura:**
- ID: ${invoice.id}
- Monto a cobrar: ${invoice.amount} USD
- Fecha Vencimiento: ${invoice.due}

Por favor genera 3 mensajes de cobro distintos (JSON):
1. "amigable": Un recordatorio muy suave y amistoso.
2. "formal": Profesional y directo.
3. "urgente": Muy serio advirtiendo del atraso.

REGLAS PARA LA RECOMENDACIÓN ("recommended"):
- Prioridad 1 (Urgente): Si la factura ya está vencida (el estado es "Vencida" o ya pasó la fecha de vencimiento).
- Prioridad 2 (Formal): Si la factura vence hoy, mañana o en los próximos 2 días, O si el monto es grande (> 1000 USD), O si el riesgo del cliente es "alto".
- Prioridad 3 (Amigable): Si faltan más de 3 días para el vencimiento y el monto no es excesivo.

REGLAS CRÍTICAS PARA LOS MENSAJES:
- TODOS los mensajes deben empezar con un saludo respetuoso hacia el cliente (ej: "Hola ${client.name}", "Estimado ${client.name}").
- TODOS los mensajes deben identificarte claramente como parte del equipo de "${businessName}" (ej: "te escribimos de ${businessName}", "le saludamos de ${businessName}").
- Los mensajes deben ser claros sobre el monto (${invoice.amount} USD) y el estado de la factura.

Devuelve la respuesta ESTRICTAMENTE en este JSON válido:
{
  "amigable": "texto...",
  "formal": "texto...",
  "urgente": "texto...",
  "recommended": "amigable|formal|urgente"
}
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        const cleanedText = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
        
        const parsed = JSON.parse(cleanedText) as GeneratedMessages;
        return parsed;
    } catch (error) {
        console.error("Error generating messages with Gemini:", error);
        const quotaMsg = getQuotaMessage(error);
        throw new Error(quotaMsg ?? "Ocurrió un error al generar los mensajes con Inteligencia Artificial.");
    }
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

/**
 * Sends a message to Gemini acting as "Fijo", a financial assistant for PagoFijoHN.
 * It receives rich financial context and conversation history for multi-turn chat.
 */
export async function askFinancialAssistant(
    userMessage: string,
    history: ChatMessage[],
    context: FinancialContext
): Promise<string> {
    if (!API_KEY) {
        throw new Error("No has configurado tu API Key de Gemini en el archivo .env todavía.");
    }

    const systemContext = `
Eres "Fijito", el asistente financiero inteligente de PagoFijoHN.
Eres amable, conciso y muy profesional. Siempre respondes en español.
Tu misión es ayudar al usuario a entender su situación de cobranza y tomar decisiones inteligentes.
NUNCA inventes datos. Solo analiza la información real que se te proporciona.

TEMAS EN LOS QUE PUEDES AYUDAR:
- Resumen financiero general (cobrado, pendiente, vencido)
- Identificar a los peores deudores o quien debe más
- Facturas próximas a vencer o ya vencidas
- Tendencias: cómo van los cobros comparado con meses anteriores
- Consejos de cobranza: qué hacer con clientes que no pagan
- Redacción de mensajes de recordatorio de pago (cuando el usuario te lo pida, escribe un mensaje profesional corto listo para enviar por WhatsApp)
- Estadísticas: porcentaje de cobro, tasa de morosidad, promedio de deuda
- Priorización: a quién cobrarle primero y por qué
- Análisis de riesgo: qué clientes tienen mayor probabilidad de no pagar

REGLAS IMPORTANTES:
- Responde SIEMPRE en máximo 4 oraciones.
- NUNCA escribas propuestas de mensajes o el texto completo de un mensaje de WhatsApp/correo. 
- Si el usuario pregunta qué mensaje enviar o cómo cobrar, indícale brevemente el tono sugerido y menciona específicamente que debe usar el botón "📲 Notificar" que aparece en la app.
- No ofrezcas ayuda para redactar el mensaje tú mismo.
- Si el usuario pregunta por un cliente específico, usa los datos disponibles para responder sobre ese cliente.
- Si no tienes datos para responder algo, díselo amablemente.

=== ESTADO FINANCIERO ACTUAL ===
- Total de clientes: ${context.totalClients}
- Total de facturas: ${context.totalInvoices}
- Cobrado: $${context.collectedAmount.toFixed(2)}
- Pendiente (no cobrado): $${context.pendingAmount.toFixed(2)}
- Vencido (atrasado): $${context.overdueAmount.toFixed(2)}
- Facturas vencidas: ${context.overdueCount}
- Facturas pendientes activas: ${context.pendingCount}

${context.topDebtors.length > 0 ? `=== PRINCIPALES DEUDORES ===
${context.topDebtors.map((d, i) => `${i + 1}. ${d.name}: $${d.amount.toFixed(2)} (${d.status}${d.daysOverdue > 0 ? `, ${Math.round(d.daysOverdue)} días vencida` : ""})`).join("\n")}` : "(No hay deudores activos)"}

${context.upcomingInvoices.length > 0 ? `=== PRÓXIMAS A VENCER (30 días) ===
${context.upcomingInvoices.map((u) => `- ${u.client}: $${u.amount.toFixed(2)}, vence el ${u.dueDate} (en ${u.daysLeft} día${u.daysLeft !== 1 ? "s" : ""})`).join("\n")}` : "(No hay facturas próximas a vencer)"}

${context.recentPayments.length > 0 ? `=== PAGOS RECIENTES ===
${context.recentPayments.map((p) => `- ${p.client}: $${p.amount.toFixed(2)} el ${p.date}`).join("\n")}` : ""}
`;

    const contents = [
        {
            role: "user" as const,
            parts: [{ text: systemContext + "\n\nNueva pregunta del usuario: " + (history.length === 0 ? userMessage : "Empecemos.") }],
        },
        {
            role: "model" as const,
            parts: [{ text: "¡Hola! Soy Fijito, tu asistente financiero de PagoFijoHN. Estoy listo para ayudarte a entender tu situación de cobranza. ¿En qué te puedo ayudar?" }],
        },
        ...history.flatMap((msg) => ({
            role: msg.role === "user" ? ("user" as const) : ("model" as const),
            parts: [{ text: msg.text }],
        })),
        ...(history.length > 0 ? [{
            role: "user" as const,
            parts: [{ text: userMessage }],
        }] : []),
    ];

    try {
        const result = await model.generateContent({ contents });
        const rawText = result.response.text().trim();
        const cleanText = rawText
            .replace(/^(---+|===+)\s*/gm, "")
            .replace(/^#+\s*/gm, "")
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/\*(.*?)\*/g, "$1")
            .trim();
        return cleanText;
    } catch (error) {
        console.error("Chatbot error:", error);
        const quotaMsg = getQuotaMessage(error);
        throw new Error(quotaMsg ?? "Ocurrió un error al consultar al asistente financiero.");
    }
}
