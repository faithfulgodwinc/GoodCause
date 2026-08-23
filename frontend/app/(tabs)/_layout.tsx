import React from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadow } from "@/src/theme";
import { AppText } from "@/src/components/ui";

const TABS: { name: string; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { name: "index", label: "Home", icon: "home" },
  { name: "explore", label: "Explore", icon: "compass" },
  { name: "create", label: "Give", icon: "plus" },
  { name: "activity", label: "Activity", icon: "bell" },
  { name: "profile", label: "Account", icon: "user" },
];

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.dockContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.dock}>
        {state.routes.map((route: any, index: number) => {
          const meta = TABS.find((t) => t.name === route.name);
          if (!meta) return null;
          const focused = state.index === index;

          if (route.name === "create") {
            return (
              <Pressable
                key={route.key}
                testID="tab-create"
                style={styles.createItem}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  router.push("/campaign/new");
                }}
              >
                <View style={styles.createCircle}>
                  <Feather name="heart" size={20} color="#fff" />
                </View>
                <AppText variant="caption" color={colors.onSurfaceSecondary} style={styles.label}>
                  Start
                </AppText>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              testID={`tab-${meta.label.toLowerCase()}`}
              style={styles.tabItem}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Feather
                  name={meta.icon}
                  size={20}
                  color={focused ? colors.coral : colors.muted}
                />
              </View>
              <AppText
                variant="caption"
                color={focused ? colors.coral : colors.onSurfaceTertiary}
                style={[styles.label, focused && { fontFamily: "Inter-SemiBold", color: colors.coral }]}
              >
                {meta.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
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
  dockContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
    pointerEvents: "box-none",
  },
  dock: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 36,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    maxWidth: 480,
    borderWidth: 1,
    borderColor: "rgba(241, 245, 249, 0.8)",
    ...shadow.dock,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  iconWrap: {
    width: 38,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  iconWrapActive: {
    backgroundColor: colors.coralLight,
  },
  createItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  createCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.raised,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
  },
});

