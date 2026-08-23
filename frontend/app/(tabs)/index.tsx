import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/auth";
import {
  AppText,
  Chip,
  LoadingView,
  ErrorView,
  Avatar,
} from "@/src/components/ui";
import { FeaturedCard, CampaignCard, Campaign } from "@/src/components/CampaignCard";
import { useResponsive } from "@/src/lib/responsive";
import { colors, spacing, radius, shadow } from "@/src/theme";

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

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["home"],
    queryFn: () => api<HomeData>("/home"),
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingView label="Loading causes..." />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ErrorView message="Couldn't load causes." onRetry={refetch} />
      </View>
    );
  }

  const {
    featured = [],
    urgent = [],
    almost_funded = [],
    recently_updated = [],
    recommended = [],
    categories = [],
    greeting_name,
  } = data;

  const displayName = greeting_name || (user?.name ? user.name.split(" ")[0] : null);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {/* GoFundMe-Style Clean White Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.topRow}>
          <View>
            <AppText variant="h1" color={colors.brandPrimary} style={styles.brandLogo}>
              goodcause
            </AppText>
            {displayName ? (
              <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ marginTop: 1 }}>
                Welcome back, {displayName}
              </AppText>
            ) : (
              <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ marginTop: 1 }}>
                Trust makes generosity go further
              </AppText>
            )}
          </View>
          <Pressable onPress={() => router.push("/profile")}>
            <Avatar name={user?.name} uri={user?.picture} size={38} />
          </Pressable>
        </View>

        {/* GoFundMe Search Bar */}
        <Pressable
          testID="home-search-bar"
          onPress={() => router.push("/explore")}
          style={styles.searchBar}
        >
          <Feather name="search" size={17} color={colors.onSurfaceSecondary} />
          <AppText variant="body" color={colors.onSurfaceSecondary} style={{ marginLeft: spacing.sm, flex: 1, fontSize: 14 }}>
            Search by cause, name, or city
          </AppText>
        </Pressable>

        {/* Categories Bar */}
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(c) => c.id}
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.md }}
          contentContainerStyle={{ gap: spacing.xs, paddingRight: spacing.lg }}
          renderItem={({ item }) => (
            <Chip
              testID={`cat-chip-${item.slug}`}
              label={item.name}
              onPress={() => router.push(`/explore?category=${item.id}`)}
            />
          )}
        />
      </View>

      <View style={{ alignSelf: "center", width: "100%", maxWidth: maxContentWidth }}>
        {/* Featured Fundraisers Carousel */}
        {featured.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="h2">Featured fundraisers</AppText>
              <Pressable onPress={() => router.push("/explore")}>
                <AppText variant="label" color={colors.brandPrimary}>See all</AppText>
              </Pressable>
            </View>
            <FlatList
              horizontal
              data={featured}
              keyExtractor={(c) => c.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
              renderItem={({ item }) => (
                <FeaturedCard c={item} onPress={() => router.push(`/campaign/${item.id}`)} />
              )}
            />
          </View>
        ) : null}

        {/* GoFundMe Trust Banner */}
        <View style={styles.trustBanner}>
          <View style={styles.trustIconWrap}>
            <Feather name="shield" size={18} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <AppText variant="label" style={{ color: colors.onSurface }}>GoodCause Giving Guarantee</AppText>
            <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ marginTop: 2 }}>
              100% verified causes with itemized budgets & milestone proof.
            </AppText>
          </View>
        </View>

        {/* Urgent Fundraisers */}
        {urgent.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.rowCenter}>
                <Feather name="clock" size={16} color={colors.warning} />
                <AppText variant="h2" style={{ marginLeft: 6 }}>Urgent fundraisers</AppText>
              </View>
              <Pressable onPress={() => router.push("/explore")}>
                <AppText variant="label" color={colors.brandPrimary}>See all</AppText>
              </Pressable>
            </View>
            <View style={styles.listWrap}>
              {urgent.slice(0, 4).map((c) => (
                <CampaignCard key={c.id} c={c} onPress={() => router.push(`/campaign/${c.id}`)} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Almost Funded */}
        {almost_funded.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="h2">Close to goal</AppText>
              <Pressable onPress={() => router.push("/explore")}>
                <AppText variant="label" color={colors.brandPrimary}>See all</AppText>
              </Pressable>
            </View>
            <View style={styles.listWrap}>
              {almost_funded.slice(0, 4).map((c) => (
                <CampaignCard key={c.id} c={c} onPress={() => router.push(`/campaign/${c.id}`)} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Discover Fundraisers */}
        {recommended.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="h2">Top causes near you</AppText>
              <Pressable onPress={() => router.push("/explore")}>
                <AppText variant="label" color={colors.brandPrimary}>See all</AppText>
              </Pressable>
            </View>
            <View style={styles.listWrap}>
              {recommended.slice(0, 6).map((c) => (
                <CampaignCard key={c.id} c={c} onPress={() => router.push(`/campaign/${c.id}`)} />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandLogo: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 46,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
  },
  listWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  trustBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandTertiary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#D1E7DD",
  },
  trustIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
