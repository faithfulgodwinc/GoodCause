import React, { useMemo, useState } from "react";
import { View, StyleSheet, TextInput, FlatList, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { AppText, Chip, LoadingView, ErrorView, EmptyState } from "@/src/components/ui";
import { CampaignCard, Campaign } from "@/src/components/CampaignCard";
import { useResponsive } from "@/src/lib/responsive";
import { colors, spacing, radius, font } from "@/src/theme";

type Cat = { id: string; name: string; slug: string };

export default function Explore() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const { columns, maxContentWidth } = useResponsive();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState<string | null>(params.category || null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    if (params.category !== undefined) {
      setCategory(params.category || null);
    }
  }, [params.category]);

  const { data: cats } = useQuery({ queryKey: ["categories"], queryFn: () => api<Cat[]>("/categories") });

  const query = useMemo(() => {
    const qp = new URLSearchParams();
    if (debounced) qp.set("search", debounced);
    if (category) qp.set("category", category);
    qp.set("limit", "30");
    return qp.toString();
  }, [debounced, category]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["explore", query],
    queryFn: () => api<{ items: Campaign[] }>(`/campaigns?${query}`),
  });

  const items = data?.items || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ alignSelf: "center", width: "100%", maxWidth: maxContentWidth }}>
          <AppText variant="h1" style={{ marginBottom: spacing.md }}>Explore</AppText>
          <View style={styles.search}>
            <Feather name="search" size={18} color={colors.muted} />
            <TextInput
              testID="explore-search-input"
              value={search}
              onChangeText={setSearch}
              placeholder="Search causes"
              placeholderTextColor={colors.muted}
              style={[styles.input, { outlineStyle: "none" } as any]}
              returnKeyType="search"
            />
            {search ? (
              <Pressable onPress={() => setSearch("")}><Feather name="x" size={18} color={colors.muted} /></Pressable>
            ) : null}
          </View>
          <FlatList
            horizontal
            data={[{ id: "__all", name: "All", slug: "all" }, ...(cats || [])]}
            keyExtractor={(c) => c.id}
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing.md }}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
            renderItem={({ item }) => {
              const isSelected = item.id === "__all" ? !category : (category === item.id || category === item.slug);
              return (
                <Chip
                  testID={`explore-chip-${item.slug}`}
                  label={item.name}
                  active={isSelected}
                  onPress={() => {
                    const nextCat = item.id === "__all" ? null : item.id;
                    setCategory(nextCat);
                    router.setParams({ category: nextCat || "" });
                  }}
                />
              );
            }}
          />
        </View>
      </View>

      {items.length === 0 && !isLoading ? (
        <EmptyState
          testID="explore-empty"
          icon="search"
          title="No causes found"
          message="Try a different search or category — new campaigns are added every day."
        />
      ) : (
        <FlatList
          key={`cols-${columns}`}
          data={items}
          keyExtractor={(c) => c.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: spacing.md } : undefined}
          style={{ alignSelf: "center", width: "100%", maxWidth: maxContentWidth }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ flex: columns > 1 ? 1 : undefined }}>
              <CampaignCard c={item} onPress={() => router.push(`/campaign/${item.id}`)} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, marginLeft: spacing.sm, fontFamily: font.medium, fontSize: 14, color: colors.onSurface },
});
