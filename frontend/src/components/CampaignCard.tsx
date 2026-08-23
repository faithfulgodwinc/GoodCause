import React from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { colors, radius, spacing, shadow, CATEGORY_COLORS } from "@/src/theme";
import { AppText, ProgressBar, VerifiedBadge } from "@/src/components/ui";
import { formatNaira, daysLeft } from "@/src/format";

export type Campaign = {
  id: string;
  title: string;
  summary?: string;
  category_name?: string;
  category_id?: string;
  cover_image?: string;
  goal_kobo: number;
  raised_kobo: number;
  percent: number;
  supporters_count: number;
  verification_status?: string;
  urgent?: boolean;
  deadline?: string | null;
  location?: { city?: string; country?: string } | null;
};

const BLUR = "L6PZfSjE.AyE_3t7t7R**0o#DgR4";

function catColor(name?: string) {
  return CATEGORY_COLORS[(name || "").toLowerCase()] || colors.coral;
}

export function FeaturedCard({ c, onPress }: { c: Campaign; onPress: () => void }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width - spacing.lg * 2, 520);
  const dl = daysLeft(c.deadline);

  return (
    <Pressable
      testID={`featured-card-${c.id}`}
      onPress={onPress}
      style={({ pressed }) => [{ width: w }, pressed && { opacity: 0.96 }]}
    >
      <View style={styles.heroWrap}>
        <Image
          source={{ uri: c.cover_image }}
          placeholder={BLUR}
          style={styles.heroImg}
          contentFit="cover"
          transition={250}
        />
        <LinearGradient
          colors={["rgba(15,23,42,0.15)", "rgba(15,23,42,0.45)", "rgba(15,23,42,0.92)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroTopRow}>
          <View style={[styles.catPill, { backgroundColor: "rgba(255,255,255,0.92)" }]}>
            <View style={[styles.catDot, { backgroundColor: catColor(c.category_name) }]} />
            <AppText variant="caption" color={colors.onSurface} style={{ marginLeft: 6, fontFamily: "Inter-SemiBold" }}>
              {c.category_name}
            </AppText>
          </View>
          {c.urgent ? (
            <View style={[styles.catPill, { backgroundColor: colors.coral }]}>
              <Feather name="clock" size={11} color="#fff" />
              <AppText variant="caption" color="#fff" style={{ marginLeft: 4, fontFamily: "Inter-Bold" }}>
                Urgent
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.heroContent}>
          <AppText variant="h1" color="#fff" numberOfLines={2} style={styles.heroTitle}>
            {c.title}
          </AppText>
          <View style={{ marginTop: spacing.md }}>
            <ProgressBar percent={c.percent} color="#FFFFFF" />
            <View style={styles.heroStatsRow}>
              <AppText variant="label" color="#fff" style={{ fontFamily: "Inter-SemiBold" }}>
                {formatNaira(c.raised_kobo, { compact: true })} raised of {formatNaira(c.goal_kobo, { compact: true })}
              </AppText>
              <View style={styles.percentBadge}>
                <AppText variant="caption" color="#fff" style={{ fontFamily: "Inter-Bold" }}>
                  {c.percent}%
                </AppText>
              </View>
            </View>
            <View style={styles.heroMeta}>
              <AppText variant="caption" color="rgba(255,255,255,0.85)">
                {c.supporters_count} supporters{dl != null ? `  ·  ${dl} days left` : ""}
              </AppText>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function CampaignCard({ c, onPress }: { c: Campaign; onPress: () => void }) {
  const dl = daysLeft(c.deadline);

  return (
    <Pressable
      testID={`campaign-card-${c.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] }]}
    >
      <View style={styles.thumbWrap}>
        <Image
          source={{ uri: c.cover_image }}
          placeholder={BLUR}
          style={styles.thumb}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.thumbPercentPill}>
          <AppText variant="caption" color="#fff" style={{ fontSize: 10, fontFamily: "Inter-Bold" }}>
            {c.percent}%
          </AppText>
        </View>
      </View>

      <View style={{ flex: 1, marginLeft: spacing.md, justifyContent: "space-between" }}>
        <View>
          <View style={styles.rowBetween}>
            <View style={styles.catLabelRow}>
              <View style={[styles.catDot, { backgroundColor: catColor(c.category_name) }]} />
              <AppText variant="caption" color={colors.onSurfaceTertiary} style={{ marginLeft: 5 }}>
                {c.category_name}
              </AppText>
            </View>
            <VerifiedBadge status={c.verification_status} />
          </View>
          <AppText variant="title" numberOfLines={2} style={styles.cardTitle}>
            {c.title}
          </AppText>
        </View>

        <View style={{ marginTop: spacing.sm }}>
          <ProgressBar percent={c.percent} />
          <View style={styles.cardFooterRow}>
            <View>
              <AppText variant="label" style={{ fontSize: 14, color: colors.onSurface }}>
                {formatNaira(c.raised_kobo, { compact: true })}
              </AppText>
              <AppText variant="caption" color={colors.onSurfaceTertiary} style={{ fontSize: 11 }}>
                goal: {formatNaira(c.goal_kobo, { compact: true })}
              </AppText>
            </View>

            <View style={styles.giveMiniBtn}>
              <AppText variant="caption" color="#fff" style={{ fontFamily: "Inter-Bold" }}>
                Give
              </AppText>
              <Feather name="arrow-up-right" size={12} color="#fff" style={{ marginLeft: 2 }} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    height: 270,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
    ...shadow.card,
  },
  heroImg: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroTopRow: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    ...shadow.soft,
  },
  heroContent: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  heroTitle: {
    fontSize: 22,
    letterSpacing: -0.3,
  },
  heroStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  percentBadge: {
    backgroundColor: colors.coral,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  heroMeta: {
    marginTop: 4,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 120,
    ...shadow.card,
  },
  thumbWrap: {
    position: "relative",
    width: 100,
    height: 100,
  },
  thumb: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
  },
  thumbPercentPill: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  catLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
    marginTop: 4,
    color: colors.onSurface,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 6,
  },
  giveMiniBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.coral,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    ...shadow.soft,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  catDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});

