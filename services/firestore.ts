// services/firestore.ts
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "firebase/firestore";
import type { Activity, Client, Invoice } from "../models/types";
import { db } from "./firebase";

// --- Helpers ---

const userDoc = (uid: string) => doc(db, "users", uid);
const clientsColl = (uid: string) => collection(userDoc(uid), "clients");
const invoicesColl = (uid: string, clientId: string) => collection(doc(clientsColl(uid), clientId), "invoices");
const paymentsColl = (uid: string, clientId: string, invoiceId: string) =>
    collection(doc(invoicesColl(uid, clientId), invoiceId), "payments");

export async function updateUserSettings(uid: string, settings: any): Promise<void> {
    const ref = userDoc(uid);
    await updateDoc(ref, { settings });
}

export async function updateUserProfile(uid: string, data: { name?: string; phone?: string }): Promise<void> {
    const ref = userDoc(uid);
    await updateDoc(ref, data);
}

// --- Clientes ---

export async function getClients(uid: string): Promise<Client[]> {
    const q = query(clientsColl(uid), orderBy("name", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
}

export async function addClient(uid: string, client: Omit<Client, "id">): Promise<string> {
    const docRef = await addDoc(clientsColl(uid), {
        ...client,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

export async function updateClient(uid: string, clientId: string, data: Partial<Omit<Client, "id">>): Promise<void> {
    const ref = doc(clientsColl(uid), clientId);
    await updateDoc(ref, data);
}

export async function deleteClient(uid: string, clientId: string): Promise<void> {
    const ref = doc(clientsColl(uid), clientId);
    await deleteDoc(ref);
}

// --- Facturas ---

/**
 * Obtiene todas las facturas de un usuario usando Collection Group o iterando clientes.
 * Para cumplir con el requisito de anidación profunda sin Collection Group query global habilitado inicialmente,
 * podemos obtener las facturas por cliente. 
 * Sin embargo, para el Dashboard es mejor tener una lista plana.
 * NOTA: Firestore requiere un índice para Collection Group queries si se filtran/ordenan.
 */
export async function getAllInvoices(uid: string): Promise<Invoice[]> {
    // Implementación simple: buscar en todos los clientes
    const clients = await getClients(uid);
    const allInvoices: Invoice[] = [];

    for (const client of clients) {
        const q = query(invoicesColl(uid, client.id));
        const snap = await getDocs(q);
        snap.docs.forEach(d => {
            allInvoices.push({ id: d.id, clientId: client.id, ...d.data() } as Invoice);
        });
    }

    return allInvoices;
}

export async function getInvoicesByClient(uid: string, clientId: string): Promise<Invoice[]> {
    const q = query(invoicesColl(uid, clientId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, clientId, ...d.data() } as Invoice));
}

export async function addInvoice(uid: string, clientId: string, invoice: Omit<Invoice, "id" | "clientId">): Promise<string> {
    const docRef = await addDoc(invoicesColl(uid, clientId), {
        ...invoice,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

export async function updateInvoice(uid: string, clientId: string, invoiceId: string, data: Partial<Omit<Invoice, "id" | "clientId">>): Promise<void> {
    const ref = doc(invoicesColl(uid, clientId), invoiceId);
    await updateDoc(ref, data);
}

export async function deleteInvoice(uid: string, clientId: string, invoiceId: string): Promise<void> {
    const ref = doc(invoicesColl(uid, clientId), invoiceId);
    await deleteDoc(ref);
}

// --- Actividad (Opcional, guardado en user/{uid}/activity) ---

const activityColl = (uid: string) => collection(userDoc(uid), "activity");

export async function getActivities(uid: string): Promise<Activity[]> {
    const q = query(activityColl(uid), orderBy("ts", "desc"), where("ts", ">", "")); // o similar
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
}

export async function pushActivity(uid: string, activity: Omit<Activity, "id">): Promise<void> {
    await addDoc(activityColl(uid), activity);
}
