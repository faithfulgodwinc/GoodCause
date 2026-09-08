import React, { useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { AppText, BrandLogo } from "@/src/components/ui";
import { colors, spacing, radius, font } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const { width: SCREEN_W } = Dimensions.get("window");

const ONBOARDING_DONE_KEY = "gc_onboarding_done";

// ─── Slide data ───────────────────────────────────────────────────────────────

type Slide = {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  accent: string;
  tag: string;
  title: string;
  subtitle: string;
  isLast?: boolean;
};

const SLIDES: Slide[] = [
  {
    id: "welcome",
    icon: "heart",
    iconBg: "rgba(192, 92, 61, 0.12)",
    accent: colors.brandPrimary,
    tag: "Welcome to GoodCause",
    title: "Fundraise for\nwhat matters",
    subtitle:
      "Create campaigns for causes close to your heart — from medical care and education to community projects. Every cause counts.",
  },
  {
    id: "trust",
    icon: "shield",
    iconBg: "rgba(45, 122, 93, 0.12)",
    accent: "#2D7A5D",
    tag: "Built on trust",
    title: "Every cause\nis verified",
    subtitle:
      "We verify organizer identity and fund usage so donors give with confidence. Transparency is at the core of everything we do.",
  },
  {
    id: "impact",
    icon: "bar-chart-2",
    iconBg: "rgba(74, 110, 130, 0.12)",
    accent: "#4A6E82",
    tag: "Real-time insights",
    title: "See your impact\nin real time",
    subtitle:
      "Track donations, donor reach, and growth with live analytics. Know exactly how your campaign is performing at every moment.",
  },
  {
    id: "pro",
    icon: "star",
    iconBg: "rgba(192, 92, 61, 0.15)",
    accent: colors.brandPrimary,
    tag: "GoodCause Pro",
    title: "Unlock powerful\nfundraising tools",
    subtitle:
      "Run multiple campaigns, access AI-assisted storytelling, advanced analytics, and QR kits — all with a Pro membership.",
    isLast: true,
  },
];

// ─── Individual slide ─────────────────────────────────────────────────────────

function OnboardingSlide({
  slide,
  index,
  scrollX,
}: {
  slide: Slide;
  index: number;
  scrollX: Animated.Value;
}) {
  const inputRange = [
    (index - 1) * SCREEN_W,
    index * SCREEN_W,
    (index + 1) * SCREEN_W,
  ];

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });

  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [32, 0, 32],
    extrapolate: "clamp",
  });

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.85, 1, 0.85],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.slide, { width: SCREEN_W }]}>
      <Animated.View style={[styles.slideContent, { opacity, transform: [{ translateY }, { scale }] }]}>
        {/* Decorative blobs */}
        <View
          style={[
            styles.blob1,
            { backgroundColor: slide.iconBg, borderColor: slide.accent + "22" },
          ]}
        />
        <View
          style={[
            styles.blob2,
            { backgroundColor: slide.iconBg },
          ]}
        />

        {/* Icon container */}
        <View style={[styles.iconRing, { backgroundColor: slide.iconBg, borderColor: slide.accent + "33" }]}>
          <View style={[styles.iconInner, { backgroundColor: slide.accent + "18" }]}>
            <Feather name={slide.icon} size={36} color={slide.accent} />
          </View>
        </View>

        {/* Tag */}
        <View style={[styles.tag, { backgroundColor: slide.accent + "14", borderColor: slide.accent + "30" }]}>
          <AppText
            variant="caption"
            style={{ color: slide.accent, fontFamily: font.semibold, fontSize: 11, letterSpacing: 0.6 }}
          >
            {slide.tag.toUpperCase()}
          </AppText>
        </View>

        {/* Title */}
        <AppText variant="display" style={styles.title}>
          {slide.title}
        </AppText>

        {/* Subtitle */}
        <AppText variant="body" style={styles.subtitle}>
          {slide.subtitle}
        </AppText>

        {/* Pro feature pills (last slide only) */}
        {slide.isLast && (
          <View style={styles.pills}>
            {["AI Assistant", "Analytics", "QR Kit", "Multi-campaign"].map((pill) => (
              <View key={pill} style={styles.pill}>
                <Feather name="check" size={11} color={colors.brandPrimary} style={{ marginRight: 4 }} />
                <AppText variant="caption" style={{ color: colors.brandPrimary, fontFamily: font.semibold, fontSize: 11 }}>
                  {pill}
                </AppText>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Dot indicator ────────────────────────────────────────────────────────────

function Dots({ count, scrollX }: { count: number; scrollX: Animated.Value }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => {
        const inputRange = [(i - 1) * SCREEN_W, i * SCREEN_W, (i + 1) * SCREEN_W];
        const width = scrollX.interpolate({
          inputRange,
          outputRange: [6, 22, 6],
          extrapolate: "clamp",
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: "clamp",
        });
        return (
          <Animated.View
            key={i}
            style={[styles.dot, { width, opacity }]}
          />
        );
      })}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);

  const markDone = useCallback(async () => {
    await storage.setItem(ONBOARDING_DONE_KEY, true);
  }, []);

  const skipToTabs = useCallback(async () => {
    await markDone();
    router.replace("/");
  }, [markDone, router]);

  const goToPaywall = useCallback(async () => {
    await markDone();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.replace("/");
    // Small delay to ensure root mounts before pushing modal
    setTimeout(() => {
      router.push("/paywall");
    }, 200);
  }, [markDone, router]);

  const goNext = useCallback(() => {
    const next = activeIndex + 1;
    if (next < SLIDES.length) {
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      Haptics.selectionAsync().catch(() => {});
    }
  }, [activeIndex]);

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <BrandLogo size={20} />
        <Pressable
          onPress={skipToTabs}
          hitSlop={12}
          style={styles.skipBtn}
          testID="onboarding-skip"
        >
          <AppText variant="label" color={colors.onSurfaceSecondary}>
            Skip
          </AppText>
        </Pressable>
      </View>

      {/* Slides */}
      <Animated.FlatList
        ref={flatRef as any}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setActiveIndex(idx);
        }}
        renderItem={({ item, index }) => (
          <OnboardingSlide slide={item} index={index} scrollX={scrollX} />
        )}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
      />

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
        <Dots count={SLIDES.length} scrollX={scrollX} />

        {isLast ? (
          <View style={styles.lastActions}>
            <Pressable
              onPress={goToPaywall}
              style={styles.primaryBtn}
              testID="onboarding-explore-pro"
            >
              <Feather name="star" size={16} color="#fff" style={{ marginRight: spacing.sm }} />
              <AppText variant="button" color="#fff" style={{ fontSize: 15, fontFamily: font.semibold }}>
                Explore Pro
              </AppText>
            </Pressable>
            <Pressable onPress={skipToTabs} style={styles.ghostBtn} testID="onboarding-maybe-later">
              <AppText variant="label" color={colors.onSurfaceSecondary}>
                Maybe later
              </AppText>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={goNext}
            style={styles.nextBtn}
            testID="onboarding-next"
          >
            <AppText variant="button" color="#fff" style={{ fontSize: 15, fontFamily: font.semibold }}>
              Next
            </AppText>
            <Feather name="arrow-right" size={16} color="#fff" style={{ marginLeft: spacing.sm }} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFCFA",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  skipBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  slideContent: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  blob1: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -80,
    right: -60,
    borderWidth: 1,
    opacity: 0.5,
  },
  blob2: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    bottom: -40,
    left: -30,
    opacity: 0.3,
  },
  iconRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  iconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontFamily: font.bold,
    color: "#2C2926",
    textAlign: "center",
    letterSpacing: -0.8,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    color: "#5C5954",
    maxWidth: 320,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xl,
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(192, 92, 61, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(192, 92, 61, 0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brandPrimary,
  },
  bottom: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandPrimary,
    height: 52,
    borderRadius: radius.md,
    width: "100%",
    maxWidth: 380,
    paddingHorizontal: spacing.lg,
  },
  lastActions: {
    width: "100%",
    maxWidth: 380,
    gap: spacing.sm,
    alignItems: "center",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandPrimary,
    height: 52,
    borderRadius: radius.md,
    width: "100%",
    paddingHorizontal: spacing.lg,
  },
  ghostBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
});
