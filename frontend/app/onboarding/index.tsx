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
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { AppText, BrandLogo } from "@/src/components/ui";
import { font, spacing, colors } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const ONBOARDING_DONE_KEY = "gc_onboarding_done";

// ─── Slide Data ───────────────────────────────────────────────────────────────

type Slide = {
  id: string;
  title: string;
  subtitle: string;
};

const SLIDES: Slide[] = [
  {
    id: "welcome",
    title: "Fundraise for\nwhat matters.",
    subtitle: "Create campaigns for causes close to your heart. Every cause counts.",
  },
  {
    id: "trust",
    title: "Verified\ncauses only.",
    subtitle: "We verify organizer identity and fund usage. Transparency is our core.",
  },
  {
    id: "impact",
    title: "Real-time\nimpact.",
    subtitle: "Track donations, donor reach, and growth with live analytics.",
  },
  {
    id: "pro",
    title: "GoodCause\nPro.",
    subtitle: "Unlock AI storytelling, advanced analytics, and QR kits.",
  },
];

// ─── Scrollytelling Graphics Layer ────────────────────────────────────────────

function GraphicsLayer({ scrollX }: { scrollX: Animated.Value }) {
  // Core morphing
  const coreSize = scrollX.interpolate({
    inputRange: [0, SCREEN_W, 2 * SCREEN_W, 3 * SCREEN_W],
    outputRange: [180, 220, 190, 240],
    extrapolate: "clamp",
  });
  
  const coreRadius = scrollX.interpolate({
    inputRange: [0, SCREEN_W, 2 * SCREEN_W, 3 * SCREEN_W],
    outputRange: [90, 50, 80, 30],
    extrapolate: "clamp",
  });
  
  const coreRotate = scrollX.interpolate({
    inputRange: [0, SCREEN_W, 2 * SCREEN_W, 3 * SCREEN_W],
    outputRange: ["0deg", "45deg", "-15deg", "90deg"],
    extrapolate: "clamp",
  });

  // Icon Opacities
  const op0 = scrollX.interpolate({ inputRange: [0, SCREEN_W/2], outputRange: [1, 0], extrapolate: "clamp" });
  const op1 = scrollX.interpolate({ inputRange: [SCREEN_W/2, SCREEN_W, SCREEN_W*1.5], outputRange: [0, 1, 0], extrapolate: "clamp" });
  const op2 = scrollX.interpolate({ inputRange: [SCREEN_W*1.5, SCREEN_W*2, SCREEN_W*2.5], outputRange: [0, 1, 0], extrapolate: "clamp" });
  const op3 = scrollX.interpolate({ inputRange: [SCREEN_W*2.5, SCREEN_W*3], outputRange: [0, 1], extrapolate: "clamp" });

  // Icon Scales for bounce
  const sc0 = scrollX.interpolate({ inputRange: [0, SCREEN_W/2], outputRange: [1, 0.5], extrapolate: "clamp" });
  const sc1 = scrollX.interpolate({ inputRange: [SCREEN_W/2, SCREEN_W, SCREEN_W*1.5], outputRange: [0.5, 1, 0.5], extrapolate: "clamp" });
  const sc2 = scrollX.interpolate({ inputRange: [SCREEN_W*1.5, SCREEN_W*2, SCREEN_W*2.5], outputRange: [0.5, 1, 0.5], extrapolate: "clamp" });
  const sc3 = scrollX.interpolate({ inputRange: [SCREEN_W*2.5, SCREEN_W*3], outputRange: [0.5, 1], extrapolate: "clamp" });

  // Core icon counter-rotation (so icons stay upright)
  const iconRotate0 = scrollX.interpolate({ inputRange: [0, SCREEN_W], outputRange: ["0deg", "-45deg"], extrapolate: "clamp" });
  const iconRotate1 = scrollX.interpolate({ inputRange: [SCREEN_W, 2*SCREEN_W], outputRange: ["-45deg", "15deg"], extrapolate: "clamp" });
  const iconRotate2 = scrollX.interpolate({ inputRange: [2*SCREEN_W, 3*SCREEN_W], outputRange: ["15deg", "-90deg"], extrapolate: "clamp" });
  const iconRotate3 = scrollX.interpolate({ inputRange: [3*SCREEN_W, 4*SCREEN_W], outputRange: ["-90deg", "0deg"], extrapolate: "clamp" });

  return (
    <View style={styles.graphicsContainer} pointerEvents="none">
      
      {/* Dynamic Core */}
      <Animated.View style={[styles.core, { 
        width: coreSize, height: coreSize, borderRadius: coreRadius,
        transform: [{ rotate: coreRotate }] 
      }]}>
        <Animated.View style={[styles.coreIcon, { opacity: op0, transform: [{ scale: sc0 }, { rotate: iconRotate0 }] }]}>
          <Feather name="heart" size={64} color="#FFF" />
        </Animated.View>
        <Animated.View style={[styles.coreIcon, { opacity: op1, transform: [{ scale: sc1 }, { rotate: iconRotate1 }] }]}>
          <Feather name="shield" size={64} color="#FFF" />
        </Animated.View>
        <Animated.View style={[styles.coreIcon, { opacity: op2, transform: [{ scale: sc2 }, { rotate: iconRotate2 }] }]}>
          <Feather name="activity" size={64} color="#FFF" />
        </Animated.View>
        <Animated.View style={[styles.coreIcon, { opacity: op3, transform: [{ scale: sc3 }, { rotate: iconRotate3 }] }]}>
          <Feather name="zap" size={64} color="#FFF" />
        </Animated.View>
      </Animated.View>

      {/* Parallax Floating Widgets */}
      
      {/* Slide 0: Donation Pill */}
      <Animated.View style={[styles.widgetPill, {
        opacity: scrollX.interpolate({ inputRange: [0, SCREEN_W/2], outputRange: [1, 0] }),
        transform: [
          { translateX: scrollX.interpolate({ inputRange: [0, SCREEN_W], outputRange: [90, 160] }) },
          { translateY: scrollX.interpolate({ inputRange: [0, SCREEN_W], outputRange: [-80, -140] }) },
          { scale: sc0 }
        ]
      }]}>
        <Feather name="heart" size={14} color={colors.brandPrimary} style={{ marginRight: 6 }}/>
        <AppText style={styles.widgetText}>+$50</AppText>
      </Animated.View>

      {/* Slide 0: User Avatar Circle */}
      <Animated.View style={[styles.widgetCircle, {
        opacity: scrollX.interpolate({ inputRange: [0, SCREEN_W/2], outputRange: [1, 0] }),
        transform: [
          { translateX: scrollX.interpolate({ inputRange: [0, SCREEN_W], outputRange: [-90, -160] }) },
          { translateY: scrollX.interpolate({ inputRange: [0, SCREEN_W], outputRange: [70, 120] }) },
          { scale: sc0 }
        ]
      }]}>
        <Feather name="user" size={20} color={colors.brandPrimary} />
      </Animated.View>

      {/* Slide 1: Verified Badge */}
      <Animated.View style={[styles.widgetBadge, {
        opacity: op1,
        transform: [
          { translateX: scrollX.interpolate({ inputRange: [0, SCREEN_W, 2*SCREEN_W], outputRange: [100, -80, -160] }) },
          { translateY: scrollX.interpolate({ inputRange: [0, SCREEN_W, 2*SCREEN_W], outputRange: [0, -100, -160] }) },
          { scale: sc1 }
        ]
      }]}>
        <Feather name="check" size={24} color="#FFF" />
      </Animated.View>

      {/* Slide 1: Lock Circle */}
      <Animated.View style={[styles.widgetCircle, {
        opacity: op1,
        transform: [
          { translateX: scrollX.interpolate({ inputRange: [0, SCREEN_W, 2*SCREEN_W], outputRange: [-100, 90, 160] }) },
          { translateY: scrollX.interpolate({ inputRange: [0, SCREEN_W, 2*SCREEN_W], outputRange: [0, 80, 140] }) },
          { scale: sc1 }
        ]
      }]}>
        <Feather name="lock" size={20} color={colors.brandPrimary} />
      </Animated.View>

      {/* Slide 2: Growth Arrow */}
      <Animated.View style={[styles.widgetPill, {
        opacity: op2,
        transform: [
          { translateX: scrollX.interpolate({ inputRange: [SCREEN_W, 2*SCREEN_W, 3*SCREEN_W], outputRange: [100, 90, 160] }) },
          { translateY: scrollX.interpolate({ inputRange: [SCREEN_W, 2*SCREEN_W, 3*SCREEN_W], outputRange: [0, -100, -150] }) },
          { scale: sc2 }
        ]
      }]}>
        <Feather name="trending-up" size={16} color={colors.brandPrimary} style={{ marginRight: 6 }}/>
        <AppText style={styles.widgetText}>24%</AppText>
      </Animated.View>

      {/* Slide 2: Target Circle */}
      <Animated.View style={[styles.widgetCircle, {
        opacity: op2,
        transform: [
          { translateX: scrollX.interpolate({ inputRange: [SCREEN_W, 2*SCREEN_W, 3*SCREEN_W], outputRange: [-100, -90, -160] }) },
          { translateY: scrollX.interpolate({ inputRange: [SCREEN_W, 2*SCREEN_W, 3*SCREEN_W], outputRange: [0, 80, 140] }) },
          { scale: sc2 }
        ]
      }]}>
        <Feather name="target" size={20} color={colors.brandPrimary} />
      </Animated.View>

      {/* Slide 3: Pro Pill */}
      <Animated.View style={[styles.widgetPill, {
        opacity: op3,
        transform: [
          { translateX: scrollX.interpolate({ inputRange: [2*SCREEN_W, 3*SCREEN_W], outputRange: [100, 0] }) },
          { translateY: scrollX.interpolate({ inputRange: [2*SCREEN_W, 3*SCREEN_W], outputRange: [100, -160] }) },
          { scale: sc3 }
        ]
      }]}>
        <Feather name="award" size={16} color={colors.brandPrimary} style={{ marginRight: 6 }}/>
        <AppText style={styles.widgetText}>Pro Features</AppText>
      </Animated.View>

      {/* Slide 3: AI Sparkle */}
      <Animated.View style={[styles.widgetCircle, {
        opacity: op3,
        transform: [
          { translateX: scrollX.interpolate({ inputRange: [2*SCREEN_W, 3*SCREEN_W], outputRange: [-100, -110] }) },
          { translateY: scrollX.interpolate({ inputRange: [2*SCREEN_W, 3*SCREEN_W], outputRange: [-100, 40] }) },
          { scale: sc3 }
        ]
      }]}>
        <Feather name="cpu" size={20} color={colors.brandPrimary} />
      </Animated.View>

    </View>
  );
}

// ─── Individual Text Slide ─────────────────────────────────────────────────────

function SlideText({ slide, index, scrollX }: { slide: Slide; index: number; scrollX: Animated.Value }) {
  const inputRange = [
    (index - 1) * SCREEN_W,
    index * SCREEN_W,
    (index + 1) * SCREEN_W,
  ];

  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [60, 0, -60],
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

  // Calculate indicator position
  const indicatorPosition = scrollX.interpolate({
    inputRange: [0, SCREEN_W * (SLIDES.length - 1)],
    outputRange: [0, (SCREEN_W - 48) * ((SLIDES.length - 1) / SLIDES.length)],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Scrollytelling Graphics Background */}
      <GraphicsLayer scrollX={scrollX} />

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 20) }]}>
        <BrandLogo size={24} color={colors.brandPrimary} />
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
          { useNativeDriver: false }
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
    backgroundColor: colors.surface,
  },
  graphicsContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 200, // Pushes graphics into the upper half of the screen
    zIndex: 0,
  },
  core: {
    backgroundColor: colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },
  coreIcon: {
    position: 'absolute',
  },
  widgetPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  widgetText: {
    color: colors.brandPrimary,
    fontSize: 16,
    fontFamily: font.semibold,
  },
  widgetCircle: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  widgetBadge: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0284C7', // Blue trust badge
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
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
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    fontFamily: font.medium,
    letterSpacing: 0.3,
  },
  slide: {
    flex: 1,
    justifyContent: "flex-end", // Push text to bottom
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
    color: colors.onSurface,
    letterSpacing: -1.5,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.onSurfaceSecondary,
    fontFamily: font.regular,
    maxWidth: "90%",
  },
  bottom: {
    paddingHorizontal: 24,
    width: "100%",
    zIndex: 10,
  },
  progressBarBg: {
    width: "100%",
    height: 4,
    backgroundColor: colors.border,
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
