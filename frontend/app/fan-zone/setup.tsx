import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Share as RNShare,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

import { api, uploadMedia } from "@/src/lib/api";
import { useAuth } from "@/src/context/auth";
import { AppText, Button, Avatar, Card } from "@/src/components/ui";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { formatNaira } from "@/src/format";

const COVER_HEIGHT = 180;
const AVATAR_SIZE = 80;
const AVATAR_OVERLAP = AVATAR_SIZE / 2;

type MyFanZone = {
  enabled: boolean;
  headline: string | null;
  thank_you_message: string | null;
  cover_image: string | null;
  profile_picture: string | null;
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

async function pickAndUpload(
  aspect: [number, number],
  onStart: () => void,
  onDone: (url: string) => void,
  onError: (e: string) => void,
) {
  onStart();
  try {
    let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) {
      perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (!perm.granted) { onError("Photo access denied. Enable it in Settings."); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      aspect,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.length) { onError(""); return; }

    const asset = result.assets[0];
    const manip = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: aspect[0] > aspect[1] ? 1200 : 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    ).catch(() => ({ uri: asset.uri }));

    const uploaded = await uploadMedia(manip.uri, "photo.jpg", "image/jpeg");
    onDone(uploaded.url);
  } catch (e: any) {
    onError(e?.message || "Upload failed. Please try again.");
  }
}

export default function FanZoneSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [thankYouMsg, setThankYouMsg] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const { data: zone, isLoading } = useQuery<MyFanZone>({
    queryKey: ["my-fan-zone"],
    queryFn: () => api("/users/me/fan-zone"),
  });

  useEffect(() => {
    if (zone !== undefined && !dirty) {
      const neverSetUp = !zone.enabled && !zone.headline && !zone.cover_image;
      setIsNew(neverSetUp);
      setEnabled(zone.enabled ?? true);
      setHeadline(zone.headline ?? "");
      setThankYouMsg(zone.thank_you_message ?? "");
      setCoverImage(zone.cover_image ?? null);
      setProfilePicture(zone.profile_picture ?? null);
    }
  }, [zone]);

  const saveMut = useMutation({
    mutationFn: () =>
      api("/users/me/fan-zone", {
        method: "POST",
        body: {
          enabled: true,
          headline: headline.trim() || null,
          thank_you_message: thankYouMsg.trim() || null,
          cover_image: coverImage || null,
          profile_picture: profilePicture || null,
        },
      }),
    onSuccess: () => {
      setDirty(false);
      setIsNew(false);
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["my-fan-zone"] });
      qc.invalidateQueries({ queryKey: ["fan-zone", user?.id] });
      // Navigate to the fan zone view — the owner will preview it there
      if (user) {
        router.replace({
          pathname: "/fan-zone/[userId]",
          params: { userId: user.id },
        } as any);
      }
    },
  });

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

  const pickCover = () =>
    pickAndUpload(
      [16, 9],
      () => { setUploadingCover(true); setUploadError(""); },
      (url) => { setCoverImage(url); setDirty(true); setUploadingCover(false); },
      (e) => { if (e) setUploadError(e); setUploadingCover(false); },
    );

  const pickAvatar = () =>
    pickAndUpload(
      [1, 1],
      () => { setUploadingAvatar(true); setUploadError(""); },
      (url) => { setProfilePicture(url); setDirty(true); setUploadingAvatar(false); },
      (e) => { if (e) setUploadError(e); setUploadingAvatar(false); },
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="fanzone-setup-back">
          <Feather name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <AppText variant="title">{isNew ? "Create Fan Zone" : "Edit Fan Zone"}</AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cover image + floating avatar ── */}
        <View style={{ marginBottom: AVATAR_OVERLAP + spacing.xl }}>
          {/* Cover banner */}
          <Pressable onPress={pickCover} style={[styles.coverSlot, { height: COVER_HEIGHT }]} testID="fanzone-cover-pick">
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.coverEmpty]}>
                <Feather name="image" size={28} color={colors.muted} />
                <AppText variant="caption" color={colors.muted} style={{ marginTop: spacing.xs }}>
                  Tap to add cover photo
                </AppText>
              </View>
            )}
            {uploadingCover ? (
              <View style={[StyleSheet.absoluteFill, styles.uploadOverlay]}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <View style={styles.coverEditChip}>
                <Feather name="camera" size={13} color="#fff" />
                <AppText variant="caption" color="#fff" style={{ marginLeft: 4 }}>
                  {coverImage ? "Change cover" : "Add cover"}
                </AppText>
              </View>
            )}
          </Pressable>

          {/* Floating avatar */}
          <View style={styles.avatarArea}>
            <Pressable onPress={pickAvatar} style={styles.avatarSlot} testID="fanzone-avatar-pick">
              {profilePicture ? (
                <Image source={{ uri: profilePicture }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <Avatar name={user?.name} uri={user?.picture} size={AVATAR_SIZE} />
              )}
              {uploadingAvatar ? (
                <View style={[StyleSheet.absoluteFill, styles.avatarOverlay]}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              ) : (
                <View style={styles.avatarCameraChip}>
                  <Feather name="camera" size={12} color="#fff" />
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {uploadError ? (
          <View style={[styles.errorBox, { marginHorizontal: spacing.lg, marginBottom: spacing.md }]}>
            <Feather name="alert-circle" size={14} color={colors.error} />
            <AppText variant="caption" color={colors.error} style={{ marginLeft: 6, flex: 1 }}>{uploadError}</AppText>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg }}>
          {/* Stats — only shown if fan zone exists and has data */}
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

          {/* Headline */}
          <View style={styles.section}>
            <AppText variant="label" style={styles.fieldLabel}>Headline</AppText>
            <AppText variant="caption" style={styles.fieldHint}>
              The main title on your gifting page.
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
              Shown to your supporter right after they send a gift.
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

          {/* Share link */}
          {user ? (
            <View style={styles.section}>
              <AppText variant="label" style={styles.fieldLabel}>Your Fan Zone link</AppText>
              <AppText variant="caption" style={styles.fieldHint}>
                Share this on social media, WhatsApp status, or your bio.
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

          {/* Active toggle — last on page */}
          <View style={[styles.section, { marginTop: spacing.xl }]}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium">Fan Zone active</AppText>
                <AppText variant="caption" style={{ marginTop: 2 }}>
                  When off, your gifting page is hidden from visitors.
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
        </View>
      </ScrollView>

      {/* Save footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {saved && !saveMut.isPending ? (
          <View style={styles.savedBanner}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <AppText variant="label" color={colors.success} style={{ marginLeft: spacing.sm }}>
              Saved — opening your Fan Zone…
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

  // Cover + avatar hero
  coverSlot: {
    width: "100%",
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  coverEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  uploadOverlay: {
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverEditChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  avatarArea: {
    alignItems: "center",
    marginTop: -AVATAR_OVERLAP,
  },
  avatarSlot: {
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadow.card,
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarOverlay: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: (AVATAR_SIZE + 6) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCameraChip: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBEBEB",
    padding: spacing.md,
    borderRadius: radius.md,
  },

  statsCard: { padding: spacing.xl, marginBottom: spacing.xl },
  statsRow: { flexDirection: "row" },
  statItem: { flex: 1, alignItems: "center" },
  statBorder: { borderLeftWidth: 1, borderLeftColor: colors.border },

  section: { marginBottom: spacing.xl },
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
