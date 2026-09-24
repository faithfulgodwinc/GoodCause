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
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { api, track } from "@/src/lib/api";
import { useAuth } from "@/src/context/auth";
import { AppText, Button, Avatar, LoadingView } from "@/src/components/ui";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { formatNaira, formatAmountInput, timeAgo } from "@/src/format";

const COVER_HEIGHT = 200;
const AVATAR_SIZE = 88;
const AVATAR_OVERLAP = AVATAR_SIZE / 2;

type FanZone = {
  user: { id: string; name: string; picture?: string; bio?: string; verified_organizer: boolean };
  headline: string;
  thank_you_message: string;
  cover_image?: string;
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

// Direct app URL — supporters land on the gift form.
// WhatsApp will still fetch og: tags from the page (Vercel serves index.html,
// which Expo Router will render; for richer crawler previews the separate
// /share/fan-zone/:id endpoint exists but is not the link we hand to humans).
const fanZoneAppUrl = (userId: string) =>
  `https://www.goodcause.app/fan-zone/${encodeURIComponent(userId)}`;

export default function FanZonePage() {
  const { userId, reference } = useLocalSearchParams<{ userId: string; reference?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user: me } = useAuth();

  const isOwner = me?.id === userId;

  const [amount, setAmount] = useState<number>(100000);
  const [custom, setCustom] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<null | {
    thankYouMessage: string;
    recipientName: string;
    test: boolean;
  }>(null);

  const fanZone = useQuery({
    queryKey: ["fan-zone", userId],
    queryFn: () => api<FanZone>(`/users/${userId}/fan-zone`),
    retry: false, // don't retry 404s — we handle them explicitly
  });
  const zone = fanZone.data;

  // If the owner visits their own fan zone and it doesn't exist yet → go create
  useEffect(() => {
    if (isOwner && fanZone.isError) {
      router.replace("/fan-zone/setup" as any);
    }
  }, [isOwner, fanZone.isError]);

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

  // ── Loading ──────────────────────────────────────────────────────────────
  if (fanZone.isLoading) {
    return <View style={styles.full}><LoadingView /></View>;
  }

  // ── Fan zone not found (non-owner) ────────────────────────────────────────
  if (fanZone.isError && !isOwner) {
    return (
      <View style={[styles.full, styles.center]}>
        <Feather name="coffee" size={48} color={colors.muted} />
        <AppText variant="h2" style={{ textAlign: "center", marginTop: spacing.lg }}>
          Fan Zone not found
        </AppText>
        <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: spacing.sm }}>
          This user hasn't set up a Fan Zone yet.
        </AppText>
        <Button title="Go back" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  if (!zone) return null; // waiting for redirect (owner 404 case)

  // ── iOS external redirect ─────────────────────────────────────────────────
  if (Platform.OS === "ios" && !isOwner) {
    return (
      <View style={styles.full}>
        <View style={[styles.headerBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()}><Feather name="arrow-left" size={24} color={colors.onSurface} /></Pressable>
          <AppText variant="title">Send a Gift</AppText>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          <HeroProfile zone={zone} insets={insets} isOwner={false} onEdit={() => {}} />
          <View style={styles.externalBox}>
            <Feather name="external-link" size={28} color={colors.brandPrimary} />
            <AppText variant="h1" style={{ textAlign: "center", marginTop: spacing.md }}>
              Continue on the GoodCause website
            </AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: spacing.sm }}>
              Gifts are completed outside the app in Safari.
            </AppText>
            <Button title="Open gift page" icon="external-link"
              onPress={() => WebBrowser.openBrowserAsync(fanZoneAppUrl(userId))}
              style={{ marginTop: spacing.lg, alignSelf: "stretch" }} testID="external-gift-button" />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <View style={[styles.full, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, alignItems: "center", paddingTop: spacing.xxxl }}>
          <View style={styles.successIcon}>
            <Feather name="heart" size={44} color={colors.onBrandPrimary} />
          </View>
          <AppText variant="display" style={{ textAlign: "center", marginTop: spacing.xl }}>
            You just made {success.recipientName ? `${success.recipientName}'s` : "someone's"} day!
          </AppText>
          <AppText variant="body" style={{ textAlign: "center", marginTop: spacing.sm }}>
            You sent {formatNaira(finalAmount)} to their Fan Zone.
          </AppText>

          <View style={styles.thankYouCard}>
            <Avatar name={zone.user.name} uri={zone.user.picture} size={44} />
            <View style={{ flex: 1 }}>
              <AppText variant="label" style={{ marginBottom: spacing.xs }}>{zone.user.name} says:</AppText>
              <AppText variant="body" color={colors.onSurfaceSecondary}>{success.thankYouMessage}</AppText>
            </View>
          </View>

          <View style={styles.shareBox}>
            <Feather name="share-2" size={22} color={colors.brandPrimary} />
            <AppText variant="h2" style={{ textAlign: "center", marginTop: spacing.sm }}>Spread the love</AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: 4 }}>
              Let your friends know — your generosity inspires others!
            </AppText>
            <Button title="Share to WhatsApp" icon="share-2"
              onPress={() => {
                const msg = encodeURIComponent(`I just sent a gift to ${zone.user.name} on GoodCause to support their work. Check them out: ${fanZoneAppUrl(userId)}`);
                Linking.openURL(`whatsapp://send?text=${msg}`).catch(() => {
                  RNShare.share({ message: `I just supported ${zone.user.name} on GoodCause: ${fanZoneAppUrl(userId)}` }).catch(() => {});
                });
              }}
              style={{ marginTop: spacing.md, alignSelf: "stretch" }} testID="gift-whatsapp-button" />
            <Button title="More share options" variant="outline"
              onPress={() => RNShare.share({ message: `I just supported ${zone.user.name} on GoodCause: ${fanZoneAppUrl(userId)}` }).catch(() => {})}
              style={{ marginTop: spacing.xs, alignSelf: "stretch" }} testID="gift-share-button" />
          </View>

          <Button title="Done" variant="ghost" onPress={() => router.back()}
            style={{ marginTop: spacing.lg, alignSelf: "stretch" }} testID="gift-done-button" />
        </ScrollView>
      </View>
    );
  }

  // ── Main fan zone page ────────────────────────────────────────────────────
  const presets = zone.presets || [50000, 100000, 250000, 500000, 1000000];

  return (
    <View style={styles.full}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: isOwner ? 40 : 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero section ── */}
        <HeroProfile
          zone={zone}
          insets={insets}
          isOwner={isOwner}
          onEdit={() => router.push("/fan-zone/setup" as any)}
        />

        {/* ── Body ── */}
        <View style={styles.body}>

          {/* Stats */}
          {zone.supporters_count > 0 ? (
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <AppText variant="h2" color={colors.brandPrimary}>{zone.supporters_count}</AppText>
                <AppText variant="caption">supporters</AppText>
              </View>
              <View style={[styles.stat, styles.statDivider]}>
                <AppText variant="h2" color={colors.brandPrimary}>
                  {formatNaira(zone.total_received_kobo, { compact: true })}
                </AppText>
                <AppText variant="caption">received</AppText>
              </View>
            </View>
          ) : null}

          {/* Supporters wall */}
          <View style={styles.wallSection}>
            <AppText variant="h2" style={{ marginBottom: spacing.md }}>
              {zone.recent_gifts.length > 0
                ? `${zone.supporters_count} supporter${zone.supporters_count !== 1 ? "s" : ""}`
                : "Be the first to support"}
            </AppText>

            {zone.recent_gifts.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                {zone.recent_gifts.map((g) => (
                  <View key={g.id} style={styles.supporterCard}>
                    <Avatar name={g.anonymous ? "?" : g.name} size={40} />
                    <View style={styles.supporterBody}>
                      <View style={styles.supporterTopRow}>
                        <AppText variant="label" style={{ flex: 1 }}>{g.name}</AppText>
                        <View style={styles.amountPill}>
                          <AppText variant="label" color={colors.onBrandPrimary}>
                            {formatNaira(g.amount_kobo, { compact: true })}
                          </AppText>
                        </View>
                      </View>
                      {g.message ? (
                        <View style={styles.messageBubble}>
                          <AppText variant="body" color={colors.onSurfaceSecondary} style={{ lineHeight: 20 }}>
                            {g.message}
                          </AppText>
                        </View>
                      ) : null}
                      <AppText variant="caption" style={{ marginTop: spacing.xs }}>{timeAgo(g.paid_at)}</AppText>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.wallEmpty}>
                <Feather name="heart" size={32} color={colors.brandPrimary} style={{ opacity: 0.4 }} />
                <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: spacing.sm }}>
                  No gifts yet — yours could be the first! 💛
                </AppText>
              </View>
            )}
          </View>

          {/* Gift form — hidden for owner (they can't gift themselves) */}
          {!isOwner ? (
            <>
              <View style={styles.formDivider}>
                <View style={styles.dividerLine} />
                <AppText variant="caption" color={colors.muted} style={{ marginHorizontal: spacing.sm }}>Send a gift</AppText>
                <View style={styles.dividerLine} />
              </View>

              <AppText variant="h2" style={{ marginBottom: spacing.md }}>Choose an amount</AppText>
              <View style={styles.grid}>
                {presets.map((p) => (
                  <Pressable key={p} testID={`gift-amount-${p}`}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); setCustom(""); setAmount(p); }}
                    style={[styles.amountBtn, !custom && amount === p && styles.amountBtnActive]}>
                    <AppText variant="title" color={!custom && amount === p ? colors.onBrandPrimary : colors.onSurface}>
                      {formatNaira(p, { compact: true })}
                    </AppText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.customBox}>
                <AppText variant="label" color={colors.muted}>₦</AppText>
                <TextInput testID="gift-custom-amount"
                  value={custom ? formatAmountInput(custom) : ""}
                  onChangeText={(v) => setCustom(v.replace(/\D/g, ""))}
                  placeholder="Enter custom amount" placeholderTextColor={colors.muted}
                  keyboardType="number-pad" style={styles.customInput} />
              </View>

              <Pressable testID="gift-anonymous-toggle" onPress={() => setAnonymous((v) => !v)} style={styles.toggleRow}>
                <View style={[styles.checkbox, anonymous && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                  {anonymous ? <Feather name="check" size={14} color="#fff" /> : null}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <AppText variant="bodyMedium">Send anonymously</AppText>
                  <AppText variant="caption">{"Your name won't be shown publicly."}</AppText>
                </View>
              </Pressable>

              <TextInput testID="gift-message-input" value={message} onChangeText={setMessage}
                placeholder={`Leave a kind message for ${zone.user.name} (optional)`}
                placeholderTextColor={colors.muted} multiline style={styles.messageBox} />

              {error ? (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={14} color={colors.error} />
                  <AppText variant="caption" color={colors.error} style={{ marginLeft: 6, flex: 1 }}>{error}</AppText>
                </View>
              ) : null}
            </>
          ) : (
            /* Owner view — share prompt */
            <View style={styles.ownerShareBox}>
              <Feather name="share-2" size={20} color={colors.brandPrimary} />
              <AppText variant="bodyMedium" style={{ marginLeft: spacing.sm, flex: 1 }}>
                Share your Fan Zone link to start receiving gifts
              </AppText>
              <Pressable onPress={() => RNShare.share({ message: `Support my work on GoodCause 💛 ${fanZoneAppUrl(userId)}` }).catch(() => {})}
                style={styles.shareIconBtn}>
                <Feather name="share-2" size={18} color={colors.brandPrimary} />
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer CTA — only for non-owners */}
      {!isOwner ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Button title={`Send ${formatNaira(finalAmount || 0)} gift 💛`}
            onPress={sendGift} loading={processing} testID="send-gift-button" />
        </View>
      ) : null}
    </View>
  );
}

// ── Hero section component ─────────────────────────────────────────────────

function HeroProfile({
  zone,
  insets,
  isOwner,
  onEdit,
}: {
  zone: FanZone;
  insets: { top: number };
  isOwner: boolean;
  onEdit: () => void;
}) {
  return (
    <View style={{ marginBottom: AVATAR_OVERLAP + spacing.sm }}>
      {/* Cover banner */}
      <View style={[styles.cover, { height: COVER_HEIGHT }]}>
        {zone.cover_image ? (
          <Image source={{ uri: zone.cover_image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.coverPlaceholder]} />
        )}
        {/* Gradient overlay for back button legibility */}
        <View style={[StyleSheet.absoluteFill, styles.coverGradient]} />

        {/* Top bar inside cover */}
        <View style={[styles.coverTopBar, { paddingTop: insets.top + spacing.sm }]}>
          <View style={{ width: 40 }} />
          {isOwner ? (
            <Pressable onPress={onEdit} style={styles.editBtn} testID="fanzone-edit-btn">
              <Feather name="edit-2" size={16} color="#fff" />
              <AppText variant="caption" color="#fff" style={{ marginLeft: 4 }}>Edit</AppText>
            </Pressable>
          ) : (
            <View style={{ width: 64 }} />
          )}
        </View>
      </View>

      {/* Floating avatar + name — overlaps cover */}
      <View style={styles.heroBottom}>
        <View style={styles.avatarWrapper}>
          <Avatar name={zone.user.name} uri={zone.user.picture} size={AVATAR_SIZE} />
        </View>
        <AppText variant="h1" style={{ marginTop: spacing.sm, textAlign: "center" }}>
          {zone.headline}
        </AppText>
        {zone.user.bio ? (
          <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: spacing.xs }}>
            {zone.user.bio}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: colors.surface, width: "100%", maxWidth: 560, alignSelf: "center" },
  center: { justifyContent: "center", alignItems: "center", padding: spacing.xl },

  // Hero
  cover: { width: "100%", backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  coverPlaceholder: { backgroundColor: colors.brandPrimary, opacity: 0.15 },
  coverGradient: {
    // subtle bottom fade so avatar sits cleanly on top
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  coverTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  heroBottom: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: -AVATAR_OVERLAP,
  },
  avatarWrapper: {
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },

  // Body
  body: { paddingHorizontal: spacing.lg },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    overflow: "hidden",
  },
  stat: { flex: 1, alignItems: "center", paddingVertical: spacing.md },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },

  // Wall
  wallSection: { marginBottom: spacing.xs },
  supporterCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  supporterBody: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  supporterTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  amountPill: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  messageBubble: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  wallEmpty: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: "dashed",
  },

  // Divider
  formDivider: { flexDirection: "row", alignItems: "center", marginTop: spacing.xxl, marginBottom: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },

  // Gift form
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
  customInput: { flex: 1, marginLeft: spacing.sm, fontFamily: font.semibold, fontSize: 16, color: colors.onSurface },
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

  // Owner share nudge
  ownerShareBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  shareIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  // Success
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

  // iOS external
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
