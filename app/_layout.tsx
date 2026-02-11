// app/_layout.tsx
import { Stack } from "expo-router";
import React from "react";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Tus tabs reales viven dentro de (tabs) */}
      <Stack.Screen name="(tabs)" />

      {/* Si tienes app/modal.tsx, aquí queda como modal (no como tab) */}
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}
