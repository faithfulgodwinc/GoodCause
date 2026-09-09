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
import { Ionicons } from "@expo/vector-icons";

import { AppText, TypeWriterText } from "@/src/components/ui";
import { font, colors } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const { width: SCREEN_W } = Dimensions.get("window");
const ONBOARDING_DONE_KEY = "gc_onboarding_done";

// ─── Slide Data ───────────────────────────────────────────────────────────────

type Slide = {
  id: string;
  titleWhite: string;
  titleGreen: string;
  paragraphs: { text: string; bold?: boolean }[];
  image: any;
  showButton?: boolean;
};

const SLIDES: Slide[] = [
  {
    id: "help",
    titleWhite: "Someone",
    titleGreen: "needs help.",
    paragraphs: [
      {
        text: "There are people around us fighting heavy battles in silence. Parents worried about a child's medical bill, families just hoping for one good meal today.",
        bold: true,
      },
      {
        text: "We all want to help. But sometimes we hold back because we feel our small contribution won't make a difference.",
      },
    ],
    image: require("../../assets/images/onboarding/slide1.jpg"),
  },
  {
    id: "together",
    titleWhite: "What if we all",
    titleGreen: "helped a little?",
    paragraphs: [
      {
        text: "What if the little you have is exactly what someone else is praying for? When thousands of us come together to share what we can, miracles happen.",
        bold: true,
      },
    ],
    image: require("../../assets/images/onboarding/slide2.jpg"),
  },
  {
    id: "cause",
    titleWhite: "Be someone’s",
    titleGreen: "goodcause.",
    paragraphs: [
      {
        text: "Start with a small monthly commitment and watch it change lives in ways you never imagined.",
        bold: true,
      },
      {
        text: "And whenever a story deeply touches your heart, you can always reach out and support them directly. Welcome to a space where we take care of each other.",
      },
    ],
    image: require("../../assets/images/onboarding/slide3.jpg"),
    showButton: true,
  },
];

// ─── Cinematic Background ─────────────────────────────────────────────────────

function CinematicBackground({ scrollX }: { scrollX: Animated.Value }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {SLIDES.map((slide, index) => {
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

        // Subtle slow zoom effect for premium feel
        const scale = scrollX.interpolate({
          inputRange: [
            (index - 1) * SCREEN_W,
            (index + 1) * SCREEN_W,
          ],
          outputRange: [1.02, 1.1],
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

      {/* Heavy gradient at the bottom to blend with the text */}
      <LinearGradient
        colors={["transparent", "rgba(8,10,12,0.8)", "rgba(8,10,12,1)", "rgba(8,10,12,1)"]}
        locations={[0.3, 0.55, 0.7, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

// ─── Slide Text ───────────────────────────────────────────────────────────────

function SlideText({
  slide,
  index,
  scrollX,
  isActive,
  completedParagraphs,
  setCompletedParagraphs,
}: {
  slide: Slide;
  index: number;
  scrollX: Animated.Value;
  isActive: boolean;
  completedParagraphs: number;
  setCompletedParagraphs: React.Dispatch<React.SetStateAction<number>>;
}) {
  const inputRange = [
    (index - 1) * SCREEN_W,
    index * SCREEN_W,
    (index + 1) * SCREEN_W,
  ];

  const slideOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });

  const slideY = scrollX.interpolate({
    inputRange,
    outputRange: [40, 0, -40],
    extrapolate: "clamp",
  });

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={[styles.slide, { width: SCREEN_W, paddingBottom: isLast ? 200 : 130 }]}>
      <Animated.View
        style={[styles.slideContent, { opacity: slideOpacity, transform: [{ translateY: slideY }] }]}
      >
        <AppText style={styles.titleWhite}>{slide.titleWhite}</AppText>
        <AppText style={styles.titleGreen}>{slide.titleGreen}</AppText>

        <View style={styles.paragraphContainer}>
          {slide.paragraphs.map((p, i) => (
            <TypeWriterText
              key={i}
              style={[styles.paragraph, p.bold && styles.paragraphBold]}
              text={p.text}
              start={isActive && i <= completedParagraphs}
              onComplete={() => {
                if (isActive) {
                  setCompletedParagraphs((prev) => Math.max(prev, i + 1));
                }
              }}
            />
          ))}
        </View>
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
  const [completedParagraphs, setCompletedParagraphs] = useState(0);

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
      router.push("/onboarding/commitment");
    }
  }, [activeIndex, router]);

  const isLast = activeIndex === SLIDES.length - 1;

  // Dot indicators
  const renderDots = () => {
    return (
      <View style={styles.dotContainer}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * SCREEN_W, i * SCREEN_W, (i + 1) * SCREEN_W];
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          });
          const bgColor = scrollX.interpolate({
            inputRange,
            outputRange: ["rgba(255,255,255,1)", colors.brandPrimary, "rgba(255,255,255,1)"],
            extrapolate: "clamp",
          });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity, backgroundColor: bgColor }]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Cinematic Background */}
      <CinematicBackground scrollX={scrollX} />

      {/* Top Bar for Skip */}
      {!isLast && (
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={{ flex: 1 }} />
          <Pressable onPress={skipToTabs} hitSlop={20} style={styles.skipBtn}>
            <AppText style={styles.skipText}>Skip</AppText>
          </Pressable>
        </View>
      )}

      {/* Scrollable Slides */}
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
          if (idx !== activeIndex) {
            setActiveIndex(idx);
            setCompletedParagraphs(0);
            Haptics.selectionAsync().catch(() => {});
          }
        }}
        renderItem={({ item, index }) => (
          <SlideText 
            slide={item} 
            index={index} 
            scrollX={scrollX} 
            isActive={activeIndex === index} 
            completedParagraphs={completedParagraphs}
            setCompletedParagraphs={setCompletedParagraphs}
          />
        )}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
      />

      {/* Bottom Area (Button + Dots) */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        
        {/* Animated Action Button (only shows clearly on last slide, or we can crossfade it) */}
        {isLast && (
          <Animated.View style={styles.buttonWrapper}>
            <Pressable
              onPress={goNext}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <AppText style={styles.actionBtnText}>Start giving</AppText>
              <Ionicons name="arrow-forward" size={20} color="#000" style={{ marginLeft: 6 }} />
            </Pressable>
            <AppText style={styles.priceNote}>
              <AppText style={{ color: "rgba(255,255,255,0.6)" }}>From </AppText>
              <AppText style={{ fontFamily: font.bold, color: "rgba(255,255,255,0.9)" }}>₦1,000</AppText>
              <AppText style={{ color: "rgba(255,255,255,0.6)" }}>/month</AppText>
            </AppText>
          </Animated.View>
        )}

        {renderDots()}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080a0c", // Very dark color to blend perfectly
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    position: "absolute",
    width: "100%",
    zIndex: 10,
  },
  skipBtn: { padding: 8 },
  skipText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    fontFamily: font.medium,
    letterSpacing: 0.3,
  },
  slide: {
    flex: 1,
    justifyContent: "flex-end", // Align text towards bottom
    paddingHorizontal: 32,
    zIndex: 1,
  },
  slideContent: {
    width: "100%",
    alignItems: "flex-start",
  },
  titleWhite: {
    fontSize: 38,
    lineHeight: 44,
    fontFamily: font.bold,
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  titleGreen: {
    fontSize: 38,
    lineHeight: 44,
    fontFamily: font.bold,
    color: colors.brandPrimary,
    letterSpacing: -1,
    marginBottom: 20,
  },
  paragraphContainer: {
    gap: 20,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255,255,255,0.85)",
    fontFamily: font.regular,
  },
  paragraphBold: {
    fontFamily: font.medium, // In standard React Native, use medium/semibold for this emphasis
    color: "#FFFFFF",
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    zIndex: 10,
    alignItems: "center",
  },
  buttonWrapper: {
    width: "100%",
    alignItems: "center",
    marginBottom: 32,
  },
  actionBtn: {
    width: "80%",
    height: 52,
    backgroundColor: colors.brandPrimary,
    borderRadius: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionBtnText: {
    color: "#080a0c",
    fontSize: 16,
    fontFamily: font.bold,
  },
  priceNote: {
    fontSize: 13,
  },
  dotContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
