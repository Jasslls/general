import { getAllInvoices, getClients, addInvoice, updateInvoice, pushActivity } from "./firestore";
import { updateClientRiskFirestore } from "./riskEngine";
import { Invoice, InvoiceStatus, InvoiceRecurrence } from "../models/types";

/**
 * Returns today's date in YYYY-MM-DD
 */
function getTodayYMD() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
}

/**
 * Adds days/months/years to a YYYY-MM-DD date and returns a new YYYY-MM-DD date.
 */
function addTime(dateStr: string, recurrence: InvoiceRecurrence): string {
    const d = new Date(dateStr + "T00:00:00");
    if (recurrence === "semanal") {
        d.setDate(d.getDate() + 7);
    } else if (recurrence === "mensual") {
        d.setMonth(d.getMonth() + 1);
    } else if (recurrence === "anual") {
        d.setFullYear(d.getFullYear() + 1);
    }
    return d.toISOString().split("T")[0];
}

/**
 * Syncs the entire business logic (Risk Engine & Recurring Invoices).
 * This should be called once when the user opens the dashboard or logs in.
 */
export async function syncBusinessIntelligence(uid: string) {
    try {
        console.log("Starting BI Sync...");
        
        const clients = await getClients(uid);
        let allInvoices = await getAllInvoices(uid);
        const today = getTodayYMD();
        
        // --- 1. GENERATE RECURRING INVOICES ---
        let newInvoicesAdded = false;

        for (const invoice of allInvoices) {
            // Check if it is a recurring invoice
            if (invoice.recurrence && invoice.recurrence !== "none") {
                // If the due date is in the future, we don't start recurring it yet
                if (invoice.due > today) {
                    continue;
                }

                // If it already generated something in the future, skip
                if (invoice.lastRecurrenceGeneratedDate && invoice.lastRecurrenceGeneratedDate > today) {
                    continue;
                }
                
                let lastGen = invoice.lastRecurrenceGeneratedDate || invoice.due;
                let maxIterations = 24; // Limit to 24 generations at once
                let finalGenDate = lastGen;
                
                while (lastGen <= today && maxIterations > 0) {
                    const nextDate = addTime(lastGen, invoice.recurrence);
                    maxIterations--;
                    
                    // Create new invoice for the next date
                    await addInvoice(uid, invoice.clientId, {
                        desc: invoice.desc,
                        amount: invoice.amount,
                        due: nextDate,
                        status: "Pendiente",
                        recurrence: invoice.recurrence,
                    });

                    lastGen = nextDate;
                    finalGenDate = nextDate;
                    newInvoicesAdded = true;
                }

                // Update the original invoice so we don't duplicate
                if (finalGenDate !== (invoice.lastRecurrenceGeneratedDate || invoice.due)) {
                    await updateInvoice(uid, invoice.clientId, invoice.id, {
                        lastRecurrenceGeneratedDate: finalGenDate,
                        recurrence: "none" // Turn off recurrence on older invoices to avoid chain loops (only newest has it)
                    });
                }
            }
        }

        if (newInvoicesAdded) {
            allInvoices = await getAllInvoices(uid); // Refresh invoices after generation
        }

        // --- 2. UPDATE CLIENT RISK SCORES ---
        const invoicesByClient: Record<string, Invoice[]> = {};
        for (const inv of allInvoices) {
            if (!invoicesByClient[inv.clientId]) {
                invoicesByClient[inv.clientId] = [];
            }
            invoicesByClient[inv.clientId].push(inv);
        }

        for (const client of clients) {
            const clientInvoices = invoicesByClient[client.id] || [];
            await updateClientRiskFirestore(uid, client.id, clientInvoices);
        }

        console.log("BI Sync completed successfully.");
    } catch (error) {
        console.error("Error running BI Sync:", error);
    }
}
