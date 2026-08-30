import React, { useState, useRef } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
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
  BrandLogo,
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
  const { maxContentWidth, columns, isMobile, isDesktop } = useResponsive();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showNavSearch, setShowNavSearch] = useState(false);
  const searchOpacity = useRef(new Animated.Value(0)).current;

  const { data, isError, refetch, isRefetching } = useQuery({
    queryKey: ["home"],
    queryFn: () => api<HomeData>("/home"),
  });

  const {
    featured = [],
    urgent = [],
    almost_funded = [],
    recently_updated = [],
    recommended = [],
    categories = [],
    greeting_name,
  } = data || {};

  const displayName = greeting_name || (user?.name ? user.name.split(" ")[0] : null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    // Border elevation triggers slightly on initial scroll
    if (y > 20 && !isScrolled) setIsScrolled(true);
    else if (y <= 20 && isScrolled) setIsScrolled(false);

    // Nav search icon appears ONLY when the main in-feed search bar is scrolled out of view (~110px)
    if (y > 110 && !showNavSearch) {
      setShowNavSearch(true);
      Animated.timing(searchOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (y <= 110 && showNavSearch) {
      setShowNavSearch(false);
      Animated.timing(searchOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* On mobile, show local sticky nav. On desktop, GlobalHeader handles this. */}
      {!isDesktop && (
        <View
          style={[
            styles.stickyNav,
            { paddingTop: insets.top + spacing.xs },
            isScrolled && styles.stickyNavScrolled,
          ]}
        >
          <View style={styles.navRow}>
            {/* Brand Logo */}
            <Pressable onPress={() => {}} hitSlop={8}>
              <BrandLogo size={24} />
            </Pressable>

            {/* Right Actions: Quick Search & Profile Avatar */}
            <View style={styles.navRight}>
              {showNavSearch ? (
                <Animated.View style={{ opacity: searchOpacity }}>
                  <Pressable
                    testID="nav-search-btn"
                    onPress={() => router.push("/explore")}
                    style={styles.navIconBtn}
                    hitSlop={8}
                  >
                    <Feather name="search" size={19} color={colors.onSurface} />
                  </Pressable>
                </Animated.View>
              ) : null}
              <Pressable
                testID="nav-profile-btn"
                onPress={() => router.push("/profile")}
                style={{ marginLeft: spacing.sm }}
              >
                <Avatar name={user?.name} uri={user?.picture} size={32} />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Main Scrollable Feed */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={{ alignSelf: "center", width: "100%", maxWidth: maxContentWidth }}>
          {/* Hero Greeting Section */}
          <View style={styles.heroSection}>
            <AppText variant="display" style={styles.heroTitle}>
              {displayName ? `Welcome back, ${displayName}` : "Fundraising for causes you care about"}
            </AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={{ marginTop: spacing.xs }}>
              Trust makes generosity go further. Verified causes with itemized budgets.
            </AppText>

            {/* GoFundMe In-Feed Large Search Bar */}
            <Pressable
              testID="home-search-bar"
              onPress={() => router.push("/explore")}
              style={styles.searchBar}
            >
              <Feather name="search" size={18} color={colors.onSurfaceSecondary} />
              <AppText variant="body" color={colors.onSurfaceSecondary} style={{ marginLeft: spacing.sm, flex: 1, fontSize: 14 }}>
                Search by cause, name, or city
              </AppText>
            </Pressable>
          </View>

          {/* Category Chips Bar */}
          <FlatList
            horizontal
            data={categories}
            keyExtractor={(c) => c.id}
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing.md }}
            contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: spacing.lg }}
            renderItem={({ item }) => (
              <Chip
                testID={`cat-chip-${item.slug}`}
                label={item.name}
                onPress={() => router.push(`/explore?category=${item.id}`)}
              />
            )}
          />

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

          {/* GoFundMe Giving Guarantee Trust Banner */}
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
              <View style={[styles.listWrap, columns > 1 && styles.listWrapGrid]}>
                {urgent.slice(0, 6).map((c) => (
                  <View key={c.id} style={columns > 1 ? { width: columns === 3 ? "31.8%" : "48.5%" } : undefined}>
                    <CampaignCard c={c} onPress={() => router.push(`/campaign/${c.id}`)} />
                  </View>
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
              <View style={[styles.listWrap, columns > 1 && styles.listWrapGrid]}>
                {almost_funded.slice(0, 6).map((c) => (
                  <View key={c.id} style={columns > 1 ? { width: columns === 3 ? "31.8%" : "48.5%" } : undefined}>
                    <CampaignCard c={c} onPress={() => router.push(`/campaign/${c.id}`)} />
                  </View>
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
              <View style={[styles.listWrap, columns > 1 && styles.listWrapGrid]}>
                {recommended.slice(0, 6).map((c) => (
                  <View key={c.id} style={columns > 1 ? { width: columns === 3 ? "31.8%" : "48.5%" } : undefined}>
                    <CampaignCard c={c} onPress={() => router.push(`/campaign/${c.id}`)} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Clean Empty State when no fundraisers exist */}
          {featured.length === 0 && urgent.length === 0 && recommended.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Feather name="heart" size={32} color={colors.brandPrimary} />
              <AppText variant="h2" style={{ marginTop: spacing.md, textAlign: "center" }}>
                Start the first fundraiser
              </AppText>
              <AppText variant="body" color={colors.onSurfaceSecondary} style={{ marginTop: spacing.xs, textAlign: "center", maxWidth: 280 }}>
                Rally support for medical emergencies, school tuition, or community relief.
              </AppText>
              <Pressable
                onPress={() => router.push("/campaign/new")}
                style={styles.startBtn}
              >
                <AppText variant="label" color="#FFFFFF">Start a campaign</AppText>
              </Pressable>
            </View>
          ) : null}
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
  stickyNav: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
  stickyNavScrolled: {
    borderBottomColor: colors.border,
    ...shadow.card,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 40,
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  navIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  brandLogo: {
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  heroSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 32,
    color: colors.onSurface,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 48,
    marginTop: spacing.lg,
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
  listWrapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
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
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  startBtn: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
  },
});
