import React from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { AppText, Card, LoadingView } from "@/src/components/ui";
import { formatNaira } from "@/src/format";
import { colors, spacing, radius } from "@/src/theme";

type Allocation = {
  campaign_id: string;
  campaign_title: string;
  amount_kobo: number;
  status: "ALLOCATED" | "PAID" | "CANCELLED";
};

type ImpactReport = {
  period_key: string;
  status: string;
  published_at?: string;
  net_proceeds_kobo: number;
  current_impact_kobo: number;
  operating_kobo: number;
  opening_rollover_kobo: number;
  available_impact_kobo: number;
  allocated_kobo: number;
  closing_rollover_kobo: number;
  paid_kobo: number;
  pending_kobo: number;
  allocations: Allocation[];
};

type ImpactLatest = { status: "pending" | "published"; report: ImpactReport | null };

export default function ImpactCommitmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reportQuery = useQuery({
    queryKey: ["impact", "latest"],
    queryFn: () => api<ImpactLatest>("/impact/latest", { auth: false }),
  });
  const report = reportQuery.data?.report;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="title">Impact Commitment</AppText>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <AppText style={styles.percent}>80%</AppText>
          <AppText variant="h1" style={{ textAlign: "center" }}>of confirmed net membership proceeds supports verified causes.</AppText>
          <AppText variant="caption" style={styles.definition}>
            Net proceeds are what GoodCause actually receives after store commissions, taxes, refunds, chargebacks and adjustments. The remaining 20% supports platform operations.
          </AppText>
        </View>

        {reportQuery.isLoading ? <LoadingView /> : !report ? (
          <Card style={styles.empty}>
            <Feather name="clock" size={24} color={colors.brandPrimary} />
            <AppText variant="h2" style={{ marginTop: spacing.sm }}>First report pending</AppText>
            <AppText variant="body" style={styles.centerMuted}>
              We will publish confirmed figures after the first Apple and Google settlement is received and reconciled. No estimates are shown as completed impact.
            </AppText>
          </Card>
        ) : (
          <>
            <AppText variant="caption" style={styles.period}>PUBLISHED PERIOD · {report.period_key}</AppText>
            <View style={styles.grid}>
              <Metric label="Confirmed net proceeds" value={formatNaira(report.net_proceeds_kobo)} />
              <Metric label="80% commitment" value={formatNaira(report.current_impact_kobo)} />
              <Metric label="Paid to causes" value={formatNaira(report.paid_kobo)} />
              <Metric label="Reserved forward" value={formatNaira(report.closing_rollover_kobo)} />
            </View>
            <AppText variant="h2" style={{ marginTop: spacing.xl }}>Cause allocations</AppText>
            {report.allocations.map((allocation) => (
              <Pressable key={allocation.campaign_id} onPress={() => router.push(`/campaign/${allocation.campaign_id}`)} style={styles.allocation}>
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{allocation.campaign_title}</AppText>
                  <AppText variant="caption">{allocation.status === "PAID" ? "Paid" : allocation.status === "ALLOCATED" ? "Pending payment" : "Returned to reserve"}</AppText>
                </View>
                <AppText variant="label" color={colors.success}>{formatNaira(allocation.amount_kobo)}</AppText>
              </Pressable>
            ))}
          </>
        )}

        <Card style={styles.note}>
          <AppText variant="label">Membership and donations are separate</AppText>
          <AppText variant="caption" style={{ marginTop: 4 }}>
            Membership purchases provide ongoing GoodCause benefits. A Paystack donation is a separate one-time payment designated for the campaign you select.
          </AppText>
        </Card>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><AppText variant="h2">{value}</AppText><AppText variant="caption">{label}</AppText></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  content: { padding: spacing.lg, paddingBottom: 60, width: "100%", maxWidth: 720, alignSelf: "center" },
  hero: { alignItems: "center", paddingVertical: spacing.xxl },
  percent: { fontSize: 58, fontWeight: "800", color: colors.brandPrimary },
  definition: { textAlign: "center", lineHeight: 18, marginTop: spacing.md, maxWidth: 560 },
  empty: { alignItems: "center", padding: spacing.xl },
  centerMuted: { textAlign: "center", color: colors.onSurfaceSecondary, marginTop: spacing.sm },
  period: { marginBottom: spacing.sm, color: colors.onSurfaceSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: { width: "47%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  allocation: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  note: { marginTop: spacing.xl, padding: spacing.lg },
});
