import { generateCollectionMessages, askFinancialAssistant, type GeneratedMessages, type ChatMessage, type FinancialContext } from "./gemini";
import { generateCollectionMessagesGroq, askFinancialAssistantGroq } from "./groq";
import type { Client, Invoice } from "../models/types";

function isQuotaError(error: any): boolean {
    const msg = String(error).toLowerCase();
    return msg.includes("429") || 
           msg.includes("quota") || 
           msg.includes("cuota") || 
           msg.includes("limit") || 
           msg.includes("rate") ||
           msg.includes("exhausted") ||
           msg.includes("agotó");
}

export async function getCollectionMessages(
    client: Client, 
    invoice: Invoice,
    businessName?: string
): Promise<GeneratedMessages> {
    try {
        console.log(`Intentando generar mensajes con Gemini para ${businessName}...`);
        return await generateCollectionMessages(client, invoice, businessName);
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn("Límite de Gemini alcanzado. Usando Groq como respaldo...");
            try {
                return await generateCollectionMessagesGroq(client, invoice, businessName);
            } catch (groqError) {
                console.error("Error en Groq (fallback):", groqError);
                throw new Error("Lo sentimos, todos nuestros servicios de IA están saturados en este momento. Por favor, intenta más tarde.");
            }
        }
        throw error;
    }
}

export async function askAssistant(
    userMessage: string,
    history: ChatMessage[],
    context: FinancialContext
): Promise<string> {
    try {
        console.log("Consultando a Fijito (Gemini)...");
        return await askFinancialAssistant(userMessage, history, context);
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn("Límite de Gemini alcanzado. Usando Groq como respaldo...");
            try {
                return await askFinancialAssistantGroq(userMessage, history, context);
            } catch (groqError: any) {
                console.error("Error en Groq (fallback):", groqError);
                throw new Error(`Lo sentimos, el asistente está saturado. (Límite de Gemini alcanzado y Groq falló: ${groqError.message})`);
            }
        }
        throw error;
    }
}
