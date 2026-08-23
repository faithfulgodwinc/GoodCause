import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadow } from "@/src/theme";
import { AppText } from "@/src/components/ui";

const TABS: { name: string; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { name: "index", label: "Home", icon: "home" },
  { name: "explore", label: "Explore", icon: "compass" },
  { name: "create", label: "Create", icon: "plus" },
  { name: "activity", label: "Activity", icon: "bell" },
  { name: "profile", label: "Profile", icon: "user" },
];

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route: any, index: number) => {
        const meta = TABS.find((t) => t.name === route.name);
        if (!meta) return null;
        const focused = state.index === index;

        if (route.name === "create") {
          return (
            <Pressable
              key={route.key}
              testID="tab-create"
              style={styles.createWrap}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                router.push("/campaign/new");
              }}
            >
              <View style={styles.createBtn}>
                <Feather name="plus" size={26} color="#fff" />
              </View>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            testID={`tab-${meta.label.toLowerCase()}`}
            style={styles.item}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          >
            <Feather name={meta.icon} size={22} color={focused ? colors.brandPrimary : colors.muted} />
            <AppText variant="caption" color={focused ? colors.brandPrimary : colors.muted} style={{ marginTop: 3 }}>
              {meta.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderTopWidth: 1,
    borderTopColor: colors.border, paddingTop: 10, alignItems: "flex-start",
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center" },
  createWrap: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  createBtn: {
    width: 54, height: 54, borderRadius: 18, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", marginTop: -18, ...shadow.raised,
  },
});
