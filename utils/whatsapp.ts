import { Linking } from "react-native";

export function openWhatsApp(phone: string, text: string = "") {
    // 1. Limpiar el número (quitar espacios, guiones, parentesis)
    // Dejar solo dígitos.
    const numeric = phone.replace(/[^\d]/g, "");

    // 2. Validar longitud mínima (opcional, pero México suele ser 10 dígitos + lada)
    if (numeric.length < 10) {
        console.warn("Número muy corto para WhatsApp:", numeric);
        // Intentamos abrirlo igual, a veces el usuario pone extensiones
    }

    const encoded = encodeURIComponent(text);
    const url = `whatsapp://send?phone=${numeric}&text=${encoded}`;

    Linking.openURL(url).catch((err) => {
        console.error("Error al abrir WhatsApp:", err);
        alert("No se pudo abrir WhatsApp. Verifica que esté instalado.");
    });
}
