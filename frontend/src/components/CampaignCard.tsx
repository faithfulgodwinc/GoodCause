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
  return CATEGORY_COLORS[(name || "").toLowerCase()] || colors.brandPrimary;
}

export function FeaturedCard({ c, onPress }: { c: Campaign; onPress: () => void }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width - spacing.lg * 2, 520);
  const dl = daysLeft(c.deadline);
  return (
    <Pressable testID={`featured-card-${c.id}`} onPress={onPress} style={({ pressed }) => [{ width: w }, pressed && { opacity: 0.95 }]}>
      <View style={styles.heroWrap}>
        <Image source={{ uri: c.cover_image }} placeholder={BLUR} style={styles.heroImg} contentFit="cover" transition={250} />
        <LinearGradient colors={["transparent", "rgba(35,33,31,0.35)", "rgba(35,33,31,0.92)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroTopRow}>
          <View style={[styles.catPill, { backgroundColor: catColor(c.category_name) }]}>
            <AppText variant="caption" color="#fff">{c.category_name}</AppText>
          </View>
          {c.urgent ? (
            <View style={[styles.catPill, { backgroundColor: colors.warning }]}>
              <Feather name="clock" size={11} color="#fff" />
              <AppText variant="caption" color="#fff" style={{ marginLeft: 4 }}>Urgent</AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.heroContent}>
          <AppText variant="h1" color="#fff" numberOfLines={2}>{c.title}</AppText>
          <View style={{ marginTop: spacing.md }}>
            <ProgressBar percent={c.percent} color="#fff" />
            <View style={styles.heroStatsRow}>
              <AppText variant="label" color="#fff">
                {formatNaira(c.raised_kobo, { compact: true })} of {formatNaira(c.goal_kobo, { compact: true })}
              </AppText>
              <AppText variant="label" color="rgba(255,255,255,0.85)">{c.percent}%</AppText>
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
    <Pressable testID={`campaign-card-${c.id}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}>
      <Image source={{ uri: c.cover_image }} placeholder={BLUR} style={styles.thumb} contentFit="cover" transition={200} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <View style={styles.rowBetween}>
          <View style={[styles.catDot, { backgroundColor: catColor(c.category_name) }]} />
          <AppText variant="caption" color={catColor(c.category_name)} style={{ flex: 1, marginLeft: 6 }}>
            {c.category_name}
          </AppText>
          <VerifiedBadge status={c.verification_status} />
        </View>
        <AppText variant="title" numberOfLines={2} style={{ marginTop: 4 }}>{c.title}</AppText>
        <View style={{ marginTop: spacing.sm }}>
          <ProgressBar percent={c.percent} />
          <View style={styles.rowBetween}>
            <AppText variant="label" style={{ marginTop: 6 }}>
              {formatNaira(c.raised_kobo, { compact: true })} raised
            </AppText>
            <AppText variant="caption" style={{ marginTop: 6 }}>
              {c.supporters_count} supporters{dl != null ? ` · ${dl}d left` : ""}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    height: 260, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceTertiary,
    ...shadow.card,
  },
  heroImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  heroTopRow: {
    position: "absolute", top: spacing.md, left: spacing.md, right: spacing.md,
    flexDirection: "row", justifyContent: "space-between",
  },
  catPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  heroContent: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  heroStatsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  heroMeta: { marginTop: 4 },
  card: {
    flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  thumb: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catDot: { width: 8, height: 8, borderRadius: 4 },
});
