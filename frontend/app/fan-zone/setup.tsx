import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Share as RNShare,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";

import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/auth";
import { AppText, Button, Avatar, Card } from "@/src/components/ui";
import { colors, spacing, radius, font } from "@/src/theme";
import { formatNaira } from "@/src/format";

type MyFanZone = {
  enabled: boolean;
  headline: string | null;
  thank_you_message: string | null;
  total_received_kobo: number;
  supporters_count: number;
  recent_gifts: Array<{
    id: string;
    amount_kobo: number;
    name: string;
    message: string;
    paid_at: string;
    anonymous: boolean;
    is_test: boolean;
  }>;
};

export default function FanZoneSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [enabled, setEnabled] = useState(true);
  const [headline, setHeadline] = useState("");
  const [thankYouMsg, setThankYouMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  // Track whether this is the very first save (so we navigate to preview after)
  const [isNew, setIsNew] = useState(false);

  const { data: zone, isLoading } = useQuery<MyFanZone>({
    queryKey: ["my-fan-zone"],
    queryFn: () => api("/users/me/fan-zone"),
  });

  // Once loaded, decide if this is a brand-new setup
  useEffect(() => {
    if (zone !== undefined) {
      // zone.enabled === false AND no headline means never customised — treat as new
      const neverSetUp = !zone.enabled && !zone.headline;
      setIsNew(neverSetUp);
    }
  }, [zone]);

  // Seed form from server state once loaded
  useEffect(() => {
    if (zone && !dirty) {
      setEnabled(zone.enabled ?? true);
      setHeadline(zone.headline ?? "");
      setThankYouMsg(zone.thank_you_message ?? "");
    }
  }, [zone]);

  const saveMut = useMutation({
    mutationFn: () =>
      api("/users/me/fan-zone", {
        method: "POST",
        body: {
          enabled: true,   // always enable on create/save
          headline: headline.trim() || null,
          thank_you_message: thankYouMsg.trim() || null,
        },
      }),
    onSuccess: () => {
      setDirty(false);
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["my-fan-zone"] });
      // After creating for the first time, navigate straight to the public preview
      if (isNew && user) {
        router.replace({
          pathname: "/fan-zone/[userId]",
          params: { userId: user.id },
        } as any);
      } else {
        setTimeout(() => setSaved(false), 3000);
      }
    },
  });

  /**
   * Social share URL — the /share/fan-zone/ endpoint returns a server-rendered
   * page with full OG + Twitter card meta tags (picture, headline, supporter count)
   * so WhatsApp, iMessage, Telegram and Twitter all show a rich link preview.
   */
  const shareUrl = user ? `https://www.goodcause.app/share/fan-zone/${user.id}` : "";

  const copyLink = async () => {
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    RNShare.share({
      message: `Support my work on GoodCause — send a small gift 💛 ${shareUrl}`,
    }).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="fanzone-setup-back">
          <Feather name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <AppText variant="title">My Fan Zone</AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Explainer */}
        <View style={styles.explainerCard}>
          <Feather name="coffee" size={28} color={colors.brandPrimary} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <AppText variant="title">Your personal gifting page</AppText>
            <AppText variant="caption" style={{ marginTop: 4, lineHeight: 18 }}>
              Let supporters send you small voluntary gifts — no goal, no deadline. Share the link on social media or add it to your bio.
            </AppText>
          </View>
        </View>

        {/* Stats */}
        {zone && (zone.supporters_count > 0 || zone.total_received_kobo > 0) ? (
          <Card style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <AppText variant="h1" color={colors.brandPrimary}>{zone.supporters_count}</AppText>
                <AppText variant="caption">supporters</AppText>
              </View>
              <View style={[styles.statItem, styles.statBorder]}>
                <AppText variant="h1" color={colors.brandPrimary}>
                  {formatNaira(zone.total_received_kobo, { compact: true })}
                </AppText>
                <AppText variant="caption">total received</AppText>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Enable/Disable */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium">Fan Zone active</AppText>
              <AppText variant="caption" style={{ marginTop: 2 }}>
                When off, your gifting page will be hidden from visitors.
              </AppText>
            </View>
            <Switch
              testID="fanzone-enabled-toggle"
              value={enabled}
              onValueChange={(v) => { setEnabled(v); setDirty(true); }}
              trackColor={{ false: colors.border, true: colors.brandPrimary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Headline */}
        <View style={styles.section}>
          <AppText variant="label" style={styles.fieldLabel}>Headline</AppText>
          <AppText variant="caption" style={styles.fieldHint}>
            Shown at the top of your gifting page.
          </AppText>
          <TextInput
            testID="fanzone-headline-input"
            value={headline}
            onChangeText={(v) => { setHeadline(v); setDirty(true); }}
            placeholder={`Support ${user?.name || "my work"}`}
            placeholderTextColor={colors.muted}
            maxLength={160}
            style={styles.input}
          />
          <AppText variant="caption" style={styles.charCount}>{headline.length}/160</AppText>
        </View>

        {/* Thank-you message */}
        <View style={styles.section}>
          <AppText variant="label" style={styles.fieldLabel}>Thank-you message</AppText>
          <AppText variant="caption" style={styles.fieldHint}>
            Shown to your supporter after they send a gift.
          </AppText>
          <TextInput
            testID="fanzone-thankyou-input"
            value={thankYouMsg}
            onChangeText={(v) => { setThankYouMsg(v); setDirty(true); }}
            placeholder="Your support means the world — thank you! 💛"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
          />
          <AppText variant="caption" style={styles.charCount}>{thankYouMsg.length}/500</AppText>
        </View>

        {/* Share link — always visible once logged in */}
        {user ? (
          <View style={styles.section}>
            <AppText variant="label" style={styles.fieldLabel}>Your Fan Zone link</AppText>
            <AppText variant="caption" style={styles.fieldHint}>
              Share this link on social media, WhatsApp status, or your bio so people can send you gifts.
            </AppText>
            <View style={styles.linkBox}>
              <AppText variant="caption" color={colors.brandPrimary} style={{ flex: 1 }} numberOfLines={1}>
                {shareUrl}
              </AppText>
              <Pressable onPress={copyLink} style={styles.linkAction} testID="fanzone-copy-link">
                <Feather name={copied ? "check" : "copy"} size={16} color={copied ? colors.success : colors.onSurface} />
              </Pressable>
            </View>
            <Button
              title="Share link"
              icon="share-2"
              variant="outline"
              onPress={shareLink}
              style={{ marginTop: spacing.md }}
              testID="fanzone-share-button"
            />
            <Button
              title="Preview as supporter"
              icon="eye"
              variant="ghost"
              onPress={() => router.push({ pathname: "/fan-zone/[userId]", params: { userId: user.id } } as any)}
              style={{ marginTop: spacing.xs }}
              testID="fanzone-preview-button"
            />
          </View>
        ) : null}

        {/* Recent gifts */}
        {zone?.recent_gifts && zone.recent_gifts.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="h2" style={{ marginBottom: spacing.md }}>Recent gifts</AppText>
            <View style={{ gap: spacing.sm }}>
              {zone.recent_gifts.slice(0, 10).map((g) => (
                <View key={g.id} style={styles.giftRow}>
                  <Avatar name={g.anonymous ? "A" : g.name} size={32} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                      <AppText variant="label">{g.name}</AppText>
                      {g.is_test ? (
                        <View style={styles.testPill}>
                          <AppText variant="caption" color={colors.warning}>test</AppText>
                        </View>
                      ) : null}
                    </View>
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

      {/* Save footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {saved ? (
          <View style={styles.savedBanner}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <AppText variant="label" color={colors.success} style={{ marginLeft: spacing.sm }}>
              Changes saved!
            </AppText>
          </View>
        ) : null}
        <Button
          title={isNew ? "Create Fan Zone" : "Save changes"}
          icon={isNew ? "coffee" : "check"}
          onPress={() => saveMut.mutate()}
          loading={saveMut.isPending}
          testID="fanzone-save-button"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  explainerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginBottom: spacing.xl,
  },
  statsCard: {
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
  },
  statItem: { flex: 1, alignItems: "center" },
  statBorder: { borderLeftWidth: 1, borderLeftColor: colors.border },
  section: {
    marginBottom: spacing.xl,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  fieldLabel: { marginBottom: spacing.xs },
  fieldHint: { marginBottom: spacing.sm, lineHeight: 17 },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.onSurface,
  },
  charCount: { marginTop: spacing.xs, textAlign: "right" },
  linkBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  linkAction: { padding: spacing.xs },
  giftRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  testPill: {
    backgroundColor: colors.accentTint,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  savedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
});
