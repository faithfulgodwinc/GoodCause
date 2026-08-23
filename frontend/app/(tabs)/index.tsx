import React from "react";
import { View, ScrollView, StyleSheet, Pressable, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/auth";
import { AppText, LoadingView, ErrorView } from "@/src/components/ui";
import { FeaturedCard, CampaignCard, Campaign } from "@/src/components/CampaignCard";
import { colors, spacing, radius, CATEGORY_COLORS } from "@/src/theme";

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

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["home"],
    queryFn: () => api<HomeData>("/home"),
  });

  const open = (id: string) => router.push(`/campaign/${id}`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <AppText variant="h1" style={{ marginTop: 2 }}>
                {greeting()}, {user?.name?.split(" ")[0] || "Friend"}
              </AppText>
              <AppText variant="body" style={{ marginTop: 4 }}>
                Where would you like to make a difference today?
              </AppText>
            </View>
            <Pressable testID="home-circles-btn" onPress={() => router.push("/circles")} style={styles.iconBtn}>
              <Feather name="users" size={20} color={colors.onSurface} />
            </Pressable>
          </View>
          <Pressable testID="home-search-bar" onPress={() => router.push("/explore")} style={styles.search}>
            <Feather name="search" size={18} color={colors.muted} />
            <AppText variant="body" color={colors.muted} style={{ marginLeft: spacing.sm }}>
              Search causes, people, communities
            </AppText>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={{ height: 400 }}><LoadingView /></View>
        ) : isError || !data ? (
          <View style={{ height: 400 }}><ErrorView onRetry={refetch} /></View>
        ) : (
          <>
            {data.featured.length > 0 && (
              <View style={{ marginTop: spacing.md }}>
                <SectionHeader title="Featured causes" />
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

            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Browse by category" />
              <FlatList
                horizontal
                data={data.categories}
                keyExtractor={(c) => c.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
                renderItem={({ item }) => (
                  <Pressable
                    testID={`home-category-${item.slug}`}
                    onPress={() => router.push(`/explore?category=${item.id}`)}
                    style={styles.catCard}
                  >
                    <View style={[styles.catIcon, { backgroundColor: (CATEGORY_COLORS[item.slug] || colors.brandPrimary) + "22" }]}>
                      <Feather name={item.icon as any} size={18} color={CATEGORY_COLORS[item.slug] || colors.brandPrimary} />
                    </View>
                    <AppText variant="label" style={{ marginTop: 6 }}>{item.name}</AppText>
                  </Pressable>
                )}
              />
            </View>

            <ListSection title="Urgent right now" items={data.urgent} open={open} />
            <ListSection title="Almost funded" items={data.almost_funded} open={open} />
            <ListSection title="Recently updated" items={data.recently_updated} open={open} />
            <ListSection title="Recommended for you" items={data.recommended} open={open} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, action }: { title: string; action?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="h2">{title}</AppText>
      {action ? (
        <Pressable onPress={action}><AppText variant="label" color={colors.brandPrimary}>See all</AppText></Pressable>
      ) : null}
    </View>
  );
}

function ListSection({ title, items, open }: { title: string; items: Campaign[]; open: (id: string) => void }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={{ marginTop: spacing.xl }}>
      <SectionHeader title={title} />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        {items.slice(0, 5).map((c) => (
          <CampaignCard key={c.id} c={c} onPress={() => open(c.id)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  search: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    height: 50, marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  catCard: {
    width: 90, alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md,
  },
  catIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
