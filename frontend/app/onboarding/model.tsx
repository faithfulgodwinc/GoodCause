import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Platform, ImageBackground } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, TypeWriterText } from "@/src/components/ui";
import { formatCurrency } from "@/src/format";
import { colors, font } from "@/src/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  useAnimatedReaction, 
  runOnJS 
} from "react-native-reanimated";

const IMPACT_MAP: Record<string, string> = {
  tier_1k: "provides warm, nutritious meals for a family in need this month.",
  tier_2k5: "funds urgent medical supplies for a local community clinic.",
  tier_5k: "provides critical anti-malaria medicine for two children this month.",
  tier_10k: "covers life-saving hospital bills for an emergency patient.",
};

const TIER_RAW: Record<string, number> = {
  tier_1k: 1000,
  tier_2k5: 2500,
  tier_5k: 5000,
  tier_10k: 10000,
};

function HeartbeatButton({ onComplete }: { onComplete: () => void }) {
  const [isPressing, setIsPressing] = useState(false);
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    setIsPressing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    scale.value = withSpring(0.95, { stiffness: 400, damping: 20 });
    progress.value = withTiming(1, { duration: 1500 });
  };

  const handlePressOut = () => {
    setIsPressing(false);
    scale.value = withSpring(1, { stiffness: 400, damping: 20 });
    if (progress.value < 1) {
      progress.value = withTiming(0, { duration: 300 });
    }
  };

  useAnimatedReaction(
    () => progress.value,
    (v, prev) => {
      if (v === 1 && prev !== 1) {
        runOnJS(onComplete)();
      }
    }
  );

  useEffect(() => {
    if (!isPressing) return;
    const interval = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 450);
    return () => clearInterval(interval);
  }, [isPressing]);

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  const animatedScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <Pressable 
      onPressIn={handlePressIn} 
      onPressOut={handlePressOut}
      style={{ marginTop: 24, marginBottom: 8 }}
    >
      <Animated.View style={[styles.heartbeatOuter, animatedScaleStyle]}>
        {/* Progress Fill Background */}
        <Animated.View style={[styles.heartbeatProgress, animatedProgressStyle]} />
        
        <View style={styles.heartbeatInner}>
          <Ionicons name="finger-print-outline" size={24} color={colors.surface} />
          <AppText style={styles.heartbeatText}>Press & hold to pledge</AppText>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function ModelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier } = useLocalSearchParams();
  
  const tierKey = typeof tier === "string" ? tier : "tier_5k";
  const amountNum = TIER_RAW[tierKey] || 5000;
  const tierString = formatCurrency(amountNum, "NGN");
  const impactString = IMPACT_MAP[tierKey] || IMPACT_MAP.tier_5k;

  const handlePledgeComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push({ pathname: "/onboarding/payment", params: { tier } });
  };

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={require("../../assets/images/onboarding/slide3.jpg")} 
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["rgba(8,10,12,0.0)", "rgba(8,10,12,0.5)", "#080a0c", "#080a0c"]}
        locations={[0, 0.4, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: Platform.OS === "android" ? insets.top + 12 : insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.surface} />
        </Pressable>
      </View>

      <View style={[styles.contentWrapper, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        
        <View style={styles.textWrap}>
          <AppText style={styles.titleWhite}>You are becoming a</AppText>
          <AppText style={styles.titleGreen}>lifeline.</AppText>
        </View>

        <View style={{ height: 80, justifyContent: "center" }}>
          <TypeWriterText 
            style={styles.storyText}
            text={`Your ${tierString} doesn't just sit in a bank. It ${impactString} You are literally changing lives.`}
          />
        </View>

        {/* Glassmorphic Pledge Card */}
        <View style={styles.glassContainer}>
          <BlurView intensity={40} tint="dark" style={styles.glassBlur}>
            <View style={styles.glassContent}>
              <View style={styles.glassIcon}>
                <Ionicons name="heart" size={24} color={colors.brandPrimary} />
              </View>
              <View style={styles.glassTextCol}>
                <AppText style={styles.glassTitle}>Your Monthly Pledge</AppText>
                <AppText style={styles.glassAmount}>{tierString}</AppText>
                <AppText style={styles.glassDesc}>You are always in control. Pause or cancel your giving anytime.</AppText>
              </View>
            </View>
          </BlurView>
        </View>

        <HeartbeatButton onComplete={handlePledgeComplete} />
        
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080a0c" },
  header: { 
    position: "absolute",
    top: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  backBtn: { padding: 8, alignSelf: "flex-start" },
  
  contentWrapper: { 
    flex: 1, 
    justifyContent: "flex-end", 
    paddingHorizontal: 24,
  },
  
  textWrap: { marginBottom: 16 },
  titleWhite: { fontSize: 36, fontFamily: font.bold, color: colors.surface, letterSpacing: -1, lineHeight: 40 },
  titleGreen: { fontSize: 36, fontFamily: font.bold, color: colors.brandPrimary, letterSpacing: -1, lineHeight: 40 },
  
  storyText: { 
    fontSize: 16, 
    color: "rgba(255,255,255,0.9)", 
    lineHeight: 24, 
    fontFamily: font.medium 
  },
  
  /* Glassmorphic Card */
  glassContainer: {
    borderRadius: 24,
    overflow: "hidden",
    marginTop: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  glassBlur: {
    padding: 20,
  },
  glassContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  glassIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  glassTextCol: {
    flex: 1,
  },
  glassTitle: { fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: font.bold, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  glassAmount: { fontSize: 28, fontFamily: font.bold, color: colors.surface, marginBottom: 8 },
  glassDesc: { fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 16 },

  /* Heartbeat Button */
  heartbeatOuter: {
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    justifyContent: "center",
  },
  heartbeatProgress: {
    position: "absolute",
    top: 0, bottom: 0, left: 0,
    backgroundColor: colors.brandPrimary,
  },
  heartbeatInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  heartbeatText: {
    color: colors.surface,
    fontSize: 18,
    fontFamily: font.bold,
  },
});
