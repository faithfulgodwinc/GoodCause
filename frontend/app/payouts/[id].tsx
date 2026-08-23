import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/lib/api";
import { AppText, Button, LoadingView, ErrorView } from "@/src/components/ui";
import { colors, spacing, radius, shadow, font } from "@/src/theme";
import { formatNaira, timeAgo } from "@/src/format";

type Bank = { name: string; code: string };

type PayoutData = {
  campaign_id: string;
  campaign_title: string;
  gross_raised_kobo: number;
  platform_fee_kobo: number;
  processing_fee_kobo: number;
  withdrawn_kobo: number;
  available_kobo: number;
  currency: string;
  bank_account?: {
    bank_name: string;
    bank_code: string;
    account_number: string;
    account_name: string;
  } | null;
  history: Array<{
    id: string;
    amount_kobo: number;
    bank_name: string;
    account_number: string;
    account_name: string;
    status: string;
    reference: string;
    created_at: string;
  }>;
};

export default function PayoutDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  // Withdraw flow state
  const [amountStr, setAmountStr] = useState("");
  const [successModal, setSuccessModal] = useState<any>(null);

  // Bank edit / linking state
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [bankSearch, setBankSearch] = useState("");

  // Queries
  const { data: banks } = useQuery<Bank[]>({
    queryKey: ["banks"],
    queryFn: () => api<Bank[]>("/banks"),
  });

  const { data, isLoading, isError, refetch } = useQuery<PayoutData>({
    queryKey: ["payouts", id],
    queryFn: () => api<PayoutData>(`/campaigns/${id}/payouts`),
    enabled: !!id,
  });

  // Auto-resolve account number when 10 digits entered
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      setResolving(true);
      api<any>("/banks/resolve", {
        method: "POST",
        body: { account_number: accountNumber, bank_code: selectedBank.code },
      })
        .then((res) => {
          if (res?.account_name) {
            setResolvedName(res.account_name);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        })
        .catch(() => {
          setResolvedName("");
        })
        .finally(() => setResolving(false));
    } else {
      setResolvedName("");
    }
  }, [accountNumber, selectedBank]);

  // Link bank mutation
  const linkBankMut = useMutation({
    mutationFn: () =>
      api(`/campaigns/${id}/bank-account`, {
        method: "POST",
        body: {
          bank_name: selectedBank?.name,
          bank_code: selectedBank?.code,
          account_number: accountNumber,
          account_name: resolvedName,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payouts", id] });
      setIsEditingBank(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
  });

  // Withdraw mutation
  const withdrawMut = useMutation({
    mutationFn: (amtKobo: number) =>
      api(`/campaigns/${id}/withdraw`, {
        method: "POST",
        body: { amount_kobo: amtKobo },
      }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["payouts", id] });
      setAmountStr("");
      setSuccessModal(res);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    onError: (err: any) => {
      Alert.alert("Withdrawal Error", err?.message || "Could not process withdrawal. Please try again.");
    },
  });

  if (isLoading && !data) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingView label="Loading payout ledger..." />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ErrorView message="Could not load payout details." onRetry={refetch} />
      </View>
    );
  }

  const availableKobo = data.available_kobo || 0;
  const parsedAmountNaira = parseFloat(amountStr.replace(/,/g, "")) || 0;
  const withdrawAmountKobo = Math.round(parsedAmountNaira * 100);
  const isValidAmount = withdrawAmountKobo > 0 && withdrawAmountKobo <= availableKobo;

  const hasBank = !!data.bank_account;
  const filteredBanks = (banks || []).filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="payouts-back">
          <Feather name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <AppText variant="title">Withdraw Funds</AppText>
          <AppText variant="caption" numberOfLines={1} color={colors.onSurfaceTertiary}>
            {data.campaign_title}
          </AppText>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        {/* Available Balance Hero Card */}
        <View style={styles.balanceHero}>
          <View style={styles.rowBetween}>
            <View>
              <AppText variant="caption" color="rgba(255,255,255,0.85)">
                Available for withdrawal
              </AppText>
              <AppText variant="display" color="#FFFFFF" style={{ marginTop: 4 }}>
                {formatNaira(availableKobo)}
              </AppText>
            </View>
            <View style={styles.badgeInstant}>
              <Feather name="zap" size={12} color="#FFFFFF" />
              <AppText variant="caption" color="#FFFFFF" style={{ marginLeft: 3, fontWeight: "700" }}>
                Instant NIP
              </AppText>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.statsGrid}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color="rgba(255,255,255,0.7)">
                Gross Raised
              </AppText>
              <AppText variant="bodyMedium" color="#FFFFFF" style={{ marginTop: 2 }}>
                {formatNaira(data.gross_raised_kobo)}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color="rgba(255,255,255,0.7)">
                Platform Fee
              </AppText>
              <AppText variant="bodyMedium" color="#FFFFFF" style={{ marginTop: 2 }}>
                ₦0 (0%)
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color="rgba(255,255,255,0.7)">
                Withdrawn
              </AppText>
              <AppText variant="bodyMedium" color="#FFFFFF" style={{ marginTop: 2 }}>
                {formatNaira(data.withdrawn_kobo)}
              </AppText>
            </View>
          </View>
        </View>

        {/* Bank Account Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="h2">Destination Bank Account</AppText>
            {hasBank && !isEditingBank ? (
              <Pressable
                onPress={() => {
                  setSelectedBank(null);
                  setAccountNumber("");
                  setResolvedName("");
                  setIsEditingBank(true);
                }}
              >
                <AppText variant="label" color={colors.brandPrimary}>
                  Change
                </AppText>
              </Pressable>
            ) : null}
          </View>

          {hasBank && !isEditingBank ? (
            <View style={styles.bankCard}>
              <View style={styles.bankIconCircle}>
                <Feather name="shield" size={20} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <AppText variant="bodyMedium">{data.bank_account?.bank_name}</AppText>
                <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ marginTop: 2 }}>
                  •••• {data.bank_account?.account_number.slice(-4)} · {data.bank_account?.account_name}
                </AppText>
              </View>
              <View style={styles.verifiedPill}>
                <Feather name="check" size={12} color={colors.brandPrimary} />
                <AppText variant="caption" color={colors.brandPrimary} style={{ marginLeft: 3, fontWeight: "700", fontSize: 11 }}>
                  Verified
                </AppText>
              </View>
            </View>
          ) : (
            <View style={styles.bankFormCard}>
              <AppText variant="caption" color={colors.onSurfaceSecondary}>
                Select your Nigerian bank and enter your 10-digit NUBAN account number.
              </AppText>

              {/* Bank Selector Button */}
              <Pressable
                onPress={() => setBankModalOpen(true)}
                style={styles.inputPicker}
                testID="bank-selector-button"
              >
                <Feather name="home" size={18} color={colors.onSurfaceSecondary} />
                <AppText
                  variant="body"
                  color={selectedBank ? colors.onSurface : colors.muted}
                  style={{ flex: 1, marginLeft: spacing.sm }}
                >
                  {selectedBank ? selectedBank.name : "Select Bank"}
                </AppText>
                <Feather name="chevron-down" size={18} color={colors.muted} />
              </Pressable>

              {/* Account Number Input */}
              <View style={styles.inputWrap}>
                <Feather name="credit-card" size={18} color={colors.onSurfaceSecondary} />
                <TextInput
                  value={accountNumber}
                  onChangeText={(val) => setAccountNumber(val.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit Account Number"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  style={styles.textInput}
                  testID="bank-account-input"
                />
                {resolving ? (
                  <AppText variant="caption" color={colors.brandPrimary}>
                    Verifying...
                  </AppText>
                ) : null}
              </View>

              {/* Resolved Name Box */}
              {resolvedName ? (
                <View style={styles.resolvedBox}>
                  <Feather name="check-circle" size={16} color={colors.brandPrimary} />
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <AppText variant="caption" color={colors.onSurfaceSecondary}>
                      Account Name (NIBSS Verified)
                    </AppText>
                    <AppText variant="bodyMedium" style={{ fontWeight: "700" }}>
                      {resolvedName}
                    </AppText>
                  </View>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                {hasBank ? (
                  <Button
                    title="Cancel"
                    variant="outline"
                    small
                    onPress={() => setIsEditingBank(false)}
                    style={{ flex: 1 }}
                  />
                ) : null}
                <Button
                  title="Save & Link Account"
                  small
                  disabled={!selectedBank || accountNumber.length !== 10 || !resolvedName}
                  loading={linkBankMut.isPending}
                  onPress={() => linkBankMut.mutate()}
                  style={{ flex: hasBank ? 1.5 : 1, backgroundColor: colors.brandPrimary }}
                  testID="save-bank-button"
                />
              </View>
            </View>
          )}
        </View>

        {/* Withdrawal Amount Panel */}
        <View style={styles.section}>
          <AppText variant="h2">Enter Amount to Withdraw</AppText>
          <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ marginTop: 2 }}>
            You can withdraw any portion at any time without stopping your campaign.
          </AppText>

          <View style={styles.amountInputWrap}>
            <AppText variant="h1" color={colors.brandPrimary}>
              ₦
            </AppText>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={styles.amountTextInput}
              testID="withdraw-amount-input"
            />
            {availableKobo > 0 ? (
              <Pressable
                onPress={() => {
                  setAmountStr((availableKobo / 100).toLocaleString());
                  Haptics.selectionAsync().catch(() => {});
                }}
                style={styles.maxPill}
              >
                <AppText variant="caption" color={colors.brandPrimary} style={{ fontWeight: "700" }}>
                  Withdraw All
                </AppText>
              </Pressable>
            ) : null}
          </View>

          {/* Quick Presets */}
          <View style={styles.presetRow}>
            {[500000, 1000000, 2500000, 5000000].map((amt) => {
              if (amt > availableKobo) return null;
              return (
                <Pressable
                  key={amt}
                  onPress={() => {
                    setAmountStr((amt / 100).toLocaleString());
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  style={styles.presetBtn}
                >
                  <AppText variant="caption" style={{ fontWeight: "600" }}>
                    {formatNaira(amt, { compact: true })}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <Button
            title={`Transfer ${parsedAmountNaira > 0 ? `₦${parsedAmountNaira.toLocaleString()}` : "to Bank"}`}
            icon="send"
            disabled={!hasBank || !isValidAmount}
            loading={withdrawMut.isPending}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              withdrawMut.mutate(withdrawAmountKobo);
            }}
            style={{ marginTop: spacing.lg, backgroundColor: colors.brandPrimary }}
            testID="withdraw-submit-button"
          />
        </View>

        {/* Withdrawal History */}
        <View style={styles.section}>
          <AppText variant="h2">Disbursement History</AppText>
          {data.history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Feather name="clock" size={24} color={colors.muted} />
              <AppText variant="caption" color={colors.onSurfaceTertiary} style={{ marginTop: spacing.xs }}>
                No withdrawals yet. All funds remain in your ledger.
              </AppText>
            </View>
          ) : (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {data.history.map((h) => (
                <View key={h.id} style={styles.historyCard}>
                  <View style={styles.historyIcon}>
                    <Feather name="arrow-up-right" size={18} color={colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <AppText variant="bodyMedium">{formatNaira(h.amount_kobo)}</AppText>
                    <AppText variant="caption" color={colors.onSurfaceTertiary} style={{ marginTop: 2 }}>
                      {h.bank_name} (•••• {h.account_number.slice(-4)}) · {timeAgo(h.created_at)}
                    </AppText>
                  </View>
                  <View style={styles.statusSuccess}>
                    <AppText variant="caption" color={colors.brandPrimary} style={{ fontWeight: "700", fontSize: 11 }}>
                      {h.status}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bank Picker Modal */}
      <Modal visible={bankModalOpen} animationType="slide" transparent onRequestClose={() => setBankModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setBankModalOpen(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText variant="h2">Select Bank</AppText>
          <View style={styles.bankSearchWrap}>
            <Feather name="search" size={16} color={colors.muted} />
            <TextInput
              value={bankSearch}
              onChangeText={setBankSearch}
              placeholder="Search bank name"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, marginLeft: spacing.sm, fontSize: 15, fontFamily: font.regular }}
            />
          </View>
          <FlatList
            data={filteredBanks}
            keyExtractor={(item) => item.code}
            style={{ maxHeight: 350, marginTop: spacing.sm }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setSelectedBank(item);
                  setBankModalOpen(false);
                  Haptics.selectionAsync().catch(() => {});
                }}
                style={styles.bankListItem}
              >
                <AppText variant="body" style={{ flex: 1 }}>
                  {item.name}
                </AppText>
                {selectedBank?.code === item.code ? (
                  <Feather name="check" size={18} color={colors.brandPrimary} />
                ) : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Withdrawal Success Modal */}
      <Modal visible={!!successModal} animationType="fade" transparent onRequestClose={() => setSuccessModal(null)}>
        <View style={styles.successBackdrop}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Feather name="check-circle" size={42} color={colors.brandPrimary} />
            </View>
            <AppText variant="h1" style={{ textAlign: "center", marginTop: spacing.md }}>
              Transfer Sent!
            </AppText>
            <AppText variant="display" color={colors.brandPrimary} style={{ textAlign: "center", marginTop: 4 }}>
              {formatNaira(successModal?.amount_kobo || 0)}
            </AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: spacing.sm }}>
              Disbursed to {successModal?.bank_name} (•••• {successModal?.account_number?.slice(-4)}).
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceTertiary} style={{ textAlign: "center", marginTop: 4 }}>
              Reference: {successModal?.reference}
            </AppText>
            <Button
              title="Done"
              onPress={() => setSuccessModal(null)}
              style={{ marginTop: spacing.xl, alignSelf: "stretch", backgroundColor: colors.brandPrimary }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  balanceHero: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.raised,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badgeInstant: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: spacing.lg },
  statsGrid: { flexDirection: "row", justifyContent: "space-between" },
  section: { marginTop: spacing.xl },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  bankCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  bankIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(2, 169, 92, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(2, 169, 92, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  bankFormCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputPicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    height: 52,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    height: 52,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  textInput: { flex: 1, marginLeft: spacing.sm, fontSize: 16, fontFamily: font.semibold, color: colors.onSurface },
  resolvedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    height: 64,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  amountTextInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 26,
    fontFamily: font.bold,
    color: colors.onSurface,
  },
  maxPill: {
    backgroundColor: "rgba(2, 169, 92, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  presetRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  presetBtn: {
    flex: 1,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyHistory: {
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(2, 169, 92, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusSuccess: {
    backgroundColor: "rgba(2, 169, 92, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  bankSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    marginTop: spacing.md,
  },
  bankListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  successBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  successCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    ...shadow.raised,
  },
  successIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(2, 169, 92, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
});
