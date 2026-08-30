import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { AppText, LoadingView, EmptyState } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { formatNaira, timeAgo } from "@/src/format";
import { useResponsive } from "@/src/lib/responsive";

type Notif = { id: string; type: string; title: string; body: string; campaign_id?: string; read: boolean; created_at: string };
type Donation = { id: string; amount_kobo: number; message: string; created_at: string; campaign?: { id: string; title: string; cover_image?: string; status: string } };

const ICON: Record<string, keyof typeof Feather.glyphMap> = {
  donation_received: "gift",
  donation_thankyou: "heart",
  organizer_thankyou: "mail",
  campaign_verified: "shield",
  campaign_live: "zap",
  campaign_update: "message-square",
  campaign_created: "flag",
};

export default function Activity() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { feedMaxWidth } = useResponsive();
  const [tab, setTab] = useState<"alerts" | "donations">("alerts");

  const notifs = useQuery({ queryKey: ["notifications"], queryFn: () => api<{ items: Notif[]; unread: number }>("/notifications") });
  const donations = useQuery({ queryKey: ["myDonations"], queryFn: () => api<Donation[]>("/donations/mine") });

  const markAll = async () => {
    await api("/notifications/read-all", { method: "POST" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ alignSelf: "center", width: "100%", maxWidth: feedMaxWidth }}>
          <View style={styles.headerRow}>
            <AppText variant="h1">Activity</AppText>
            {tab === "alerts" && (notifs.data?.unread || 0) > 0 ? (
              <Pressable onPress={markAll} testID="mark-all-read"><AppText variant="label" color={colors.brandPrimary}>Mark all read</AppText></Pressable>
            ) : null}
          </View>
          <View style={styles.seg}>
            <Seg label="Notifications" active={tab === "alerts"} onPress={() => setTab("alerts")} />
            <Seg label="My donations" active={tab === "donations"} onPress={() => setTab("donations")} />
          </View>
        </View>
      </View>

      {tab === "alerts" ? (
        <FlatList
          data={notifs.data?.items || []}
          keyExtractor={(n) => n.id}
          style={{ alignSelf: "center", width: "100%", maxWidth: feedMaxWidth }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 120, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={notifs.isRefetching} onRefresh={notifs.refetch} />}
          ListEmptyComponent={notifs.isLoading ? null : <EmptyState testID="notifications-empty" icon="bell" title="No notifications yet" message="Follow a cause and you'll hear about milestones and updates here." />}
          renderItem={({ item }) => (
            <Pressable
              testID={`notification-${item.id}`}
              onPress={() => item.campaign_id && router.push(`/campaign/${item.campaign_id}`)}
              style={[styles.notif, !item.read && { borderColor: colors.brandTertiary, backgroundColor: "#FFFDFB" }]}
            >
              <View style={[styles.notifIcon, !item.read && { backgroundColor: colors.brandTertiary }]}>
                <Feather name={ICON[item.type] || "bell"} size={16} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={styles.rowBetween}>
                  <AppText variant="label" style={{ flex: 1 }} numberOfLines={1}>{item.title}</AppText>
                  <AppText variant="caption">{timeAgo(item.created_at)}</AppText>
                </View>
                <AppText variant="body" numberOfLines={2} style={{ marginTop: 2 }}>{item.body}</AppText>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={donations.data || []}
          keyExtractor={(d) => d.id}
          style={{ alignSelf: "center", width: "100%", maxWidth: feedMaxWidth }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={donations.isRefetching} onRefresh={donations.refetch} />}
          ListEmptyComponent={donations.isLoading ? null : <EmptyState testID="donations-empty" icon="heart" title="No donations yet" message="When you support a cause, it will appear here with your impact." actionLabel="Explore causes" onAction={() => router.push("/explore")} />}
          renderItem={({ item }) => (
              <Pressable
                testID={`donation-${item.id}`}
                onPress={() => item.campaign && router.push(`/campaign/${item.campaign.id}`)}
                style={styles.donation}
              >
                <Image source={{ uri: item.campaign?.cover_image }} style={styles.dThumb} contentFit="cover" transition={150} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <AppText variant="label" numberOfLines={1}>{item.campaign?.title || "Campaign"}</AppText>
                  <AppText variant="caption" style={{ marginTop: 2 }}>{timeAgo(item.created_at)}</AppText>
                </View>
                <AppText variant="title" color={colors.success}>{formatNaira(item.amount_kobo, { compact: true })}</AppText>
              </Pressable>
            )}
          />
      )}
    </View>
  );
}

function Seg({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segItem, active && styles.segItemActive]}>
      <AppText variant="label" color={active ? colors.onSurface : colors.onSurfaceTertiary}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seg: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4, marginTop: spacing.md },
  segItem: { flex: 1, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  segItemActive: { backgroundColor: colors.surfaceSecondary },
  notif: { flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  notifIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  donation: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  dThumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
});
