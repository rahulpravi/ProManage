import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stock">
        <Icon sf={{ default: "shippingbox", selected: "shippingbox.fill" }} />
        <Label>Stock</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="production">
        <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <Label>Production</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="qc">
        <Icon sf={{ default: "checkmark.shield", selected: "checkmark.shield.fill" }} />
        <Label>QC</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sales">
        <Icon sf={{ default: "cart", selected: "cart.fill" }} />
        <Label>Sales</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primaryLight,
        tabBarInactiveTintColor: COLORS.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : COLORS.surface,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: COLORS.cardBorder,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.surface }]} />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: "Stock",
          tabBarIcon: ({ color, size }) => <Ionicons name="cube" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="production"
        options={{
          title: "Production",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="qc"
        options={{
          title: "QC",
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: "Sales",
          tabBarIcon: ({ color, size }) => <Ionicons name="cart" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
