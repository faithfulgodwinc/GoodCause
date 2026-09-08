import React, { useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Animated,
  Dimensions,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { AppText, BrandLogo } from "@/src/components/ui";
import { font, colors } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const { width: SCREEN_W } = Dimensions.get("window");
const ONBOARDING_DONE_KEY = "gc_onboarding_done";

// ─── Emotional & Cinematic Content ────────────────────────────────────────────

const SLIDES = [
  {
    id: "welcome",
    title: "Every life has\na story.",
    subtitle: "What will you help them write? Community-powered fundraising for what matters most.",
    image: require("../../assets/images/onboarding/slide1.jpg"),
  },
  {
    id: "trust",
    title: "Trust is\neverything.",
    subtitle: "We protect your giving. Every organizer is verified, so you can support causes with absolute confidence.",
    image: require("../../assets/images/onboarding/slide2.jpg"),
  },
  {
    id: "impact",
    title: "See your\nimpact.",
    subtitle: "Watch the difference you make instantly with real-time analytics, donor insights, and transparent updates.",
    image: require("../../assets/images/onboarding/slide3.jpg"),
  },
  {
    id: "pro",
    title: "Amplify\nyour voice.",
    subtitle: "Unlock powerful storytelling tools and change the world faster with a GoodCause Pro membership.",
    image: require("../../assets/images/onboarding/slide4.jpg"),
  },
];

// ─── Cinematic Ken Burns Background ───────────────────────────────────────────

function CinematicBackground({ scrollX }: { scrollX: Animated.Value }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {SLIDES.map((slide, index) => {
        const inputRange = [
          (index - 1) * SCREEN_W,
          index * SCREEN_W,
          (index + 1) * SCREEN_W,
        ];
        
        // Buttery crossfade
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0, 1, 0],
          extrapolate: "clamp",
        });

        // Framer Motion style continuous slow zoom (Ken Burns effect)
        const scale = scrollX.interpolate({
          inputRange: [
            (index - 1) * SCREEN_W,
            (index + 1) * SCREEN_W,
          ],
          outputRange: [1, 1.15],
          extrapolate: "clamp",
        });

        return (
          <Animated.View key={slide.id} style={[StyleSheet.absoluteFill, { opacity }]}>
            <Animated.Image 
              source={slide.image} 
              style={[StyleSheet.absoluteFill, { width: "100%", height: "100%", transform: [{ scale }] }]} 
              resizeMode="cover"
            />
          </Animated.View>
        );
      })}
      
      {/* Dark vignette gradient overlay to make white text pop emotionally */}
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

// ─── Text Slide ───────────────────────────────────────────────────────────────

function SlideText({ slide, index, scrollX }: { slide: any; index: number; scrollX: Animated.Value }) {
  const inputRange = [
    (index - 1) * SCREEN_W,
    index * SCREEN_W,
    (index + 1) * SCREEN_W,
  ];

  // Dramatic swoop-up effect typical in premium framer motion sites
  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [120, 0, -60],
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

  // Indicator line
  const indicatorPosition = scrollX.interpolate({
    inputRange: [0, SCREEN_W * (SLIDES.length - 1)],
    outputRange: [0, (SCREEN_W - 48) * ((SLIDES.length - 1) / SLIDES.length)],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Cinematic Imagery */}
      <CinematicBackground scrollX={scrollX} />

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 20) }]}>
        <BrandLogo size={24} color="#FFFFFF" />
        <Pressable onPress={skipToTabs} hitSlop={20} style={styles.skipBtn}>
          <AppText style={styles.skipText}>Skip</AppText>
        </Pressable>
      </View>

      {/* Text Slides */}
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
          { useNativeDriver: false } // Required for layout interpolations in some cases
        )}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setActiveIndex(idx);
          Haptics.selectionAsync().catch(() => {});
        }}
        renderItem={({ item, index }) => (
          <SlideText slide={item} index={index} scrollX={scrollX} />
        )}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
      />

      {/* Bottom Controls */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 32) }]}>
        
        {/* Progress Line */}
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
    backgroundColor: "#000",
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
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontFamily: font.medium,
    letterSpacing: 0.3,
  },
  slide: {
    flex: 1,
    justifyContent: "flex-end", // Push text to bottom over the gradient
    paddingHorizontal: 32,
    paddingBottom: 40,
    zIndex: 1,
  },
  slideContent: {
    width: "100%",
  },
  title: {
    fontSize: 48,
    lineHeight: 54,
    fontFamily: font.bold,
    color: "#FFFFFF",
    letterSpacing: -1.5,
    marginBottom: 20,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 28,
    color: "rgba(255,255,255,0.85)",
    fontFamily: font.medium,
    maxWidth: "95%",
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  bottom: {
    paddingHorizontal: 24,
    width: "100%",
    zIndex: 10,
  },
  progressBarBg: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    marginBottom: 40,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.brandPrimary,
    borderRadius: 2,
  },
  actionBtn: {
    width: "100%",
    height: 56,
    backgroundColor: colors.brandPrimary,
    borderRadius: 100, // Pill shape
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: font.semibold,
    letterSpacing: -0.3,
  },
});
