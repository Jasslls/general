import React from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { lightColors, useAppColors } from "../themes/colors";

const PREMIUM_GUIDE = [
    { 
        icon: "🤖", 
        title: "Fijito IA", 
        desc: "Tu asistente financiero inteligente.",
        location: "Pestaña 'Asistente' en la barra inferior."
    },
    { 
        icon: "✨", 
        title: "Mensajes con IA", 
        desc: "Redacta recordatorios personalizados.",
        location: "Icono de campana 🔔 en cada factura."
    },
    { 
        icon: "📊", 
        title: "Reportes Pro", 
        desc: "Analiza tu flujo y deudores.",
        location: "Botón 'Reportes' en la pantalla de Inicio."
    },
    { 
        icon: "🎯", 
        title: "Niveles de Riesgo", 
        desc: "Identifica clientes problemáticos.",
        location: "Sección 'Riesgo' en la lista de Clientes."
    },
    { 
        icon: "🔁", 
        title: "Facturas Recurrentes", 
        desc: "Automatiza tus cobros fijos.",
        location: "Al crear o editar una factura."
    },
    { 
        icon: "📈", 
        title: "Expansión de registros", 
        desc: "Carga más de 10 clientes y 20 facturas.",
        location: "Ilimitado en toda la aplicación."
    },
];

interface Props {
    visible: boolean;
    onClose: () => void;
}

export function PremiumWelcomeContent({ onClose }: { onClose: () => void }) {
    const colors = useAppColors();
    const styles = getStyles(colors);

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.crown}>🎉</Text>
                <Text style={styles.title}>¡Eres Premium!</Text>
                <Text style={styles.subtitle}>Aquí tienes tus nuevas herramientas</Text>
            </View>

            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                {PREMIUM_GUIDE.map((item, i) => (
                    <View key={i} style={styles.guideRow}>
                        <View style={styles.iconBox}>
                            <Text style={styles.iconText}>{item.icon}</Text>
                        </View>
                        <View style={styles.info}>
                            <Text style={styles.itemTitle}>{item.title}</Text>
                            <Text style={styles.itemDesc}>{item.desc}</Text>
                            <View style={styles.locationBadge}>
                                <Text style={styles.locationText}>📍 {item.location}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </ScrollView>

            <Pressable 
                onPress={onClose}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.8 }]}
            >
                <Text style={styles.closeBtnText}>¡Entendido!</Text>
            </Pressable>
        </View>
    );
}

export function PremiumWelcomeModal({ visible, onClose }: Props) {
    const colors = useAppColors();
    const styles = getStyles(colors);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <PremiumWelcomeContent onClose={onClose} />
            </View>
        </Modal>
    );
}


const getStyles = (colors: typeof lightColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center",
        padding: 20,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: 24,
        maxHeight: "85%",
        overflow: "hidden",
    },
    header: {
        alignItems: "center",
        padding: 24,
        backgroundColor: colors.primary + "10",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    crown: { fontSize: 48, marginBottom: 8 },
    title: { fontSize: 24, fontWeight: "900", color: colors.text },
    subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, fontWeight: "600" },
    
    body: { paddingHorizontal: 20 },
    guideRow: {
        flexDirection: "row",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 16,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconText: { fontSize: 24 },
    info: { flex: 1 },
    itemTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
    itemDesc: { fontSize: 13, color: colors.muted, marginTop: 2, fontWeight: "500" },
    locationBadge: {
        alignSelf: "flex-start",
        backgroundColor: colors.primary + "15",
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginTop: 6,
    },
    locationText: { color: colors.primary, fontSize: 11, fontWeight: "800" },

    closeBtn: {
        backgroundColor: colors.primary,
        margin: 20,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: "center",
    },
    closeBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
