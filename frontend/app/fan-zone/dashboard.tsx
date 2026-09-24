import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/auth";
import { AppText, Button, Avatar, LoadingView } from "@/src/components/ui";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { formatNaira, formatAmountInput, parseAmountInput, timeAgo } from "@/src/format";

// ── Types ────────────────────────────────────────────────────────────────────

type Dashboard = {
  total_received_kobo: number;
  withdrawn_kobo: number;
  available_kobo: number;
  supporters_count: number;
  bank_account: {
    bank_name: string;
    account_number: string;
    account_name: string;
  } | null;
  gifts: Array<{
    id: string;
    amount_kobo: number;
    name: string;
    message: string;
    paid_at: string;
    anonymous: boolean;
    is_test: boolean;
  }>;
  gifts_total: number;
  gifts_page: number;
  gifts_page_size: number;
  payouts: Array<{
    id: string;
    amount_kobo: number;
    bank_name: string;
    account_number: string;
    account_name: string;
    reference: string;
    created_at: string;
    status: string;
  }>;
};

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FanZoneDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showWithdrawSheet, setShowWithdrawSheet] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery<Dashboard>({
    queryKey: ["fan-zone-dashboard", page],
    queryFn: () => api(`/users/me/fan-zone/dashboard?page=${page}`),
    refetchOnMount: "always",
  });

  const withdrawMut = useMutation({
    mutationFn: (amount_kobo: number) =>
      api("/users/me/fan-zone/withdraw", { method: "POST", body: { amount_kobo } }),
    onSuccess: (res) => {
      setWithdrawSuccess(
        `₦${(res.amount_kobo / 100).toLocaleString("en-NG")} is on its way to ${res.bank_name} (${res.account_number.slice(-4)}).`
      );
      setWithdrawAmount("");
      qc.invalidateQueries({ queryKey: ["fan-zone-dashboard"] });
    },
    onError: (e: any) => {
      setWithdrawError(e?.message || "Withdrawal failed. Please try again.");
    },
  });

  const handleWithdraw = () => {
    setWithdrawError("");
    setWithdrawSuccess(null);
    const kobo = parseAmountInput(withdrawAmount) * 100;
    if (!kobo || kobo < 10000) {
      setWithdrawError("Minimum withdrawal is ₦100.");
      return;
    }
    if (data && kobo > data.available_kobo) {
      setWithdrawError(`You only have ${formatNaira(data.available_kobo)} available.`);
      return;
    }
    withdrawMut.mutate(kobo);
  };

  // ── Loading / error ─────────────────────────────────────────────────────────
  if (isLoading) {
    return <View style={styles.full}><LoadingView /></View>;
  }

  if (isError || !data) {
    return (
      <View style={[styles.full, styles.center]}>
        <Feather name="alert-circle" size={40} color={colors.muted} />
        <AppText variant="h2" style={{ marginTop: spacing.lg }}>Couldn't load dashboard</AppText>
        <Button title="Try again" variant="outline" onPress={() => refetch()} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  const totalPages = Math.ceil(data.gifts_total / data.gifts_page_size);
  const hasNoBankAccount = !data.bank_account;

  return (
    <View style={styles.full}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="dashboard-back">
          <Feather name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <AppText variant="title">Fan Zone Earnings</AppText>
        <Pressable onPress={() => router.push("/fan-zone/setup" as any)} testID="dashboard-edit">
          <Feather name="settings" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60, paddingTop: spacing.lg }}
      >
        {/* ── Balance cards ── */}
        <View style={styles.balanceGrid}>
          <BalanceCard
            label="Total received"
            value={formatNaira(data.total_received_kobo)}
            icon="trending-up"
            accent={colors.brandPrimary}
          />
          <BalanceCard
            label="Available"
            value={formatNaira(data.available_kobo)}
            icon="dollar-sign"
            accent={colors.info}
          />
          <BalanceCard
            label="Withdrawn"
            value={formatNaira(data.withdrawn_kobo)}
            icon="arrow-down-circle"
            accent={colors.onSurfaceSecondary}
          />
          <BalanceCard
            label="Supporters"
            value={String(data.supporters_count)}
            icon="heart"
            accent={colors.accent}
          />
        </View>

        {/* ── Withdraw CTA ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="dollar-sign" size={18} color={colors.brandPrimary} />
            <AppText variant="h2" style={{ marginLeft: spacing.sm }}>Withdraw earnings</AppText>
          </View>

          {hasNoBankAccount ? (
            <View style={styles.noBankBox}>
              <Feather name="alert-circle" size={20} color={colors.warning} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <AppText variant="bodyMedium">No bank account linked</AppText>
                <AppText variant="caption" style={{ marginTop: 2 }}>
                  Link a bank account from any campaign payout page to enable withdrawals.
                </AppText>
              </View>
            </View>
          ) : (
            <>
              {/* Bank account pill */}
              <View style={styles.bankPill}>
                <Feather name="credit-card" size={16} color={colors.brandPrimary} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <AppText variant="label">{data.bank_account!.account_name}</AppText>
                  <AppText variant="caption" color={colors.onSurfaceSecondary}>
                    {data.bank_account!.bank_name} · ****{data.bank_account!.account_number.slice(-4)}
                  </AppText>
                </View>
              </View>

              {/* Withdraw input */}
              <View style={styles.withdrawRow}>
                <View style={styles.amountInput}>
                  <AppText variant="label" color={colors.muted} style={{ marginRight: spacing.xs }}>₦</AppText>
                  <TextInput
                    testID="withdraw-amount-input"
                    value={withdrawAmount}
                    onChangeText={(v) => {
                      setWithdrawError("");
                      setWithdrawSuccess(null);
                      setWithdrawAmount(v.replace(/\D/g, ""));
                    }}
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    style={styles.amountField}
                  />
                </View>
                <Button
                  title="Withdraw"
                  icon="arrow-down-circle"
                  onPress={handleWithdraw}
                  loading={withdrawMut.isPending}
                  disabled={data.available_kobo === 0}
                  style={{ flex: 1, marginLeft: spacing.md }}
                  testID="withdraw-submit-button"
                />
              </View>

              {/* Quick-fill chips */}
              {data.available_kobo > 0 ? (
                <View style={styles.quickFills}>
                  {[0.25, 0.5, 1].map((frac) => {
                    const amt = Math.floor((data.available_kobo * frac) / 100);
                    if (amt < 100) return null;
                    return (
                      <Pressable
                        key={frac}
                        onPress={() => { setWithdrawAmount(String(amt)); setWithdrawError(""); }}
                        style={styles.quickChip}
                        testID={`quick-fill-${frac}`}
                      >
                        <AppText variant="caption" color={colors.brandPrimary}>
                          {frac === 1 ? "All" : `${frac * 100}%`} · {formatNaira(data.available_kobo * frac, { compact: true })}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {withdrawError ? (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={14} color={colors.error} />
                  <AppText variant="caption" color={colors.error} style={{ marginLeft: 6, flex: 1 }}>
                    {withdrawError}
                  </AppText>
                </View>
              ) : null}

              {withdrawSuccess ? (
                <View style={styles.successBox}>
                  <Feather name="check-circle" size={14} color={colors.success} />
                  <AppText variant="caption" color={colors.success} style={{ marginLeft: 6, flex: 1 }}>
                    {withdrawSuccess}
                  </AppText>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* ── Gift history ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="gift" size={18} color={colors.brandPrimary} />
            <AppText variant="h2" style={{ marginLeft: spacing.sm }}>
              Gift history
              {data.gifts_total > 0 ? (
                <AppText variant="caption" color={colors.muted}> · {data.gifts_total} total</AppText>
              ) : null}
            </AppText>
          </View>

          {data.gifts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={32} color={colors.muted} style={{ opacity: 0.5 }} />
              <AppText variant="body" color={colors.onSurfaceSecondary} style={{ marginTop: spacing.md, textAlign: "center" }}>
                No gifts yet. Share your Fan Zone to start receiving support!
              </AppText>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {data.gifts.map((g) => (
                <View key={g.id} style={styles.giftRow}>
                  <Avatar name={g.anonymous ? "A" : g.name} size={38} />
                  <View style={styles.giftBody}>
                    <View style={styles.giftTopRow}>
                      <AppText variant="label" style={{ flex: 1 }}>{g.name}</AppText>
                      <View style={[styles.amountBadge, g.is_test && styles.testBadge]}>
                        <AppText
                          variant="label"
                          color={g.is_test ? colors.warning : colors.onBrandPrimary}
                        >
                          {formatNaira(g.amount_kobo)}
                          {g.is_test ? " (test)" : ""}
                        </AppText>
                      </View>
                    </View>
                    {g.message ? (
                      <AppText variant="caption" color={colors.onSurfaceSecondary} numberOfLines={2}>
                        "{g.message}"
                      </AppText>
                    ) : null}
                    <AppText variant="caption" color={colors.muted} style={{ marginTop: spacing.xs }}>
                      {timeAgo(g.paid_at)}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Pagination */}
          {totalPages > 1 ? (
            <View style={styles.pagination}>
              <Pressable
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={[styles.pageBtn, page === 1 && { opacity: 0.3 }]}
                testID="page-prev"
              >
                <Feather name="chevron-left" size={18} color={colors.onSurface} />
              </Pressable>
              <AppText variant="caption" color={colors.muted}>
                Page {page} of {totalPages}
              </AppText>
              <Pressable
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={[styles.pageBtn, page === totalPages && { opacity: 0.3 }]}
                testID="page-next"
              >
                <Feather name="chevron-right" size={18} color={colors.onSurface} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* ── Payout history ── */}
        {data.payouts.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="arrow-down-circle" size={18} color={colors.brandPrimary} />
              <AppText variant="h2" style={{ marginLeft: spacing.sm }}>Withdrawal history</AppText>
            </View>
            <View style={{ gap: spacing.sm }}>
              {data.payouts.map((p) => (
                <View key={p.id} style={styles.payoutRow}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="label">{p.bank_name} · ****{p.account_number.slice(-4)}</AppText>
                    <AppText variant="caption" color={colors.muted}>
                      {timeAgo(p.created_at)} · Ref: {p.reference}
                    </AppText>
                  </View>
                  <View style={styles.payoutBadge}>
                    <AppText variant="label" color={colors.onBrandPrimary}>
                      {formatNaira(p.amount_kobo)}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Balance card component ────────────────────────────────────────────────────

function BalanceCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent: string;
}) {
  return (
    <View style={[styles.balanceCard, { borderTopColor: accent, borderTopWidth: 3 }]}>
      <Feather name={icon as any} size={18} color={accent} />
      <AppText variant="h2" style={{ marginTop: spacing.sm }}>{value}</AppText>
      <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ marginTop: 2 }}>{label}</AppText>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: colors.surface },
  center: { justifyContent: "center", alignItems: "center", padding: spacing.xl },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  // Balance grid — 2×2
  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  balanceCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.soft,
  },

  // Section
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  // Bank / no-bank
  noBankBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.accentTint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: spacing.lg,
  },
  bankPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  // Withdraw input
  withdrawRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  amountInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  amountField: {
    flex: 1,
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.onSurface,
  },
  quickFills: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickChip: {
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBEBEB",
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandTertiary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },

  // Gift list
  emptyBox: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
  },
  giftRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  giftBody: { flex: 1 },
  giftTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  amountBadge: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  testBadge: {
    backgroundColor: colors.accentTint,
  },

  // Pagination
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  pageBtn: {
    padding: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Payouts
  payoutRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  payoutBadge: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
