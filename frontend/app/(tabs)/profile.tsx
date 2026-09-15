import React, { useEffect } from "react";
import { View, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/auth";
import { useSubscription } from "@/src/lib/revenuecat";
import { AppText, Avatar, Card } from "@/src/components/ui";
import { colors, spacing, radius, shadow, font } from "@/src/theme";
import { formatNaira } from "@/src/format";
import { useResponsive } from "@/src/lib/responsive";

type Impact = {
  total_contributed_kobo: number;
  causes_supported: number;
  donations_count: number;
  campaigns_completed: number;
  following_count: number;
};

function CommitToHelpCard({ onPress }: { onPress: () => void }) {
  const floatAnim = useSharedValue(0);

  useEffect(() => {
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedCircle1 = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatAnim.value * -12 },
      { scale: 1 + floatAnim.value * 0.1 },
    ],
    opacity: 0.15 + floatAnim.value * 0.08,
  }));

  const animatedCircle2 = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatAnim.value * 10 },
      { scale: 1 - floatAnim.value * 0.06 },
    ],
    opacity: 0.1 + (1 - floatAnim.value) * 0.08,
  }));

  return (
    <Pressable
      testID="profile-pro-card"
      onPress={onPress}
      style={({ pressed }) => [
        styles.commitCard,
        pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
      ]}
    >
      {/* Animated Background Motion Elements */}
      <Animated.View style={[styles.commitBgCircle1, animatedCircle1]} />
      <Animated.View style={[styles.commitBgCircle2, animatedCircle2]} />
      <View style={styles.commitWatermark}>
        <Ionicons name="heart" size={120} color="rgba(255, 255, 255, 0.14)" />
      </View>

      {/* Header Pill */}
      <View style={styles.commitBadgePill}>
        <Ionicons name="sparkles" size={12} color={colors.brandPrimary} />
        <AppText style={styles.commitBadgeText}>Join Community</AppText>
      </View>

      {/* Content */}
      <View style={styles.commitCardContent}>
        <View style={{ flex: 1 }}>
          <AppText style={styles.commitCardTitle}>Commit to Help</AppText>
          <AppText style={styles.commitCardDesc}>
            Join over 1,200 monthly givers supporting verified causes across Nigeria.
          </AppText>
        </View>
        <View style={styles.commitArrowCircle}>
          <Feather name="arrow-right" size={20} color={colors.brandPrimary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, deleteAccount } = useAuth();
  const { isSubscribed } = useSubscription();
  const { feedMaxWidth } = useResponsive();
  const { data: impact } = useQuery({ queryKey: ["impact"], queryFn: () => api<Impact>("/impact") });

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account Permanently",
      "Are you sure you want to permanently delete your account? This action will remove your profile, saved causes, and campaign drafts. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete My Account",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              Alert.alert("Account Deleted", "Your account has been deleted.", [
                { text: "OK", onPress: () => router.replace("/auth") },
              ]);
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Could not delete account. Please try again.");
            }
          },
        },
      ]
    );
  };

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
                <View style={styles.proTag}><Ionicons name="shield-checkmark" size={11} color={colors.onBrandTertiary} /><AppText variant="caption" color={colors.onBrandTertiary} style={{ marginLeft: 4 }}>Active Member</AppText></View>
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

      {/* Commit to help */}
      {!isSubscribed ? (
        <CommitToHelpCard onPress={() => router.push("/onboarding/commitment")} />
      ) : null}

      {/* Menu */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm }}>
        <MenuItem icon="flag" label="My campaigns" onPress={() => router.push("/campaign/new?tab=mine")} testID="menu-my-campaigns" />
        <MenuItem icon="bookmark" label="Saved causes" onPress={() => router.push("/explore")} testID="menu-saved" />
        <MenuItem icon="users" label="My Circles" onPress={() => router.push("/circles")} testID="menu-circles" />
        <MenuItem icon="heart" label="Commit to Help" onPress={() => router.push("/onboarding/commitment")} testID="menu-pro" />
        <MenuItem icon="pie-chart" label="Impact Commitment" onPress={() => router.push("/impact-commitment")} testID="menu-impact" />
        <MenuItem icon="shield-off" label="Legal & Privacy" onPress={() => router.push("/privacy")} testID="menu-privacy" />
        {user?.role === "admin" ? (
          <MenuItem icon="shield" label="Admin dashboard" onPress={() => router.push("/admin")} testID="menu-admin" highlight />
        ) : null}
        <MenuItem icon="log-out" label="Sign out" onPress={() => { logout(); router.replace("/auth"); }} testID="menu-logout" danger />
        <MenuItem icon="trash-2" label="Delete account" onPress={handleDeleteAccount} testID="menu-delete-account" danger />
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
  commitCard: {
    backgroundColor: colors.brandPrimary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: 22,
    borderRadius: 24,
    position: "relative",
    overflow: "hidden",
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  commitBgCircle1: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    position: "absolute",
    right: -20,
    top: -40,
  },
  commitBgCircle2: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    position: "absolute",
    left: -40,
    bottom: -60,
  },
  commitWatermark: {
    position: "absolute",
    right: -10,
    bottom: -20,
    transform: [{ rotate: "-12deg" }],
  },
  commitBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  commitBadgeText: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.brandPrimary,
    marginLeft: 4,
  },
  commitCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commitCardTitle: {
    fontSize: 22,
    fontFamily: font.bold,
    color: "#FFFFFF",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  commitCardDesc: {
    fontSize: 13,
    fontFamily: font.regular,
    color: "rgba(255, 255, 255, 0.92)",
    lineHeight: 18,
    paddingRight: 8,
  },
  commitArrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});
