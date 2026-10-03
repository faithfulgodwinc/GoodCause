import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, RefreshControl, Alert } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { AppText, Button, LoadingView, EmptyState } from "@/src/components/ui";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { formatNaira, timeAgo } from "@/src/format";

type Tab = "review" | "campaigns" | "reports" | "transactions";

export default function Admin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("review");

  const stats = useQuery({ queryKey: ["adminStats"], queryFn: () => api<any>("/admin/stats") });
  const review = useQuery({ queryKey: ["adminReview"], queryFn: () => api<any[]>("/admin/campaigns?status=SUBMITTED"), enabled: tab === "review" });
  const allCampaigns = useQuery({ queryKey: ["adminAllCampaigns"], queryFn: () => api<any[]>("/admin/campaigns"), enabled: tab === "campaigns" });
  const reports = useQuery({ queryKey: ["adminReports"], queryFn: () => api<any[]>("/admin/reports"), enabled: tab === "reports" });
  const txns = useQuery({ queryKey: ["adminTxns"], queryFn: () => api<any[]>("/admin/transactions"), enabled: tab === "transactions" });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      if (action === "verify") {
        await api(`/admin/campaigns/${id}/verify`, { method: "POST", body: { identity: true, beneficiary: true, documents: true, relationship: true, updates_enabled: true } });
        await api(`/admin/campaigns/${id}/publish`, { method: "POST" });
      } else if (action === "reject") {
        await api(`/admin/campaigns/${id}/reject`, { method: "POST", body: { reason: "Needs more information before it can go live." } });
      } else if (action === "suspend") {
        await api(`/admin/campaigns/${id}/suspend`, { method: "POST" });
      }
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["adminReview"] }); 
      qc.invalidateQueries({ queryKey: ["adminAllCampaigns"] }); 
      qc.invalidateQueries({ queryKey: ["adminStats"] }); 
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["home"] });
    },
  });

  const resolveReport = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api(`/admin/reports/${id}/action`, { method: "POST", body: { action } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminReports"] }); qc.invalidateQueries({ queryKey: ["adminStats"] }); },
  });

  const s = stats.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ alignSelf: "center", width: "100%", maxWidth: 960, flex: 1 }}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()}><Feather name="arrow-left" size={24} color={colors.onSurface} /></Pressable>
          <AppText variant="title">Admin</AppText>
          <Pressable onPress={() => router.push("/admin/impact")}><Feather name="pie-chart" size={22} color={colors.brandPrimary} /></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Stats */}
          <View style={styles.statsGrid}>
            <StatCard label="Live campaigns" value={String(s?.live_campaigns ?? "—")} icon="zap" />
            <StatCard label="Pending review" value={String(s?.pending_review ?? "—")} icon="clock" tint={colors.warning} />
          <StatCard label="Total raised" value={formatNaira(s?.total_raised_kobo || 0, { compact: true })} icon="trending-up" tint={colors.success} />
          <StatCard label="Open reports" value={String(s?.open_reports ?? "—")} icon="flag" tint={colors.error} />
        </View>

        <View style={styles.seg}>
          {(["review", "campaigns", "reports", "transactions"] as Tab[]).map((t) => (
            <Pressable key={t} testID={`admin-tab-${t}`} onPress={() => setTab(t)} style={[styles.segItem, tab === t && styles.segItemActive]}>
              <AppText variant="label" color={tab === t ? colors.onSurface : colors.onSurfaceTertiary} style={{ textTransform: "capitalize" }}>{t}</AppText>
            </Pressable>
          ))}
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {tab === "review" && (review.isLoading ? <LoadingView /> : (review.data?.length ? review.data.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={{ flexDirection: "row" }}>
                <Image source={{ uri: c.cover_image }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <AppText variant="label" numberOfLines={2}>{c.title}</AppText>
                  <AppText variant="caption" style={{ marginTop: 2 }}>by {c.organizer?.name} · {formatNaira(c.goal_kobo, { compact: true })} goal</AppText>
                  <Pressable onPress={() => router.push(`/campaign/${c.id}`)}><AppText variant="caption" color={colors.brandPrimary} style={{ marginTop: 4 }}>View details</AppText></Pressable>
                </View>
              </View>
              <View style={styles.actionRow}>
                <Button 
                  title="Verify & publish" 
                  small 
                  onPress={() => {
                    Alert.alert(
                      "Publish Campaign",
                      "Are you sure you want to verify and publish this campaign? It will be live on the home feed immediately.",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Publish", style: "default", onPress: () => act.mutate({ id: c.id, action: "verify" }) }
                      ]
                    );
                  }} 
                  style={{ flex: 1 }} 
                  testID={`verify-${c.id}`} 
                />
                <Button title="Reject" small variant="outline" onPress={() => act.mutate({ id: c.id, action: "reject" })} style={{ flex: 1 }} testID={`reject-${c.id}`} />
              </View>
            </View>
          )) : <EmptyState icon="check-circle" title="All caught up" message="No campaigns awaiting review." />))}

          {tab === "campaigns" && (allCampaigns.isLoading ? <LoadingView /> : (allCampaigns.data?.length ? allCampaigns.data.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                  <AppText variant="label" numberOfLines={1}>{c.title}</AppText>
                  <AppText variant="caption" style={{ marginTop: 2 }}>
                    by {c.organizer?.name || "Unknown"} · {formatNaira(c.goal_kobo, { compact: true })}
                  </AppText>
                </View>
                <View style={[styles.statusPill, { backgroundColor: c.status === "LIVE" ? "#EAF4EF" : c.status === "SUSPENDED" ? "#FEEBEB" : colors.surfaceTertiary }]}>
                  <AppText variant="caption" color={c.status === "LIVE" ? colors.success : c.status === "SUSPENDED" ? colors.error : colors.onSurfaceTertiary}>
                    {c.status}
                  </AppText>
                </View>
              </View>
              <View style={styles.actionRow}>
                <Button 
                  title="View" 
                  small 
                  variant="outline" 
                  onPress={() => router.push(`/campaign/${c.id}`)} 
                  style={{ flex: 1 }} 
                />
                {c.status === "LIVE" || c.status === "VERIFIED" ? (
                  <Button 
                    title="Suspend / Hide" 
                    small 
                    variant="outline" 
                    onPress={() => {
                      Alert.alert(
                        "Suspend Campaign",
                        `Are you sure you want to hide "${c.title}" from production?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Hide / Suspend", style: "destructive", onPress: () => act.mutate({ id: c.id, action: "suspend" }) }
                        ]
                      );
                    }} 
                    style={{ flex: 1, borderColor: colors.error }} 
                    textStyle={{ color: colors.error }} 
                  />
                ) : null}
              </View>
            </View>
          )) : <EmptyState icon="folder" title="No campaigns found" />))}

          {tab === "reports" && (reports.isLoading ? <LoadingView /> : (reports.data?.length ? reports.data.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <AppText variant="label">{r.reason}</AppText>
                <View style={[styles.statusPill, { backgroundColor: r.status === "open" ? "#FBF1E0" : colors.surfaceTertiary }]}>
                  <AppText variant="caption" color={r.status === "open" ? colors.warning : colors.onSurfaceTertiary}>{r.status}</AppText>
                </View>
              </View>
              <AppText variant="caption" style={{ marginTop: 4 }}>On: {r.campaign_title} · {timeAgo(r.created_at)}</AppText>
              {r.details ? <AppText variant="body" style={{ marginTop: 4 }}>{r.details}</AppText> : null}
              {r.status === "open" ? (
                <View style={styles.actionRow}>
                  <Button title="Resolve" small onPress={() => resolveReport.mutate({ id: r.id, action: "resolve" })} style={{ flex: 1 }} />
                  <Button title="Dismiss" small variant="outline" onPress={() => resolveReport.mutate({ id: r.id, action: "dismiss" })} style={{ flex: 1 }} />
                </View>
              ) : null}
            </View>
          )) : <EmptyState icon="flag" title="No reports" message="Reported campaigns will appear here." />))}

          {tab === "transactions" && (txns.isLoading ? <LoadingView /> : (txns.data?.length ? txns.data.slice(0, 60).map((t) => (
            <View key={t.id} style={styles.txnRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="label">{formatNaira(t.amount_kobo)}</AppText>
                <AppText variant="caption" style={{ marginTop: 2 }}>{t.provider}{t.test ? " · test" : ""} · {timeAgo(t.created_at)}</AppText>
              </View>
              <View style={[styles.statusPill, { backgroundColor: t.status === "paid" ? "#EAF4EF" : colors.surfaceTertiary }]}>
                <AppText variant="caption" color={t.status === "paid" ? colors.success : colors.onSurfaceTertiary}>{t.status}</AppText>
              </View>
            </View>
          )) : <EmptyState icon="credit-card" title="No transactions" />))}
        </View>
      </ScrollView>
      </View>
    </View>
  );
}

function StatCard({ label, value, icon, tint }: { label: string; value: string; icon: any; tint?: string }) {
  return (
    <View style={styles.statCard}>
      <Feather name={icon} size={18} color={tint || colors.brandPrimary} />
      <AppText variant="h1" style={{ marginTop: spacing.sm }}>{value}</AppText>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", padding: spacing.lg, gap: spacing.md },
  statCard: { width: "47%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  seg: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4, marginHorizontal: spacing.lg },
  segItem: { flex: 1, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  segItemActive: { backgroundColor: colors.surfaceSecondary },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  txnRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
});
