import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useResponsive } from "@/src/lib/responsive";
import { AppText, BrandLogo, Avatar } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/context/auth";

export function GlobalHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isDesktop, maxContentWidth } = useResponsive();
  const { user } = useAuth();

  // Hide entirely on mobile/tablet to let the standard bottom tabs and stack headers handle navigation natively.
  // Also hide on the auth screen to keep it clean.
  if (!isDesktop || pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <View style={[styles.header, { paddingTop: insets.top || 12 }]}>
      <View style={[styles.headerContent, { maxWidth: maxContentWidth }]}>
        <View style={styles.left}>
          <Pressable onPress={() => router.push("/")} style={styles.logoWrap}>
            <BrandLogo size={24} />
          </Pressable>
          <Pressable onPress={() => router.push("/explore")} style={[styles.searchBox, { outlineStyle: "none" } as any]}>
            <Feather name="search" size={16} color={colors.onSurfaceSecondary} />
            <AppText variant="body" color={colors.onSurfaceSecondary} style={{ marginLeft: 8 }}>
              Search
            </AppText>
          </Pressable>
        </View>

        <View style={styles.right}>
          <Pressable onPress={() => router.push("/explore")} style={styles.navLink}>
            <AppText variant="label" color={colors.onSurface}>Discover</AppText>
          </Pressable>
          <Pressable onPress={() => router.push("/campaign/new")} style={styles.navLink}>
            <AppText variant="label" color={colors.onSurface}>Start a GoodCause</AppText>
          </Pressable>
          {user ? (
            <Pressable onPress={() => router.push("/profile")} style={styles.profileBtn}>
              <Avatar name={user.name} uri={user.picture} size={36} />
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push("/auth")} style={styles.signInBtn}>
              <AppText variant="label" color={colors.onSurface}>Sign In</AppText>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 1000,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
  },
  logoWrap: {
    paddingVertical: 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.pill,
    width: 320,
    borderWidth: 1,
    borderColor: colors.border,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
  },
  navLink: {
    paddingVertical: 8,
  },
  signInBtn: {
    paddingVertical: 8,
  },
  profileBtn: {
    marginLeft: spacing.xs,
  },
});
