import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, font } from "@/src/theme";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64 + insets.bottom,
          paddingBottom: Platform.OS === "ios" ? insets.bottom : 8,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontFamily: font.medium,
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Feather name="home" size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => <Feather name="search" size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarIcon: ({ color, size }) => <Feather name="bell" size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={21} color={color} />,
        }}
      />
    </Tabs>
  );
}
