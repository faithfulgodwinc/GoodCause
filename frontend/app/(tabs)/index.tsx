import React, { useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Platform,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/auth";
import { AppText, Avatar } from "@/src/components/ui";
import { CampaignCard, Campaign } from "@/src/components/CampaignCard";
import { useResponsive } from "@/src/lib/responsive";
import { colors, spacing, radius, shadow, font } from "@/src/theme";
import { useSubscription } from "@/src/lib/revenuecat";

type HomeData = {
  featured: Campaign[];
  urgent: Campaign[];
  almost_funded: Campaign[];
  recently_updated: Campaign[];
  recommended: Campaign[];
  categories: { id: string; name: string; slug: string; icon: string; color: string }[];
  greeting_name?: string | null;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { maxContentWidth } = useResponsive();
  const { currentPackage } = useSubscription();

  const { data, isRefetching, refetch } = useQuery({
    queryKey: ["home"],
    queryFn: () => api<HomeData>("/home"),
  });

  const { urgent = [], recommended = [], greeting_name } = data || {};
  const displayName = greeting_name || (user?.name ? user.name.split(" ")[0] : "Faithful");

  const hour = new Date().getHours();
  let timeGreeting = "Good evening";
  if (hour < 12) timeGreeting = "Good morning";
  else if (hour < 17) timeGreeting = "Good afternoon";

  const committedAmount = currentPackage ? currentPackage.product.priceString : "₦5,000";
  const directCauses = [...urgent, ...recommended].slice(0, 5);

  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(heartScale, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.timing(heartScale, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(heartScale, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.timing(heartScale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [heartScale]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "android" ? insets.top + spacing.md : insets.top },
        ]}
      >
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.push("/profile")}>
            <Avatar name={user?.name} uri={user?.picture} size={44} />
          </Pressable>
          <View style={{ marginLeft: spacing.sm }}>
            <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ fontSize: 13 }}>
              {timeGreeting},
            </AppText>
            <AppText variant="h2" style={{ fontSize: 18, marginTop: -2 }}>
              {displayName} 👋
            </AppText>
          </View>
        </View>
        <Pressable hitSlop={12} style={styles.bellIcon}>
          <Feather name="bell" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: spacing.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={{ alignSelf: "center", width: "100%", maxWidth: maxContentWidth }}>
          
          {/* Commitment Card */}
          <View style={styles.commitmentCard}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <AppText style={styles.ccTitle}>Your GoodCause</AppText>
              <View style={styles.ccAmountRow}>
                <AppText style={styles.ccAmount}>{committedAmount}</AppText>
                <AppText style={styles.ccSub}> /month</AppText>
              </View>
              <AppText style={styles.ccDesc}>
                You're part of a community helping people across Nigeria.
              </AppText>
            </View>
            <View style={styles.ccIconBox}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons name="heart" size={20} color={colors.brandPrimary} />
              </Animated.View>
            </View>
          </View>

          {/* Impact Section */}
          <View style={styles.section}>
            <AppText variant="h2" style={styles.sectionTitle}>
              This month's impact
            </AppText>
            <View style={styles.impactRow}>
              <View style={styles.impactCard}>
                <AppText style={styles.impactValue} adjustsFontSizeToFit numberOfLines={1}>1,284</AppText>
                <AppText style={styles.impactLabel}>GoodCauses have contributed</AppText>
              </View>
              <View style={styles.impactCard}>
                <AppText style={styles.impactValue} adjustsFontSizeToFit numberOfLines={1}>₦8,420,000</AppText>
                <AppText style={styles.impactLabel}>committed this month</AppText>
              </View>
              <View style={styles.impactCard}>
                <AppText style={styles.impactValue} adjustsFontSizeToFit numberOfLines={1}>145</AppText>
                <AppText style={styles.impactLabel}>verified causes receiving support</AppText>
              </View>
            </View>
          </View>

          {/* Causes you can support directly */}
          {directCauses.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <AppText variant="h2" style={{ flex: 1 }}>Causes you can support directly</AppText>
                <Pressable onPress={() => router.push("/explore")}>
                  <AppText variant="label" color={colors.brandPrimary}>See all</AppText>
                </Pressable>
              </View>
              
              <View style={styles.listWrap}>
                {directCauses.map((c) => (
                  <View key={c.id} style={styles.causeItemWrapper}>
                    <CampaignCard c={c} onPress={() => router.push(`/campaign/${c.id}`)} />
                    <Pressable 
                      style={styles.supportBtn}
                      onPress={() => router.push(`/campaign/${c.id}`)}
                    >
                      <AppText style={styles.supportBtnText}>Support this cause →</AppText>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  bellIcon: {
    width: 40,
    height: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  
  commitmentCard: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 20,
    marginHorizontal: spacing.lg,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadow.card,
  },
  ccTitle: {
    color: colors.brandTertiary,
    fontSize: 13,
    fontFamily: font.bold,
    marginBottom: 4,
  },
  ccAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  ccAmount: {
    color: colors.surface,
    fontSize: 28,
    fontFamily: font.bold,
    letterSpacing: -0.5,
  },
  ccSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontFamily: font.medium,
  },
  ccDesc: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    lineHeight: 18,
  },
  ccIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  section: {
    marginTop: 32,
  },
  sectionTitle: {
    paddingHorizontal: spacing.lg,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: 16,
  },

  impactRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  impactCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  impactValue: {
    fontSize: 16,
    fontFamily: font.bold,
    color: colors.brandPrimary,
    marginBottom: 4,
  },
  impactLabel: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    lineHeight: 14,
  },

  listWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  causeItemWrapper: {
    backgroundColor: colors.surface,
  },
  supportBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  supportBtnText: {
    color: colors.surface,
    fontSize: 14,
    fontFamily: font.bold,
  },
});
