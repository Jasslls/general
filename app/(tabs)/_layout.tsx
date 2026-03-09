// app/(tabs)/_layout.tsx
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { useAppColors } from "../../themes/colors";

export default function TabLayout() {
  const appColors = useAppColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: appColors.primary,
        tabBarInactiveTintColor: appColors.muted,
        tabBarStyle: {
          backgroundColor: appColors.card,
          borderTopColor: appColors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size ?? 26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="clientes"
        options={{
          title: "Clientes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size ?? 26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="facturas"
        options={{
          title: "Facturas",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size ?? 26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="cuenta"
        options={{
          title: "Cuenta",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size ?? 26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
