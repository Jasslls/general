import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../themes/colors";

function isValidYYYYMMDD(s: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function ymdFromDate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function dateFromYmd(ymd: string) {
    // ymd "YYYY-MM-DD" -> Date local
    if (!isValidYYYYMMDD(ymd)) return new Date();
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function prettyYmd(ymd: string) {
    if (!isValidYYYYMMDD(ymd)) return "Seleccionar fecha";
    const [y, m, d] = ymd.split("-").map(Number);
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}

export function DateField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string; // "YYYY-MM-DD"
    onChange: (ymd: string) => void;
}) {
    const [open, setOpen] = useState(false);

    const currentDate = useMemo(() => dateFromYmd(value), [value]);
    const displayText = useMemo(() => prettyYmd(value), [value]);

    function onPick(e: DateTimePickerEvent, selected?: Date) {
        // Android dispara "dismissed" si cancelas
        if (Platform.OS === "android") setOpen(false);
        if (e.type === "dismissed") return;
        const dt = selected ?? currentDate;
        onChange(ymdFromDate(dt));
    }

    return (
        <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>{label}</Text>

            <Pressable
                onPress={() => setOpen(true)}
                style={({ pressed }) => [styles.inputLike, pressed && { opacity: 0.9 }]}
            >
                <Text style={[styles.value, !isValidYYYYMMDD(value) && { color: colors.muted }]}>
                    {displayText}
                </Text>
                <Text style={styles.chev}>▾</Text>
            </Pressable>

            {/* iOS: se puede mostrar inline bonito */}
            {open && Platform.OS === "ios" && (
                <View style={styles.pickerWrap}>
                    <DateTimePicker
                        value={currentDate}
                        mode="date"
                        display="inline"
                        onChange={onPick}
                    />
                    <Pressable onPress={() => setOpen(false)} style={styles.doneBtn}>
                        <Text style={styles.doneText}>Listo</Text>
                    </Pressable>
                </View>
            )}

            {/* Android: popup nativo */}
            {open && Platform.OS === "android" && (
                <DateTimePicker value={currentDate} mode="date" display="default" onChange={onPick} />
            )}

            {/* Web: sin meter libs raras, dejamos tu input anterior o texto.
          Si quieres calendario real en web, ahí sí tocaría otra lib. */}
            {open && Platform.OS === "web" && (
                <View style={styles.webHint}>
                    <Text style={styles.webHintText}>
                        En web no hay calendario nativo aquí sin librería extra. En móvil sí.
                    </Text>
                    <Pressable onPress={() => setOpen(false)} style={styles.doneBtn}>
                        <Text style={styles.doneText}>OK</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    label: { color: colors.muted, fontWeight: "800", marginBottom: 6 },
    inputLike: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        height: 44,
        paddingHorizontal: 12,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    value: { color: colors.text, fontWeight: "700" },
    chev: { color: colors.muted, fontWeight: "900", marginLeft: 12 },

    pickerWrap: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: colors.card,
    },
    doneBtn: {
        alignSelf: "flex-end",
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    doneText: { color: colors.primary, fontWeight: "900" },

    webHint: {
        marginTop: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
    },
    webHintText: { color: colors.muted, fontWeight: "600" },
});