import React from "react";
import { View, ScrollView, StyleSheet, Pressable, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/auth";
import { AppText, LoadingView, ErrorView } from "@/src/components/ui";
import { FeaturedCard, CampaignCard, Campaign } from "@/src/components/CampaignCard";
import { useResponsive } from "@/src/lib/responsive";
import { colors, spacing, radius, shadow, CATEGORY_COLORS } from "@/src/theme";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type HomeData = {
  featured: Campaign[];
  urgent: Campaign[];
  almost_funded: Campaign[];
  recently_updated: Campaign[];
  recommended: Campaign[];
  categories: { id: string; name: string; slug: string; icon: string; color: string }[];
  greeting_name?: string | null;
};

// Rappi-style Big Category Highlights
const HERO_CATEGORIES = [
  {
    id: "hero_med",
    slug: "medical",
    title: "Medical Care",
    subtitle: "Surgeries & treatments",
    bg: colors.pastelOrange,
    textColor: colors.pastelOrangeText,
    icon: "activity",
    badge: "Urgent",
  },
  {
    id: "hero_emerg",
    slug: "emergency",
    title: "Emergency",
    subtitle: "Disaster & rapid relief",
    bg: colors.pastelGreen,
    textColor: colors.pastelGreenText,
    icon: "alert-triangle",
    badge: "Fast 10m",
  },
  {
    id: "hero_edu",
    slug: "education",
    title: "Education",
    subtitle: "Schools & student tech",
    bg: colors.pastelBlue,
    textColor: colors.pastelBlueText,
    icon: "book-open",
    badge: "Empower",
  },
  {
    id: "hero_circles",
    slug: "community",
    title: "Giving Circles",
    subtitle: "Community pool funds",
    bg: colors.pastelYellow,
    textColor: colors.pastelYellowText,
    icon: "users",
    badge: "Together",
  },
];

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { columns, maxContentWidth } = useResponsive();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["home"],
    queryFn: () => api<HomeData>("/home"),
  });

  const open = (id: string) => router.push(`/campaign/${id}`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140, width: "100%", maxWidth: maxContentWidth, alignSelf: "center" }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.coral} />}
      >
        {/* Rappi-style Top Header Area */}
        <View style={[styles.headerContainer, { paddingTop: insets.top + spacing.sm }]}>
          {/* Location / Context Bar */}
          <View style={styles.topLocationRow}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color={colors.onSurfaceTertiary} style={{ letterSpacing: 0.2 }}>
                Lagos, Nigeria · Verified Causes
              </AppText>
              <Pressable
                onPress={() => router.push("/circles")}
                style={styles.locationSelector}
              >
                <AppText variant="title" style={{ fontSize: 18, color: colors.onSurface }}>
                  GoodCause Central
                </AppText>
                <View style={styles.dropdownChevron}>
                  <Feather name="chevron-down" size={16} color={colors.onSurface} />
                </View>
              </Pressable>
            </View>

            {/* Right dynamic floating badge */}
            <Pressable
              onPress={() => router.push("/circles")}
              style={styles.floatingHeaderBadge}
            >
              <View style={styles.trophyIcon}>
                <Feather name="heart" size={18} color="#fff" />
              </View>
              <View style={styles.trophyDot} />
            </Pressable>
          </View>

          {/* Rappi-style Floating Pill Search Bar */}
          <Pressable
            testID="home-search-bar"
            onPress={() => router.push("/explore")}
            style={styles.searchPill}
          >
            <Feather name="search" size={19} color={colors.onSurface} style={{ marginLeft: 4 }} />
            <AppText
              variant="body"
              color={colors.onSurfaceTertiary}
              style={{ marginLeft: spacing.md, flex: 1, fontSize: 15 }}
            >
              Search for &quot;Medical Surgery&quot;, &quot;School&quot;...
            </AppText>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={{ height: 400 }}><LoadingView /></View>
        ) : isError || !data ? (
          <View style={{ height: 400 }}><ErrorView onRetry={refetch} /></View>
        ) : (
          <>
            {/* Rappi-style Daily Spotlight / Promo Headline */}
            <View style={styles.spotlightSection}>
              <AppText variant="h1" color={colors.coral} style={styles.spotlightTitle}>
                {greeting()}, {user?.name?.split(" ")[0] || "Friend"}
              </AppText>
              <AppText variant="body" color={colors.onSurfaceSecondary} style={{ marginTop: 2 }}>
                Every ₦1,000 creates measurable, transparent impact.
              </AppText>
              <Pressable onPress={() => router.push("/explore")} style={styles.seeDealsLink}>
                <AppText variant="label" color={colors.onSurface} style={{ fontFamily: "Inter-SemiBold" }}>
                  Explore verified causes
                </AppText>
                <Feather name="chevron-right" size={16} color={colors.onSurface} style={{ marginLeft: 4 }} />
              </Pressable>
            </View>

            {/* Rappi-style Hero Mission Banner */}
            <View style={styles.bannerContainer}>
              <LinearGradient
                colors={["#FF5A36", "#FF3B14"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroBanner}
              >
                <View style={{ flex: 1, paddingRight: spacing.md }}>
                  <View style={styles.bannerBadgePill}>
                    <Feather name="zap" size={11} color="#FF4A22" />
                    <AppText variant="caption" color="#FF4A22" style={{ marginLeft: 4, fontFamily: "Inter-Bold" }}>
                      COMMUNITY CIRCLES
                    </AppText>
                  </View>
                  <AppText variant="display" color="#fff" style={styles.bannerHeading}>
                    GIVE TOGETHER.
                  </AppText>
                  <AppText variant="caption" color="rgba(255,255,255,0.9)" style={{ marginTop: 4 }}>
                    Join a Giving Circle & pool support with your family and friends.
                  </AppText>
                  <Pressable
                    onPress={() => router.push("/circles")}
                    style={styles.bannerCtaBtn}
                  >
                    <AppText variant="label" color="#FF3B14" style={{ fontFamily: "Inter-Bold" }}>
                      Join a Circle
                    </AppText>
                    <Feather name="arrow-right" size={14} color="#FF3B14" style={{ marginLeft: 4 }} />
                  </Pressable>
                </View>

                {/* 3D-styled visual decorative box */}
                <View style={styles.bannerVisualBox}>
                  <Feather name="shield" size={48} color="rgba(255,255,255,0.92)" />
                </View>
              </LinearGradient>
            </View>

            {/* Rappi Signature 2x2 Hero Category Grid */}
            <View style={styles.heroGridSection}>
              <View style={styles.heroGrid}>
                {HERO_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.id}
                    testID={`hero-cat-${cat.slug}`}
                    onPress={() => {
                      const matched = data.categories.find((c) => c.slug === cat.slug);
                      router.push(matched ? `/explore?category=${matched.id}` : "/explore");
                    }}
                    style={[styles.bigCategoryCard, { backgroundColor: cat.bg }]}
                  >
                    <View style={styles.bigCatTop}>
                      <View style={[styles.bigCatIconCircle, { backgroundColor: "#fff" }]}>
                        <Feather name={cat.icon as any} size={24} color={cat.textColor} />
                      </View>
                      <View style={[styles.smallBadge, { backgroundColor: "rgba(255,255,255,0.85)" }]}>
                        <AppText variant="caption" color={cat.textColor} style={{ fontSize: 10, fontFamily: "Inter-Bold" }}>
                          {cat.badge}
                        </AppText>
                      </View>
                    </View>
                    <View style={{ marginTop: spacing.md }}>
                      <AppText variant="title" color={cat.textColor} style={{ fontSize: 17, fontFamily: "Inter-Bold" }}>
                        {cat.title}
                      </AppText>
                      <AppText variant="caption" color={colors.onSurfaceTertiary} style={{ marginTop: 2, fontSize: 12 }}>
                        {cat.subtitle}
                      </AppText>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Rappi-style Mini Category Quick Icon Row */}
            <View style={styles.miniCategorySection}>
              <FlatList
                horizontal
                data={data.categories}
                keyExtractor={(c) => c.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
                renderItem={({ item }) => (
                  <Pressable
                    testID={`home-category-${item.slug}`}
                    onPress={() => router.push(`/explore?category=${item.id}`)}
                    style={styles.miniCatItem}
                  >
                    <View style={[styles.miniCatIconWrap, { backgroundColor: (CATEGORY_COLORS[item.slug] || colors.brandPrimary) + "18" }]}>
                      <Feather name={item.icon as any} size={20} color={CATEGORY_COLORS[item.slug] || colors.brandPrimary} />
                    </View>
                    <AppText variant="caption" numberOfLines={1} style={styles.miniCatLabel}>
                      {item.name}
                    </AppText>
                  </Pressable>
                )}
              />
            </View>

            {/* Featured Causes Carousel */}
            {data.featured.length > 0 && (
              <View style={{ marginTop: spacing.xl }}>
                <SectionHeader title="Featured causes" action={() => router.push("/explore")} />
                <FlatList
                  horizontal
                  data={data.featured}
                  keyExtractor={(c) => c.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
                  renderItem={({ item }) => <FeaturedCard c={item} onPress={() => open(item.id)} />}
                />
              </View>
            )}

            {/* Shelves */}
            <ListSection title="Urgent right now" items={data.urgent} open={open} columns={columns} />
            <ListSection title="Almost funded" items={data.almost_funded} open={open} columns={columns} />
            <ListSection title="Recently updated" items={data.recently_updated} open={open} columns={columns} />
            <ListSection title="Recommended for you" items={data.recommended} open={open} columns={columns} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, action }: { title: string; action?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="h2" style={{ fontSize: 20 }}>{title}</AppText>
      {action ? (
        <Pressable onPress={action} style={styles.seeAllBtn}>
          <AppText variant="label" color={colors.coral} style={{ fontFamily: "Inter-SemiBold" }}>See all</AppText>
          <Feather name="chevron-right" size={15} color={colors.coral} style={{ marginLeft: 2 }} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ListSection({ title, items, open, columns = 1 }: { title: string; items: Campaign[]; open: (id: string) => void; columns?: number }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={{ marginTop: spacing.xxl }}>
      <SectionHeader title={title} />
      <View style={{ paddingHorizontal: spacing.lg, flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        {items.slice(0, columns > 1 ? 6 : 5).map((c) => (
          <View key={c.id} style={{ flexBasis: columns > 1 ? "47%" : "100%", flexGrow: 1 }}>
            <CampaignCard c={c} onPress={() => open(c.id)} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationSelector: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  dropdownChevron: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  floatingHeaderBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  trophyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.soft,
  },
  trophyDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    height: 52,
    marginTop: spacing.md,
    ...shadow.soft,
  },
  spotlightSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  spotlightTitle: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    letterSpacing: -0.3,
  },
  seeDealsLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  bannerContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  heroBanner: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    ...shadow.card,
  },
  bannerBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  bannerHeading: {
    fontSize: 22,
    fontFamily: "Inter-Bold",
    letterSpacing: -0.5,
  },
  bannerCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    marginTop: spacing.md,
    ...shadow.soft,
  },
  bannerVisualBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroGridSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  heroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  bigCategoryCard: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 130,
    justifyContent: "space-between",
    ...shadow.soft,
  },
  bigCatTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bigCatIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.soft,
  },
  smallBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  miniCategorySection: {
    marginTop: spacing.xl,
  },
  miniCatItem: {
    alignItems: "center",
    width: 70,
  },
  miniCatIconWrap: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.soft,
  },
  miniCatLabel: {
    marginTop: 6,
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    fontFamily: "Inter-Medium",
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
});

