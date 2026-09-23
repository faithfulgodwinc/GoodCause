import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/auth";
import { AppText, Avatar } from "@/src/components/ui";
import { CampaignCard, Campaign } from "@/src/components/CampaignCard";
import { useResponsive } from "@/src/lib/responsive";
import { colors, spacing, radius, font } from "@/src/theme";
import { useSubscription } from "@/src/lib/revenuecat";

type HomeData = {
  featured: Campaign[];
  urgent: Campaign[];
  almost_funded: Campaign[];
  recently_updated: Campaign[];
  recommended: Campaign[];
  all_campaigns?: Campaign[];
  categories: { id: string; name: string; slug: string; icon: string; color: string }[];
  greeting_name?: string | null;
  impact_metrics?: {
    members_count: number;
    given_this_month_kobo: number;
    causes_helped_count: number;
  };
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { maxContentWidth } = useResponsive();
  const { isSubscribed } = useSubscription();

  const { data, isRefetching, refetch } = useQuery({
    queryKey: ["home"],
    queryFn: () => api<HomeData>("/home"),
  });

  const { featured = [], urgent = [], recommended = [], all_campaigns = [], greeting_name, impact_metrics } = data || {};
  const displayName = greeting_name || (user?.name ? user.name.split(" ")[0] : "Friend");

  const membersDisplay = impact_metrics?.members_count
    ? impact_metrics.members_count.toLocaleString()
    : "0";
  const givenDisplay = impact_metrics?.given_this_month_kobo
    ? `₦${(impact_metrics.given_this_month_kobo / 10000000).toFixed(1)}M`
    : "₦0";
  const causesDisplay = impact_metrics?.causes_helped_count
    ? impact_metrics.causes_helped_count.toLocaleString()
    : "0";

  const hour = new Date().getHours();
  let timeGreeting = "Good evening";
  if (hour < 12) timeGreeting = "Good morning";
  else if (hour < 17) timeGreeting = "Good afternoon";

  const hasCommitment = isSubscribed;
  const directCauses = React.useMemo(() => {
    const map = new Map<string, Campaign>();
    [...featured, ...urgent, ...recommended, ...(all_campaigns || [])].forEach((c) => {
      if (c && c.id && !map.has(c.id)) map.set(c.id, c);
    });
    return Array.from(map.values()).slice(0, 10);
  }, [featured, urgent, recommended, all_campaigns]);

  const handleProfilePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/profile");
  };



  const handleSeeAllPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/explore");
  };

  return (
    <View style={styles.screenContainer}>
      {/* Apple-style Navigation Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "android" ? insets.top + 16 : insets.top + 16 },
        ]}
      >
        <View style={styles.headerLeft}>
          <Pressable onPress={handleProfilePress} style={styles.avatarPressable}>
            <Avatar name={user?.name} uri={user?.picture} size={42} />
          </Pressable>
          <View style={styles.greetingBox}>
            <AppText style={styles.timeGreetingText}>
              {timeGreeting}
            </AppText>
            <AppText variant="h2" style={styles.nameText}>
              {displayName}
            </AppText>
          </View>
        </View>

        <Pressable 
          hitSlop={12} 
          style={({ pressed }) => [styles.bellButton, pressed && { opacity: 0.6 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(tabs)/activity");
          }}
        >
          <Feather name="bell" size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: spacing.xs }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={isRefetching} 
            onRefresh={refetch} 
            tintColor={colors.brandPrimary} 
          />
        }
      >
        <View style={{ alignSelf: "center", width: "100%", maxWidth: maxContentWidth }}>
          
          {/* Apple-Style Community Pledge Card */}
          <Pressable 
            onPress={() => {
              if (!hasCommitment) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/paywall");
              } else {
                router.push("/impact-commitment");
              }
            }}
            style={styles.pledgeCard}
          >
            {/* Background side design */}
            <View style={styles.pledgeBgCircle1} />
            <View style={styles.pledgeBgCircle2} />
            <View style={styles.pledgeWatermark}>
              <Ionicons name="shield-checkmark" size={110} color="rgba(255, 255, 255, 0.12)" />
            </View>

            <View style={styles.pledgeHeader}>
              <View style={styles.badgePill}>
                <Ionicons name="shield-checkmark" size={13} color={colors.brandPrimary} />
                <AppText style={styles.badgeText}>
                  {hasCommitment ? "Active Pro" : "GoodCause Pro"}
                </AppText>
              </View>
            </View>

            <View style={styles.pledgeBody}>
              <View style={styles.pledgeAmountRow}>
                <AppText style={styles.pledgeAmount}>
                  {hasCommitment ? "Pro tools active" : "Unlock Pro tools"}
                </AppText>
              </View>
              <AppText style={styles.pledgeDesc}>
                {hasCommitment
                  ? "Run multiple active campaigns and use organizer tools for updates, supporter thank-yous, and QR sharing."
                  : "Unlock multiple active campaigns, supporter thank-yous, campaign updates, and QR sharing."}
              </AppText>
            </View>
          </Pressable>

          {/* Apple Native Style Impact Metrics */}
          <View style={styles.section}>
            <AppText style={styles.sectionHeaderTitle}>
              Community Impact
            </AppText>
            <View style={styles.impactContainer}>
              <View style={styles.impactCol}>
                <AppText style={styles.impactNumber}>{membersDisplay}</AppText>
                <AppText style={styles.impactSublabel}>Community accounts</AppText>
              </View>
              
              <View style={styles.impactDivider} />
              
              <View style={styles.impactCol}>
                <AppText style={styles.impactNumber}>{givenDisplay}</AppText>
                <AppText style={styles.impactSublabel}>Raised on GoodCause</AppText>
              </View>
              
              <View style={styles.impactDivider} />
              
              <View style={styles.impactCol}>
                <AppText style={styles.impactNumber}>{causesDisplay}</AppText>
                <AppText style={styles.impactSublabel}>Causes helped</AppText>
              </View>
            </View>
          </View>

          {/* Causes List Section */}
          {directCauses.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <AppText style={styles.sectionHeaderTitle}>
                  Causes to support
                </AppText>
                <Pressable 
                  onPress={handleSeeAllPress} 
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <AppText style={styles.seeAllText}>See all</AppText>
                </Pressable>
              </View>
              
              <View style={styles.causesList}>
                {directCauses.map((c) => (
                  <View key={c.id} style={styles.causeCardItem}>
                    <CampaignCard 
                      c={c} 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(`/campaign/${c.id}`);
                      }} 
                    />
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
  screenContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  // Apple Navigation Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarPressable: {
    marginRight: 12,
  },
  greetingBox: {
    justifyContent: "center",
  },
  timeGreetingText: {
    fontSize: 13,
    fontFamily: font.medium,
    color: colors.onSurfaceSecondary,
    marginBottom: 1,
  },
  nameText: {
    fontSize: 20,
    fontFamily: font.bold,
    color: colors.onSurface,
    letterSpacing: -0.4,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F4F5F7",
    alignItems: "center",
    justifyContent: "center",
  },

  // Community Pledge Card (Apple Grouped Style)
  pledgeCard: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 22,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 28,
    padding: 20,
    position: "relative",
    overflow: "hidden",
    // Soft subtle shadow
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  pledgeBgCircle1: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    position: "absolute",
    right: -30,
    top: -40,
  },
  pledgeBgCircle2: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    position: "absolute",
    right: -50,
    bottom: -60,
  },
  pledgeWatermark: {
    position: "absolute",
    right: -12,
    bottom: -20,
    transform: [{ rotate: "-15deg" }],
  },
  pledgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.brandPrimary,
    marginLeft: 4,
  },
  heartCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  pledgeBody: {
    marginTop: 2,
  },
  pledgeAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
    paddingTop: 4,
  },
  pledgeAmount: {
    fontSize: 30,
    lineHeight: 38,
    paddingTop: 2,
    fontFamily: font.bold,
    color: "#FFFFFF",
    letterSpacing: -0.6,
  },
  pledgeSub: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: font.regular,
    color: "rgba(255, 255, 255, 0.8)",
    marginLeft: 4,
  },
  pledgeDesc: {
    fontSize: 13,
    fontFamily: font.regular,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 19,
  },

  // Section Typography
  section: {
    marginBottom: 28,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontFamily: font.bold,
    color: colors.onSurface,
    letterSpacing: -0.4,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 20,
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: font.semibold,
    color: colors.brandPrimary,
  },

  // Impact Section (Apple Inset Style)
  impactContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    marginHorizontal: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  impactCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  impactNumber: {
    fontSize: 17,
    fontFamily: font.bold,
    color: colors.onSurface,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  impactSublabel: {
    fontSize: 11,
    fontFamily: font.regular,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
  },
  impactDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E2E8F0",
  },

  // Causes Feed
  causesList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  causeCardItem: {
    borderRadius: 18,
    overflow: "hidden",
  },
});
