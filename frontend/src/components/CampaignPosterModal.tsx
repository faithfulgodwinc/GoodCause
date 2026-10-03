import React, { useState } from "react";
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Feather, Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { Share as RNShare } from "react-native";
import * as Haptics from "expo-haptics";

import { AppText, Button, ProgressBar, VerifiedBadge } from "@/src/components/ui";
import { colors, radius, spacing, shadow } from "@/src/theme";
import { formatNaira } from "@/src/format";
import { Campaign } from "@/src/components/CampaignCard";

interface CampaignPosterModalProps {
  visible: boolean;
  onClose: () => void;
  campaign: Campaign;
  shareUrl: string;
}

type PosterTheme = "classic" | "story" | "dark";
type PosterCta = "Help Us Reach Our Goal!" | "Urgent Support Needed!" | "Every Donation Counts!";

export function CampaignPosterModal({
  visible,
  onClose,
  campaign: c,
  shareUrl,
}: CampaignPosterModalProps) {
  const [theme, setTheme] = useState<PosterTheme>("classic");
  const [ctaText, setCtaText] = useState<PosterCta>("Help Us Reach Our Goal!");
  const [copied, setCopied] = useState(false);

  if (!c) return null;

  const raised = c.raised_kobo || 0;
  const goal = c.goal_kobo || 1;
  const percent = c.percent ?? Math.min(100, Math.round((raised / goal) * 100));

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSharePoster = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const msg = `Help support “${c.title}” on GoodCause! 💛\n\nScan QR code or click link to donate:\n${shareUrl}`;
    try {
      await RNShare.share({ message: msg, url: shareUrl });
    } catch {}
  };

  const handlePrint = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.print();
    } else {
      Alert.alert("Print Poster", "Take a screenshot of this poster to print or share to Instagram/WhatsApp stories!");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetContainer}>
        <View style={styles.grabber} />

        <View style={styles.headerRow}>
          <View>
            <AppText variant="h2">Campaign Poster Studio</AppText>
            <AppText variant="caption">Create & share printable GoFundMe-style posters</AppText>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={20} color={colors.onSurface} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.lg }}
        >
          {/* Controls: Theme selector */}
          <View style={styles.controlsSection}>
            <AppText variant="label" style={{ marginBottom: 6 }}>Poster Theme</AppText>
            <View style={styles.themeRow}>
              {(["classic", "story", "dark"] as PosterTheme[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTheme(t)}
                  style={[
                    styles.themeChip,
                    theme === t && styles.themeChipActive,
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={{
                      textTransform: "capitalize",
                      fontWeight: "700",
                      color: theme === t ? "#FFFFFF" : colors.onSurface,
                    }}
                  >
                    {t === "classic" ? "📄 Classic Flyer" : t === "story" ? "📱 Story 9:16" : "🌙 Dark Banner"}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Controls: Headline CTA selector */}
          <View style={styles.controlsSection}>
            <AppText variant="label" style={{ marginBottom: 6 }}>Headline Banner</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(["Help Us Reach Our Goal!", "Urgent Support Needed!", "Every Donation Counts!"] as PosterCta[]).map((headline) => (
                <Pressable
                  key={headline}
                  onPress={() => setCtaText(headline)}
                  style={[
                    styles.ctaChip,
                    ctaText === headline && styles.ctaChipActive,
                  ]}
                >
                  <AppText variant="caption" style={{ fontSize: 12, fontWeight: "600" }}>{headline}</AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Poster Live Canvas Preview */}
          <View
            style={[
              styles.posterCanvas,
              theme === "story" && styles.posterCanvasStory,
              theme === "dark" && styles.posterCanvasDark,
            ]}
          >
            {/* Header Banner */}
            <View
              style={[
                styles.posterTopBanner,
                theme === "dark" && { backgroundColor: "#1E293B" },
              ]}
            >
              <View style={styles.brandRow}>
                <Ionicons name="heart-circle" size={24} color={colors.brandPrimary} />
                <AppText variant="label" style={{ color: theme === "dark" ? "#FFFFFF" : colors.onSurface, fontSize: 16, fontWeight: "800" }}>
                  GoodCause
                </AppText>
              </View>
              <View style={styles.headlineBadge}>
                <AppText variant="caption" style={styles.headlineBadgeText}>{ctaText}</AppText>
              </View>
            </View>

            {/* Campaign Image */}
            {c.cover_image ? (
              <View style={styles.posterImgWrap}>
                <Image
                  source={{ uri: c.cover_image }}
                  style={styles.posterImg}
                  contentFit="cover"
                />
              </View>
            ) : null}

            {/* Poster Info Body */}
            <View style={styles.posterBody}>
              <View style={styles.titleRow}>
                <AppText
                  variant="h2"
                  style={[
                    styles.posterTitle,
                    theme === "dark" && { color: "#FFFFFF" },
                  ]}
                  numberOfLines={2}
                >
                  {c.title}
                </AppText>
              </View>

              {/* Progress Section */}
              <View style={styles.posterProgressBlock}>
                <ProgressBar percent={percent} height={8} color={colors.brandPrimary} />
                <View style={styles.posterAmountRow}>
                  <AppText
                    style={[
                      styles.posterRaisedText,
                      theme === "dark" && { color: "#FFFFFF" },
                    ]}
                  >
                    {formatNaira(raised, { compact: true })}
                  </AppText>
                  <AppText
                    style={[
                      styles.posterGoalText,
                      theme === "dark" && { color: "rgba(255,255,255,0.7)" },
                    ]}
                  >
                    raised of {formatNaira(goal, { compact: true })} ({percent}%)
                  </AppText>
                </View>
              </View>

              {/* QR Code & Scan Block */}
              <View
                style={[
                  styles.qrBox,
                  theme === "dark" && { backgroundColor: "#0F172A", borderColor: "#334155" },
                ]}
              >
                <View style={styles.qrContainer}>
                  <QRCode
                    value={shareUrl}
                    size={90}
                    backgroundColor="transparent"
                    color={theme === "dark" ? "#FFFFFF" : "#000000"}
                  />
                </View>
                <View style={styles.qrTextWrap}>
                  <View style={styles.scanBadge}>
                    <Feather name="camera" size={12} color={colors.brandPrimary} />
                    <AppText variant="caption" style={{ color: colors.brandPrimary, fontWeight: "700", fontSize: 11 }}>
                      SCAN TO DONATE
                    </AppText>
                  </View>
                  <AppText
                    variant="body"
                    style={[
                      styles.qrSubtext,
                      theme === "dark" && { color: "rgba(255,255,255,0.8)" },
                    ]}
                  >
                    Point your camera or QR scanner to donate directly on GoodCause
                  </AppText>
                </View>
              </View>
            </View>

            {/* Poster Footer */}
            <View style={styles.posterFooter}>
              <AppText variant="caption" style={{ fontSize: 11, color: colors.onSurfaceTertiary }}>
                Verified fundraising powered by GoodCause · goodcause.app
              </AppText>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ gap: spacing.sm }}>
            <Button
              title="Share Poster & Link"
              icon="share-2"
              onPress={handleSharePoster}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button
                title={copied ? "Copied Link!" : "Copy Poster Link"}
                variant="outline"
                icon="copy"
                onPress={handleCopyLink}
                style={{ flex: 1 }}
              />
              <Button
                title="Print Poster"
                variant="outline"
                icon="printer"
                onPress={handlePrint}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: "92%",
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    ...shadow.card,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  controlsSection: {
    gap: 4,
  },
  themeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  themeChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeChipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  ctaChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaChipActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandTertiary,
  },
  posterCanvas: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow.card,
  },
  posterCanvasStory: {
    minHeight: 480,
  },
  posterCanvasDark: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
  },
  posterTopBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headlineBadge: {
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  headlineBadgeText: {
    color: colors.brandPrimary,
    fontWeight: "700",
    fontSize: 11,
  },
  posterImgWrap: {
    width: "100%",
    height: 180,
    backgroundColor: colors.surfaceSecondary,
  },
  posterImg: {
    width: "100%",
    height: "100%",
  },
  posterBody: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  titleRow: {},
  posterTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.onSurface,
  },
  posterProgressBlock: {
    gap: 6,
  },
  posterAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  posterRaisedText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
  },
  posterGoalText: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  qrBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  qrContainer: {
    backgroundColor: "#FFFFFF",
    padding: 6,
    borderRadius: radius.md,
  },
  qrTextWrap: {
    flex: 1,
    gap: 4,
  },
  scanBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  qrSubtext: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    lineHeight: 16,
  },
  posterFooter: {
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
});
