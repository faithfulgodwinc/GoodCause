import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, TextInput, ScrollView, Share as RNShare, Linking, Platform } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { api, track } from "@/src/lib/api";
import { AppText, Button, ProgressBar, LoadingView } from "@/src/components/ui";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { formatNaira, formatAmountInput } from "@/src/format";
import { DIRECT_DONATION_DISCLOSURE } from "@/src/constants/impact-commitment";

const PRESETS = [100000, 250000, 500000, 1000000, 2500000, 5000000]; // ₦1k / 2.5k / 5k / 10k / 25k / 50k

const donationWebUrl = (campaignId: string) =>
  `https://www.goodcause.app/donate/${encodeURIComponent(campaignId)}`;

export default function Donate() {
  const { id, reference } = useLocalSearchParams<{ id: string; reference?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [amount, setAmount] = useState<number>(500000);
  const [custom, setCustom] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<null | { prev: number; next: number; test: boolean }>(null);

  const campaign = useQuery({ queryKey: ["campaign", id], queryFn: () => api<any>(`/campaigns/${id}`) });
  const c = campaign.data;

  const verifyPayment = async (refToVerify: string) => {
    setProcessing(true);
    api<any>("/payments/verify", { method: "POST", body: { reference: refToVerify } })
      .then((verify) => {
        if (verify.status === "paid") {
          setSuccess({
            prev: verify.prev_percent ?? c?.percent ?? 0,
            next: verify.new_percent ?? c?.percent ?? 0,
            test: false,
          });
          qc.invalidateQueries({ queryKey: ["campaign", id] });
          qc.invalidateQueries({ queryKey: ["supporters", id] });
          qc.invalidateQueries({ queryKey: ["impact"] });
          qc.invalidateQueries({ queryKey: ["myDonations"] });
        } else {
          setError("We couldn't confirm your payment yet. If you completed it, it may take a moment.");
        }
      })
      .catch((e) => setError(e?.message || "Failed to verify payment."))
      .finally(() => setProcessing(false));
  };



  useEffect(() => {
    if (reference && c && !success && !processing) {
      verifyPayment(reference);
    }
  }, [reference, c]);

  const finalAmount = custom ? Math.round(parseFloat(custom || "0") * 100) : amount;

  const donate = async () => {
    setError("");
    if (!finalAmount || finalAmount < 10000) {
      setError("Please enter at least ₦100.");
      return;
    }
    setProcessing(true);
    track("donation_started", { campaign_id: id });
    try {
      const payload: any = { amount_kobo: finalAmount, anonymous, message };
      if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
        payload.return_url = window.location.origin + "/donate/" + id;
      } else {
        payload.return_url = "https://www.goodcause.app/payment-result";
      }
      const init = await api<any>(`/campaigns/${id}/donate`, {
        method: "POST",
        body: payload,
      });
      if (init.sandbox) {
        const res = await api<any>("/donations/sandbox-complete", { method: "POST", body: { reference: init.reference } });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setSuccess({ prev: res.prev_percent, next: res.new_percent, test: true });
        qc.invalidateQueries({ queryKey: ["campaign", id] });
        qc.invalidateQueries({ queryKey: ["supporters", id] });
        qc.invalidateQueries({ queryKey: ["impact"] });
        qc.invalidateQueries({ queryKey: ["myDonations"] });
      } else if (init.authorization_url) {
        if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
          window.location.href = init.authorization_url;
        } else {
          await WebBrowser.openBrowserAsync(init.authorization_url);
          verifyPayment(init.reference);
        }
      } else {
        setError("Payments are being set up. Please try again shortly.");
      }
    } catch (e: any) {
      setError(e?.message || "We couldn't process that donation. Please try again.");
      track("donation_failed", { campaign_id: id });
    } finally {
      setProcessing(false);
    }
  };

  if (campaign.isLoading || !c) return <View style={styles.full}><LoadingView /></View>;

  if (Platform.OS === "ios") {
    return (
      <View style={styles.full}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} testID="donate-close"><Feather name="x" size={24} color={colors.onSurface} /></Pressable>
          <AppText variant="title">Support this cause</AppText>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          <View style={styles.campRow}>
            <Image source={{ uri: c.cover_image }} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <AppText variant="label" numberOfLines={2}>{c.title}</AppText>
              <AppText variant="caption" style={{ marginTop: 4 }}>{c.percent}% · {formatNaira(c.raised_kobo, { compact: true })} raised</AppText>
            </View>
          </View>

          <View style={styles.externalDonationBox}>
            <Feather name="external-link" size={28} color={colors.brandPrimary} />
            <AppText variant="h1" style={{ textAlign: "center", marginTop: spacing.md }}>
              Continue on the GoodCause website
            </AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: spacing.sm }}>
              Donations are completed outside the app in Safari. GoodCause is not currently a Benevity or Candid approved nonprofit.
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: spacing.md }}>
              {DIRECT_DONATION_DISCLOSURE}
            </AppText>
            <Button
              title="Open donation page"
              icon="external-link"
              onPress={() => WebBrowser.openBrowserAsync(donationWebUrl(id))}
              style={{ marginTop: spacing.lg, alignSelf: "stretch" }}
              testID="external-donation-button"
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (success) {
    return (
      <View style={[styles.full, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, alignItems: "center", paddingTop: spacing.xxxl }}>
          <View style={styles.successIcon}>
            <Feather name="check" size={44} color={colors.onBrandPrimary} />
          </View>
          <AppText variant="display" style={{ textAlign: "center", marginTop: spacing.xl }}>
            You just moved this cause forward.
          </AppText>
          <AppText variant="body" style={{ textAlign: "center", marginTop: spacing.sm }}>
            You gave {formatNaira(finalAmount)} to “{c.title}”.
          </AppText>

          <View style={styles.impactCard}>
            <AppText variant="caption" color="rgba(255,255,255,0.8)">Progress</AppText>
            <View style={styles.rowBetween}>
              <AppText variant="h1" color="#fff">{success.prev}%</AppText>
              <Feather name="arrow-right" size={22} color="#fff" />
              <AppText variant="display" color="#fff">{success.next}%</AppText>
            </View>
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar percent={success.next} color="#fff" />
            </View>
            <AppText variant="caption" color="rgba(255,255,255,0.8)" style={{ marginTop: spacing.sm }}>
              {c.title}
            </AppText>
          </View>

          <View style={styles.shareImpactBox}>
            <Feather name="heart" size={24} color={colors.brandPrimary} />
            <AppText variant="h2" style={{ textAlign: "center", marginTop: spacing.sm }}>
              Double your impact
            </AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: 4 }}>
              Donating is powerful, but sharing brings 2x more support. Tell friends on WhatsApp!
            </AppText>

            <Button
              title="Share to WhatsApp"
              icon="share-2"
              onPress={() => {
                const msg = encodeURIComponent(`I just donated to support “${c.title}” on GoodCause. Join me in making a difference: https://www.goodcause.app/c/${id}`);
                Linking.openURL(`whatsapp://send?text=${msg}`).catch(() => {
                  RNShare.share({ message: `I just supported “${c.title}” on GoodCause. Join me: https://www.goodcause.app/c/${id}` }).catch(() => {});
                });
              }}
              style={{ marginTop: spacing.md, alignSelf: "stretch", backgroundColor: colors.brandPrimary }}
              testID="donation-whatsapp-button"
            />
            <Button
              title="More share options"
              variant="outline"
              onPress={() => RNShare.share({ message: `I just supported “${c.title}” on GoodCause. Join me: https://www.goodcause.app/c/${id}` }).catch(() => {})}
              style={{ marginTop: spacing.xs, alignSelf: "stretch" }}
              testID="donation-share-button"
            />
          </View>

          <Button title="View campaign" variant="outline" onPress={() => router.replace(`/campaign/${id}`)} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} testID="donation-view-button" />
          <Button title="Done" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.xs, alignSelf: "stretch" }} testID="donation-done-button" />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.full}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="donate-close"><Feather name="x" size={24} color={colors.onSurface} /></Pressable>
        <AppText variant="title">Support this cause</AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.campRow}>
          <Image source={{ uri: c.cover_image }} style={styles.thumb} contentFit="cover" />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <AppText variant="label" numberOfLines={2}>{c.title}</AppText>
            <AppText variant="caption" style={{ marginTop: 4 }}>{c.percent}% · {formatNaira(c.raised_kobo, { compact: true })} raised</AppText>
          </View>
        </View>

        <AppText variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Choose an amount</AppText>
        <View style={styles.grid}>
          {PRESETS.map((p) => (
            <Pressable
              key={p}
              testID={`amount-${p}`}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setCustom(""); setAmount(p); }}
              style={[styles.amount, !custom && amount === p && styles.amountActive]}
            >
              <AppText variant="title" color={!custom && amount === p ? colors.onBrandPrimary : colors.onSurface}>
                {formatNaira(p, { compact: true })}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View style={styles.customBox}>
          <AppText variant="label" color={colors.muted}>₦</AppText>
          <TextInput
            testID="custom-amount-input"
            value={custom ? formatAmountInput(custom) : ""}
            onChangeText={(v) => setCustom(v.replace(/\D/g, ""))}
            placeholder="Enter custom amount"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            style={styles.customInput}
          />
        </View>

        <Pressable testID="anonymous-toggle" onPress={() => setAnonymous((v) => !v)} style={styles.toggleRow}>
          <View style={[styles.checkbox, anonymous && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
            {anonymous ? <Feather name="check" size={14} color="#fff" /> : null}
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <AppText variant="bodyMedium">Donate anonymously</AppText>
            <AppText variant="caption">{"Your name won't be shown publicly."}</AppText>
          </View>
        </Pressable>

        <TextInput
          testID="message-input"
          value={message}
          onChangeText={setMessage}
          placeholder="Add a message of support (optional)"
          placeholderTextColor={colors.muted}
          multiline
          style={styles.messageBox}
        />

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color={colors.error} />
            <AppText variant="caption" color={colors.error} style={{ marginLeft: 6, flex: 1 }}>{error}</AppText>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginBottom: spacing.sm }}>
          {DIRECT_DONATION_DISCLOSURE}
        </AppText>
        <Button
          title={`Support with ${formatNaira(finalAmount || 0)}`}
          onPress={donate}
          loading={processing}
          testID="to-payment-button"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: colors.surface, width: "100%", maxWidth: 560, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  campRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  amount: { width: "31%", flexGrow: 1, height: 60, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  amountActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  customBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 56, marginTop: spacing.md },
  customInput: { flex: 1, marginLeft: spacing.sm, fontFamily: font.semibold, fontSize: 16, color: colors.onSurface },
  toggleRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  messageBox: { minHeight: 80, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.lg, fontFamily: font.regular, fontSize: 14, color: colors.onSurface, textAlignVertical: "top" },
  errorBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FBEBEB", padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },

  secureRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg, backgroundColor: colors.surfaceTertiary, padding: spacing.md, borderRadius: radius.md },
  successIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", ...shadow.raised },
  impactCard: { alignSelf: "stretch", backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, marginTop: spacing.xxl },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  testBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#FBF1E0", padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  shareImpactBox: {
    alignSelf: "stretch",
    backgroundColor: "#F0FDF4",
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  externalDonationBox: {
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
});
