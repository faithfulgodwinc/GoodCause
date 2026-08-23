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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topRow}>
          <View>
            <AppText variant="caption" color={colors.onSurfaceTertiary}>
              {displayName ? `Good day, ${displayName}` : "Welcome to GoodCause"}
            </AppText>
            <AppText variant="display" color={colors.brandPrimary} style={{ marginTop: 2 }}>
              GoodCause
            </AppText>
          </View>
          <Pressable onPress={() => router.push("/profile")}>
            <Avatar name={user?.name} uri={user?.picture} size={42} />
          </Pressable>
        </View>

        {/* Search prompt */}
        <Pressable
          testID="home-search-bar"
          onPress={() => router.push("/explore")}
          style={styles.searchBar}
        >
          <Feather name="search" size={18} color={colors.muted} />
          <AppText variant="body" color={colors.muted} style={{ marginLeft: spacing.sm, flex: 1 }}>
            Search causes, charities, organizers...
          </AppText>
        </Pressable>

        {/* Category horizontal chips */}
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(c) => c.id}
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.md }}
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
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
        {/* Featured carousel */}
        {featured.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="h2">Featured causes</AppText>
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

        {/* Urgent Causes */}
        {urgent.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.urgentTitleRow}>
                <Feather name="clock" size={18} color={colors.warning} />
                <AppText variant="h2" style={{ marginLeft: 6 }}>Urgent cases</AppText>
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
              <AppText variant="h2">Almost funded</AppText>
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

        {/* Recommended / Explore more */}
        {recommended.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="h2">Discover causes</AppText>
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
    backgroundColor: colors.surfaceSecondary,
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    marginTop: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  urgentTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  listWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
});
