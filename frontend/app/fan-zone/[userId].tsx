import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Share as RNShare,
  Linking,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { api, track } from "@/src/lib/api";
import { AppText, Button, Avatar, LoadingView } from "@/src/components/ui";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { formatNaira, formatAmountInput } from "@/src/format";

type FanZone = {
  user: { id: string; name: string; picture?: string; bio?: string; verified_organizer: boolean };
  headline: string;
  thank_you_message: string;
  presets: number[];
  total_received_kobo: number;
  supporters_count: number;
  recent_gifts: Array<{
    id: string;
    amount_kobo: number;
    name: string;
    message: string;
    paid_at: string;
    anonymous: boolean;
  }>;
};

/** Deep-link into the app (used for redirects after payment). */
const fanZoneAppUrl = (userId: string) =>
  `https://www.goodcause.app/fan-zone/${encodeURIComponent(userId)}`;

/**
 * Social share URL — points at the server-rendered OG/Twitter card endpoint
 * so WhatsApp, iMessage, Twitter, Telegram all show a rich preview with
 * the user's picture, headline and supporter count.
 */
const fanZoneShareUrl = (userId: string) =>
  `https://www.goodcause.app/share/fan-zone/${encodeURIComponent(userId)}`;

export default function FanZonePage() {
  const { userId, reference } = useLocalSearchParams<{ userId: string; reference?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [amount, setAmount] = useState<number>(100000); // default ₦1,000
  const [custom, setCustom] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<null | { thankYouMessage: string; recipientName: string; test: boolean }>(null);

  const fanZone = useQuery({
    queryKey: ["fan-zone", userId],
    queryFn: () => api<FanZone>(`/users/${userId}/fan-zone`),
  });
  const zone = fanZone.data;

  const verifyGift = async (ref: string) => {
    setProcessing(true);
    api<any>("/fan-gifts/verify", { method: "POST", body: { reference: ref } })
      .then((v) => {
        if (v.status === "paid") {
          setSuccess({ thankYouMessage: v.thank_you_message, recipientName: v.recipient_name, test: false });
          qc.invalidateQueries({ queryKey: ["fan-zone", userId] });
        } else {
          setError("We couldn't confirm your payment yet. If you completed it, it may take a moment.");
        }
      })
      .catch((e) => setError(e?.message || "Failed to verify payment."))
      .finally(() => setProcessing(false));
  };

  useEffect(() => {
    if (reference && zone && !success && !processing) {
      verifyGift(reference);
    }
  }, [reference, zone]);

  const finalAmount = custom ? Math.round(parseFloat(custom || "0") * 100) : amount;

  const sendGift = async () => {
    setError("");
    if (!finalAmount || finalAmount < 10000) {
      setError("Please enter at least ₦100.");
      return;
    }
    setProcessing(true);
    track("fan_gift_started", { recipient_id: userId });
    try {
      const payload: any = { amount_kobo: finalAmount, anonymous, message };
      if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
        payload.return_url = window.location.origin + "/fan-zone/" + userId;
      } else {
        payload.return_url = "https://www.goodcause.app/payment-result";
      }
      const init = await api<any>(`/users/${userId}/gift`, { method: "POST", body: payload });

      if (init.sandbox) {
        const res = await api<any>("/fan-gifts/sandbox-complete", {
          method: "POST",
          body: { reference: init.reference },
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setSuccess({ thankYouMessage: res.thank_you_message, recipientName: res.recipient_name, test: true });
        qc.invalidateQueries({ queryKey: ["fan-zone", userId] });
      } else if (init.authorization_url) {
        if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
          window.location.href = init.authorization_url;
        } else {
          await WebBrowser.openBrowserAsync(init.authorization_url);
          verifyGift(init.reference);
        }
      } else {
        setError("Payments are being set up. Please try again shortly.");
      }
    } catch (e: any) {
      setError(e?.message || "We couldn't process that gift. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (fanZone.isLoading || !zone) {
    return (
      <View style={styles.full}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} testID="fanzone-close">
            <Feather name="arrow-left" size={24} color={colors.onSurface} />
          </Pressable>
          <View style={{ width: 24 }} />
        </View>
        <LoadingView />
      </View>
    );
  }

  if (fanZone.isError) {
    return (
      <View style={[styles.full, { justifyContent: "center", alignItems: "center", padding: spacing.xl }]}>
        <Feather name="coffee" size={48} color={colors.muted} />
        <AppText variant="h2" style={{ textAlign: "center", marginTop: spacing.lg }}>Fan Zone not found</AppText>
        <AppText variant="body" style={{ textAlign: "center", marginTop: spacing.sm }}>
          This user hasn't set up a Fan Zone yet.
        </AppText>
        <Button title="Go back" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  // iOS: redirect to web
  if (Platform.OS === "ios") {
    return (
      <View style={styles.full}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} testID="fanzone-close">
            <Feather name="arrow-left" size={24} color={colors.onSurface} />
          </Pressable>
          <AppText variant="title">Send a Gift</AppText>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          <View style={styles.profileCard}>
            <Avatar name={zone.user.name} uri={zone.user.picture} size={64} />
            <AppText variant="h2" style={{ marginTop: spacing.md, textAlign: "center" }}>{zone.headline}</AppText>
            {zone.user.bio ? (
              <AppText variant="body" style={{ textAlign: "center", marginTop: spacing.sm }}>{zone.user.bio}</AppText>
            ) : null}
          </View>
          <View style={styles.externalBox}>
            <Feather name="external-link" size={28} color={colors.brandPrimary} />
            <AppText variant="h1" style={{ textAlign: "center", marginTop: spacing.md }}>
              Continue on the GoodCause website
            </AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: spacing.sm }}>
              Gifts are completed outside the app in Safari.
            </AppText>
            <Button
              title="Open gift page"
              icon="external-link"
              onPress={() => WebBrowser.openBrowserAsync(fanZoneAppUrl(userId))}
              style={{ marginTop: spacing.lg, alignSelf: "stretch" }}
              testID="external-gift-button"
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // Success screen
  if (success) {
    return (
      <View style={[styles.full, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, alignItems: "center", paddingTop: spacing.xxxl }}
        >
          <View style={styles.successIcon}>
            <Feather name="heart" size={44} color={colors.onBrandPrimary} />
          </View>
          <AppText variant="display" style={{ textAlign: "center", marginTop: spacing.xl }}>
            You just made {success.recipientName ? `${success.recipientName}'s` : "someone's"} day!
          </AppText>
          <AppText variant="body" style={{ textAlign: "center", marginTop: spacing.sm }}>
            You sent {formatNaira(finalAmount)} to their Fan Zone.
          </AppText>

          {/* Thank-you message from recipient */}
          <View style={styles.thankYouCard}>
            <Avatar name={zone.user.name} uri={zone.user.picture} size={44} />
            <View style={styles.thankYouBubble}>
              <AppText variant="label" style={{ marginBottom: spacing.xs }}>{zone.user.name} says:</AppText>
              <AppText variant="body" color={colors.onSurfaceSecondary}>{success.thankYouMessage}</AppText>
            </View>
          </View>

          {/* Share nudge */}
          <View style={styles.shareBox}>
            <Feather name="share-2" size={22} color={colors.brandPrimary} />
            <AppText variant="h2" style={{ textAlign: "center", marginTop: spacing.sm }}>
              Spread the love
            </AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: 4 }}>
              Let your friends know — your generosity inspires others!
            </AppText>
            <Button
              title="Share to WhatsApp"
              icon="share-2"
              onPress={() => {
                const msg = encodeURIComponent(
                  `I just sent a gift to ${zone.user.name} on GoodCause to support their work. Check them out: ${fanZoneShareUrl(userId)}`
                );
                Linking.openURL(`whatsapp://send?text=${msg}`).catch(() => {
                  RNShare.share({ message: `I just supported ${zone.user.name} on GoodCause: ${fanZoneShareUrl(userId)}` }).catch(() => {});
                });
              }}
              style={{ marginTop: spacing.md, alignSelf: "stretch" }}
              testID="gift-whatsapp-button"
            />
            <Button
              title="More share options"
              variant="outline"
              onPress={() =>
                RNShare.share({ message: `I just supported ${zone.user.name} on GoodCause: ${fanZoneShareUrl(userId)}` }).catch(() => {})
              }
              style={{ marginTop: spacing.xs, alignSelf: "stretch" }}
              testID="gift-share-button"
            />
          </View>

          <Button
            title="Done"
            variant="ghost"
            onPress={() => router.back()}
            style={{ marginTop: spacing.lg, alignSelf: "stretch" }}
            testID="gift-done-button"
          />
        </ScrollView>
      </View>
    );
  }

  const presets = zone.presets || [50000, 100000, 250000, 500000, 1000000];

  return (
    <View style={styles.full}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="fanzone-close">
          <Feather name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <AppText variant="title">Send a Gift</AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile card */}
        <View style={styles.profileCard}>
          <Avatar name={zone.user.name} uri={zone.user.picture} size={64} />
          <AppText variant="h2" style={{ marginTop: spacing.md, textAlign: "center" }}>
            {zone.headline}
          </AppText>
          {zone.user.bio ? (
            <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: spacing.sm }}>
              {zone.user.bio}
            </AppText>
          ) : null}

          {/* Stats row */}
          {zone.supporters_count > 0 ? (
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <AppText variant="h2" color={colors.brandPrimary}>{zone.supporters_count}</AppText>
                <AppText variant="caption">supporters</AppText>
              </View>
              <View style={[styles.stat, styles.statBorder]}>
                <AppText variant="h2" color={colors.brandPrimary}>
                  {formatNaira(zone.total_received_kobo, { compact: true })}
                </AppText>
                <AppText variant="caption">total received</AppText>
              </View>
            </View>
          ) : null}
        </View>

        {/* Amount picker */}
        <AppText variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          Choose an amount
        </AppText>
        <View style={styles.grid}>
          {presets.map((p) => (
            <Pressable
              key={p}
              testID={`gift-amount-${p}`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setCustom("");
                setAmount(p);
              }}
              style={[styles.amountBtn, !custom && amount === p && styles.amountBtnActive]}
            >
              <AppText
                variant="title"
                color={!custom && amount === p ? colors.onBrandPrimary : colors.onSurface}
              >
                {formatNaira(p, { compact: true })}
              </AppText>
            </Pressable>
          ))}
        </View>

        {/* Custom amount */}
        <View style={styles.customBox}>
          <AppText variant="label" color={colors.muted}>₦</AppText>
          <TextInput
            testID="gift-custom-amount"
            value={custom ? formatAmountInput(custom) : ""}
            onChangeText={(v) => setCustom(v.replace(/\D/g, ""))}
            placeholder="Enter custom amount"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            style={styles.customInput}
          />
        </View>

        {/* Anonymous toggle */}
        <Pressable
          testID="gift-anonymous-toggle"
          onPress={() => setAnonymous((v) => !v)}
          style={styles.toggleRow}
        >
          <View style={[styles.checkbox, anonymous && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
            {anonymous ? <Feather name="check" size={14} color="#fff" /> : null}
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <AppText variant="bodyMedium">Send anonymously</AppText>
            <AppText variant="caption">{"Your name won't be shown publicly."}</AppText>
          </View>
        </Pressable>

        {/* Message */}
        <TextInput
          testID="gift-message-input"
          value={message}
          onChangeText={setMessage}
          placeholder={`Leave a kind message for ${zone.user.name} (optional)`}
          placeholderTextColor={colors.muted}
          multiline
          style={styles.messageBox}
        />

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color={colors.error} />
            <AppText variant="caption" color={colors.error} style={{ marginLeft: 6, flex: 1 }}>
              {error}
            </AppText>
          </View>
        ) : null}

        {/* Recent gifts wall */}
        {zone.recent_gifts.length > 0 ? (
          <View style={{ marginTop: spacing.xxl }}>
            <AppText variant="h2" style={{ marginBottom: spacing.md }}>Recent supporters</AppText>
            <View style={{ gap: spacing.sm }}>
              {zone.recent_gifts.slice(0, 6).map((g) => (
                <View key={g.id} style={styles.giftRow}>
                  <Avatar name={g.anonymous ? "A" : g.name} size={32} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <AppText variant="label">{g.name}</AppText>
                    {g.message ? (
                      <AppText variant="caption" numberOfLines={2}>{g.message}</AppText>
                    ) : null}
                  </View>
                  <AppText variant="label" color={colors.brandPrimary}>
                    {formatNaira(g.amount_kobo, { compact: true })}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button
          title={`Send ${formatNaira(finalAmount || 0)} gift 💛`}
          onPress={sendGift}
          loading={processing}
          testID="send-gift-button"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: colors.surface, width: "100%", maxWidth: 560, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    width: "100%",
  },
  stat: { flex: 1, alignItems: "center" },
  statBorder: { borderLeftWidth: 1, borderLeftColor: colors.border },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  amountBtn: {
    width: "31%",
    flexGrow: 1,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  amountBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  customBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 56,
    marginTop: spacing.md,
  },
  customInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.onSurface,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  messageBox: {
    minHeight: 80,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.onSurface,
    textAlignVertical: "top",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBEBEB",
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  giftRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.raised,
  },
  thankYouCard: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.xxl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  thankYouBubble: { flex: 1 },
  shareBox: {
    alignSelf: "stretch",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  externalBox: {
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
});
