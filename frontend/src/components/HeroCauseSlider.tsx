import React, { useState, useRef } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Image } from "expo-image";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { AppText, ProgressBar } from "@/src/components/ui";
import { colors, radius, spacing, shadow } from "@/src/theme";
import { formatNaira } from "@/src/format";
import { Campaign } from "@/src/components/CampaignCard";
import { useResponsive } from "@/src/lib/responsive";

const BLUR = "L6PZfSjE.AyE_3t7t7R**0o#DgR4";

interface HeroCauseSliderProps {
  causes: Campaign[];
  onSelectCause: (campaignId: string) => void;
  onStartCampaign?: () => void;
}

export function HeroCauseSlider({ causes, onSelectCause, onStartCampaign }: HeroCauseSliderProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isDesktop, isTablet, maxContentWidth } = useResponsive();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Content width for card calculation
  const containerWidth = Math.min(width - spacing.lg * 2, maxContentWidth || 1160);
  const cardWidth = containerWidth;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (cardWidth + spacing.md));
    if (index !== activeIndex && index >= 0 && index < (causes.length || 1)) {
      setActiveIndex(index);
    }
  };

  // If no causes available, render fallback inspiration card
  if (!causes || causes.length === 0) {
    return (
      <View style={[styles.heroCard, { width: cardWidth }]}>
        <View style={styles.gradientOverlay} />
        <View style={styles.heroContent}>
          <View style={styles.badgeRow}>
            <View style={styles.featuredBadge}>
              <Ionicons name="sparkles" size={12} color="#FFFFFF" />
              <AppText variant="caption" style={styles.badgeText}>Start a Cause</AppText>
            </View>
          </View>
          <AppText variant="h1" style={styles.heroTitle}>
            Turn kindness into real community impact
          </AppText>
          <AppText variant="body" style={styles.heroDesc} numberOfLines={2}>
            Launch a verified campaign today to raise funds for medical bills, education, emergency relief, or community projects.
          </AppText>
          <Pressable
            style={styles.heroCtaBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (onStartCampaign) onStartCampaign();
              else router.push("/campaign/new");
            }}
          >
            <AppText variant="label" style={styles.heroCtaText}>Start Fundraising</AppText>
            <Feather name="arrow-right" size={16} color={colors.brandPrimary} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={cardWidth + spacing.md}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {causes.map((c, i) => {
          const raised = c.raised_kobo || 0;
          const goal = c.goal_kobo || 1;
          const percent = c.percent ?? Math.min(100, Math.round((raised / goal) * 100));

          return (
            <Pressable
              key={c.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectCause(c.id);
              }}
              style={({ pressed }) => [
                styles.heroCard,
                { width: cardWidth },
                pressed && { opacity: 0.96 },
              ]}
            >
              {c.cover_image ? (
                <Image
                  source={{ uri: c.cover_image }}
                  placeholder={BLUR}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  transition={300}
                />
              ) : null}

              {/* Dark Gradient Overlay for Readability */}
              <View style={styles.darkGradient} />

              <View style={styles.heroInnerContainer}>
                {/* Top Badge Row */}
                <View style={styles.badgeRow}>
                  <View style={styles.featuredBadge}>
                    <Ionicons name="flame" size={13} color="#FFD700" />
                    <AppText variant="caption" style={styles.badgeText}>
                      {c.urgent ? "Urgent Cause" : c.category_name || "Featured Cause"}
                    </AppText>
                  </View>

                  {c.supporters_count ? (
                    <View style={styles.supportersPill}>
                      <Feather name="heart" size={12} color="#FFFFFF" />
                      <AppText variant="caption" style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 12 }}>
                        {c.supporters_count} supporters
                      </AppText>
                    </View>
                  ) : null}
                </View>

                {/* Middle Content */}
                <View style={styles.middleSection}>
                  <AppText variant="h1" style={styles.causeTitle} numberOfLines={2}>
                    {c.title}
                  </AppText>
                  {c.summary ? (
                    <AppText variant="body" style={styles.causeSummary} numberOfLines={2}>
                      {c.summary}
                    </AppText>
                  ) : null}
                </View>

                {/* Bottom Funding Progress & CTA Row */}
                <View style={styles.bottomSection}>
                  <View style={styles.progressBlock}>
                    <View style={styles.amountRow}>
                      <AppText style={styles.raisedAmount}>
                        {formatNaira(raised, { compact: true })}
                      </AppText>
                      <AppText style={styles.goalAmount}>
                        raised of {formatNaira(goal, { compact: true })} ({percent}%)
                      </AppText>
                    </View>
                    <ProgressBar percent={percent} color="#22C55E" height={6} />
                  </View>

                  <View style={styles.ctaRow}>
                    <Pressable
                      style={styles.viewBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onSelectCause(c.id);
                      }}
                    >
                      <AppText variant="label" style={styles.viewBtnText}>View Cause</AppText>
                      <Feather name="arrow-right" size={16} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Pagination Dots */}
      {causes.length > 1 && (
        <View style={styles.dotsRow}>
          {causes.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  scrollContent: {
    gap: spacing.md,
  },
  heroCard: {
    height: 260,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: "#1E293B",
    position: "relative",
    ...shadow.card,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brandPrimary,
    opacity: 0.9,
  },
  darkGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
  },
  heroContent: {
    padding: spacing.xl,
    flex: 1,
    justifyContent: "center",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  heroDesc: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  heroCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    gap: 8,
  },
  heroCtaText: {
    color: colors.brandPrimary,
    fontWeight: "700",
  },
  heroInnerContainer: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    gap: 6,
    backdropFilter: "blur(10px)" as any,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  supportersPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    gap: 6,
  },
  middleSection: {
    marginTop: spacing.xs,
  },
  causeTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  causeSummary: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  bottomSection: {
    gap: spacing.sm,
  },
  progressBlock: {
    gap: 4,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  raisedAmount: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  goalAmount: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
  },
  ctaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    gap: 6,
    ...shadow.card,
  },
  viewBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.brandPrimary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: colors.border,
  },
});
