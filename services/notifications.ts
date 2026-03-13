import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Invoice, Client } from "../models/types";

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function requestNotificationPermissions() {
    if (Platform.OS === "web") return false;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    return finalStatus === "granted";
}

export async function checkAndNotifyUrgentInvoices(invoices: Invoice[], clients: Client[]) {
    if (Platform.OS === "web") return;

    const today = new Date().toISOString().split("T")[0];
    const urgentInvoices = invoices.filter(inv => {
        return inv.status !== "Cobrada" && (inv.due === today || inv.due < today);
    });

    if (urgentInvoices.length > 0) {
        const title = urgentInvoices.length === 1 ? "Factura Pendiente" : "Facturas Pendientes";
        const body = urgentInvoices.length === 1 
            ? `Tienes una factura vencida hoy por cobrar.`
            : `Tienes ${urgentInvoices.length} facturas que requieren atención hoy.`;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: `📊 PagoFijo: ${title}`,
                body: body,
                data: { screen: "facturas" },
            },
            trigger: null, // Send immediately
        });
    }
}
