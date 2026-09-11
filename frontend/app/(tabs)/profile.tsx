import React from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/auth";
import { useSubscription } from "@/src/lib/revenuecat";
import { AppText, Avatar, Card } from "@/src/components/ui";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { formatNaira } from "@/src/format";
import { useResponsive } from "@/src/lib/responsive";

type Impact = {
  total_contributed_kobo: number;
  causes_supported: number;
  donations_count: number;
  campaigns_completed: number;
  following_count: number;
};

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isSubscribed } = useSubscription();
  const { feedMaxWidth } = useResponsive();
  const { data: impact } = useQuery({ queryKey: ["impact"], queryFn: () => api<Impact>("/impact") });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={{ alignSelf: "center", width: "100%", maxWidth: feedMaxWidth }}>
          <View style={styles.profileRow}>
            <Avatar name={user?.name} uri={user?.picture} size={58} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <AppText variant="h2">{user?.name}</AppText>
              <AppText variant="caption" style={{ marginTop: 2 }}>{user?.email}</AppText>
              {isSubscribed ? (
                <View style={styles.proTag}><Feather name="star" size={11} color={colors.onBrandTertiary} /><AppText variant="caption" color={colors.onBrandTertiary} style={{ marginLeft: 4 }}>GoodCause Pro</AppText></View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignSelf: "center", width: "100%", maxWidth: feedMaxWidth }}>
          {/* Impact */}
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <AppText variant="h2" style={{ marginBottom: spacing.md }}>Your impact</AppText>
            <Card style={{ padding: spacing.xl }}>
              <AppText variant="body">You have contributed</AppText>
              <AppText variant="display" color={colors.brandPrimary} style={{ marginTop: 2 }}>
                {formatNaira(impact?.total_contributed_kobo || 0)}
              </AppText>
              <AppText variant="body" style={{ marginTop: spacing.xs }}>
                across {impact?.causes_supported || 0} {impact?.causes_supported === 1 ? "cause" : "causes"}, thank you for your generosity.
              </AppText>
              <View style={styles.statsRow}>
                <Stat value={String(impact?.donations_count || 0)} label="Donations" />
                <Stat value={String(impact?.campaigns_completed || 0)} label="Completed" />
                <Stat value={String(impact?.following_count || 0)} label="Following" />
              </View>
            </Card>
          </View>

      {/* Pro */}
      {!isSubscribed ? (
        <Pressable testID="profile-pro-card" onPress={() => router.push("/paywall")} style={styles.proCard}>
          <View style={{ flex: 1 }}>
            <AppText variant="title" color="#fff">Go Pro</AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 2 }}>
              AI assistant, advanced analytics, QR kit & more
            </AppText>
          </View>
          <Feather name="arrow-right" size={20} color="#fff" />
        </Pressable>
      ) : null}

      {/* Menu */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm }}>
        <MenuItem icon="flag" label="My campaigns" onPress={() => router.push("/campaign/new?tab=mine")} testID="menu-my-campaigns" />
        <MenuItem icon="bookmark" label="Saved causes" onPress={() => router.push("/explore")} testID="menu-saved" />
        <MenuItem icon="users" label="My Circles" onPress={() => router.push("/circles")} testID="menu-circles" />
        <MenuItem icon="star" label="GoodCause Pro" onPress={() => router.push("/paywall")} testID="menu-pro" />
        <MenuItem icon="shield-off" label="Legal & Privacy" onPress={() => router.push("/privacy")} testID="menu-privacy" />
        {user?.role === "admin" ? (
          <MenuItem icon="shield" label="Admin dashboard" onPress={() => router.push("/admin")} testID="menu-admin" highlight />
        ) : null}
        <MenuItem icon="log-out" label="Sign out" onPress={() => { logout(); router.replace("/auth"); }} testID="menu-logout" danger />
      </View>

      <AppText variant="caption" style={{ textAlign: "center", marginTop: spacing.xl }}>
        GoodCause · Trust makes generosity go further.
      </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="h1">{value}</AppText>
      <AppText variant="caption" style={{ marginTop: 2 }}>{label}</AppText>
    </View>
  );
}

function MenuItem({ icon, label, onPress, danger, highlight, testID }: {
  icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; danger?: boolean; highlight?: boolean; testID?: string;
}) {
  const color = danger ? colors.error : highlight ? colors.brandPrimary : colors.onSurface;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.85 }]}>
      <Feather name={icon} size={20} color={color} />
      <AppText variant="bodyMedium" color={color} style={{ flex: 1, marginLeft: spacing.md }}>{label}</AppText>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, backgroundColor: colors.surfaceSecondary },
  profileRow: { flexDirection: "row", alignItems: "center" },
  proTag: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 6, backgroundColor: colors.brandTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  statsRow: { flexDirection: "row", marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  stat: { flex: 1 },
  proCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.brandDark,
    marginHorizontal: spacing.lg, marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.lg, ...shadow.card,
  },
  menuItem: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg,
  },
});
