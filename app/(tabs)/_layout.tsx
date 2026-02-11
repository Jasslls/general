// app/(tabs)/_layout.tsx
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
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
    </Tabs>
  );
}
