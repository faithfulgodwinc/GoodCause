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
import { font, spacing } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const ONBOARDING_DONE_KEY = "gc_onboarding_done";

// ─── Pro Designer Slide Data ──────────────────────────────────────────────────

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
};

const SLIDES: Slide[] = [
  {
    id: "welcome",
    title: "Fundraise for\nwhat matters.",
    subtitle: "Create campaigns for causes close to your heart. Every cause counts.",
    icon: "globe",
  },
  {
    id: "trust",
    title: "Verified\ncauses only.",
    subtitle: "We verify organizer identity and fund usage. Transparency is our core.",
    icon: "shield",
  },
  {
    id: "impact",
    title: "Real-time\nimpact.",
    subtitle: "Track donations, donor reach, and growth with live analytics.",
    icon: "activity",
  },
  {
    id: "pro",
    title: "GoodCause\nPro.",
    subtitle: "Unlock AI storytelling, advanced analytics, and QR kits.",
    icon: "zap",
  },
];

// ─── Individual Slide ─────────────────────────────────────────────────────────

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

  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [40, 0, 40],
    extrapolate: "clamp",
  });

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.slide, { width: SCREEN_W }]}>
      <Animated.View style={[styles.slideContent, { opacity, transform: [{ translateY }] }]}>
        <View style={styles.iconContainer}>
          <Feather name={slide.icon} size={32} color="#FFFFFF" />
        </View>
        <AppText style={styles.title}>{slide.title}</AppText>
        <AppText style={styles.subtitle}>{slide.subtitle}</AppText>
      </Animated.View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

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

  const goNext = useCallback(() => {
    const next = activeIndex + 1;
    if (next < SLIDES.length) {
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      skipToTabs();
    }
  }, [activeIndex, skipToTabs]);

  const isLast = activeIndex === SLIDES.length - 1;

  // Calculate indicator position
  const indicatorPosition = scrollX.interpolate({
    inputRange: [0, SCREEN_W * (SLIDES.length - 1)],
    outputRange: [0, (SCREEN_W - 48) * ((SLIDES.length - 1) / SLIDES.length)],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 20) }]}>
        <BrandLogo size={24} color="#FFFFFF" />
        <Pressable onPress={skipToTabs} hitSlop={20} style={styles.skipBtn}>
          <AppText style={styles.skipText}>Skip</AppText>
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
          Haptics.selectionAsync().catch(() => {});
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

      {/* Bottom Controls */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 32) }]}>
        
        {/* Progress Line Indicator */}
        <View style={styles.progressBarBg}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: `${100 / SLIDES.length}%`,
                transform: [{ translateX: indicatorPosition }],
              },
            ]}
          />
        </View>

        {/* Action Button */}
        <Pressable
          onPress={goNext}
          style={({ pressed }) => [
            styles.actionBtn,
            pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
          ]}
        >
          <AppText style={styles.actionBtnText}>
            {isLast ? "Get Started" : "Continue"}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    zIndex: 10,
  },
  skipBtn: {
    padding: 8,
  },
  skipText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    fontFamily: font.medium,
    letterSpacing: 0.3,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  slideContent: {
    width: "100%",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  title: {
    fontSize: 48,
    lineHeight: 54,
    fontFamily: font.bold,
    color: "#FFFFFF",
    letterSpacing: -1.5,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 28,
    color: "rgba(255,255,255,0.6)",
    fontFamily: font.regular,
    maxWidth: "90%",
  },
  bottom: {
    paddingHorizontal: 24,
    width: "100%",
  },
  progressBarBg: {
    width: "100%",
    height: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 1.5,
    marginBottom: 40,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 1.5,
  },
  actionBtn: {
    width: "100%",
    height: 56,
    backgroundColor: "#FFFFFF",
    borderRadius: 100, // Pill shape
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#000000",
    fontSize: 17,
    fontFamily: font.semibold,
    letterSpacing: -0.3,
  },
});
