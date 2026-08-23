import React from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
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
  const cardWidth = Math.min(width - spacing.lg * 2, 310);
  const dl = daysLeft(c.deadline);

  return (
    <Pressable
      testID={`featured-card-${c.id}`}
      onPress={onPress}
      style={({ pressed }) => [{ width: cardWidth }, pressed && { opacity: 0.95 }]}
    >
      <View style={styles.featuredCard}>
        <View style={styles.featuredImgWrap}>
          <Image
            source={{ uri: c.cover_image }}
            placeholder={BLUR}
            style={styles.featuredImg}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.featuredTopRow}>
            <View style={styles.catPill}>
              <AppText variant="caption" color={colors.onSurface} style={{ fontWeight: "600", fontSize: 11 }}>
                {c.category_name}
              </AppText>
            </View>
            {c.urgent ? (
              <View style={[styles.catPill, { backgroundColor: colors.warning }]}>
                <Feather name="clock" size={10} color="#fff" />
                <AppText variant="caption" color="#fff" style={{ marginLeft: 3, fontWeight: "600", fontSize: 11 }}>
                  Urgent
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.featuredBody}>
          <AppText variant="title" numberOfLines={2} style={styles.featuredTitle}>
            {c.title}
          </AppText>

          <View style={{ marginTop: spacing.sm }}>
            <ProgressBar percent={c.percent} color={colors.brandPrimary} height={5} />
            <View style={styles.statsRow}>
              <AppText variant="label" style={{ fontSize: 13, fontWeight: "700", color: colors.onSurface }}>
                {formatNaira(c.raised_kobo, { compact: true })}{" "}
                <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ fontWeight: "400" }}>
                  raised of {formatNaira(c.goal_kobo, { compact: true })}
                </AppText>
              </AppText>
              <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ fontSize: 11.5 }}>
                {c.supporters_count} donations
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
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
    >
      <Image
        source={{ uri: c.cover_image }}
        placeholder={BLUR}
        style={styles.thumb}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.cardContent}>
        <View>
          <View style={styles.rowBetween}>
            <View style={styles.catRow}>
              <AppText variant="caption" color={catColor(c.category_name)} style={{ fontWeight: "600", fontSize: 11 }}>
                {c.category_name?.toUpperCase()}
              </AppText>
            </View>
            <VerifiedBadge status={c.verification_status} />
          </View>
          <AppText variant="title" numberOfLines={2} style={styles.cardTitle}>
            {c.title}
          </AppText>
        </View>

        <View style={{ marginTop: spacing.xs }}>
          <ProgressBar percent={c.percent} color={colors.brandPrimary} height={4.5} />
          <View style={styles.cardStatsRow}>
            <AppText variant="label" style={{ fontSize: 13, fontWeight: "700", color: colors.onSurface }}>
              {formatNaira(c.raised_kobo, { compact: true })}{" "}
              <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ fontWeight: "400", fontSize: 11 }}>
                raised
              </AppText>
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceTertiary} style={{ fontSize: 11 }}>
              {c.supporters_count} donations{dl != null ? ` · ${dl}d left` : ""}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  featuredCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  featuredImgWrap: {
    height: 155,
    position: "relative",
    backgroundColor: colors.surfaceTertiary,
  },
  featuredImg: {
    width: "100%",
    height: "100%",
  },
  featuredTopRow: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    ...shadow.soft,
  },
  featuredBody: {
    padding: spacing.md,
  },
  featuredTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    color: colors.onSurface,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 96,
    ...shadow.soft,
  },
  thumb: {
    width: 86,
    height: 86,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
  },
  cardContent: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: "space-between",
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 2,
    color: colors.onSurface,
  },
  cardStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
