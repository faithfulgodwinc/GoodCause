import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Animated, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/src/components/ui";
import { colors, font } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { useSubscription } from "@/src/lib/revenuecat";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const ONBOARDING_DONE_KEY = "gc_onboarding_done";

export default function SuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier } = useLocalSearchParams();
  const { availablePackages } = useSubscription();

  const pkg = availablePackages.find((p) => p.identifier === tier) || availablePackages[0];

  // Subtle entrance animation following Apple design principles
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    storage.setItem(ONBOARDING_DONE_KEY, true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleFinish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View 
        style={[
          styles.content, 
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        {/* Minimalist Apple-style check badge without AI icons */}
        <View style={styles.iconContainer}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={32} color="#FFFFFF" />
          </View>
        </View>

        {/* Clean, emotional typography without love emojis or extra graphics */}
        <AppText variant="display" style={styles.title}>Welcome home.</AppText>
        
        <AppText style={styles.subtitle}>
          You just made a promise to catch someone when they fall. Somewhere in Nigeria, a life is about to change because of you.
        </AppText>

        {/* Minimalist Apple-style summary card */}
        {pkg && (
          <View style={styles.card}>
            <View style={styles.cardIconBox}>
              <Ionicons name="shield-checkmark" size={20} color={colors.brandPrimary} />
            </View>
            <View style={styles.cardDetails}>
              <AppText style={styles.cardAmount}>
                {pkg.product.priceString}{" "}
                <AppText style={styles.cardSub}>/month</AppText>
              </AppText>
              <AppText style={styles.cardDesc}>Your active community pledge</AppText>
            </View>
          </View>
        )}

        {/* Emotional quote block */}
        <View style={styles.quoteContainer}>
          <AppText style={styles.quoteText}>
            "You don't always have to know whose life you're saving. You just have to know you saved one."
          </AppText>
        </View>
      </Animated.View>

      {/* Clean Apple-style CTA Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 28) }]}>
        <Pressable 
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.btnPressed,
          ]} 
          onPress={handleFinish}
        >
          <AppText style={styles.primaryBtnText}>See the lives you'll touch</AppText>
        </Pressable>
        
        <Pressable 
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && { opacity: 0.6 },
          ]} 
          onPress={handleFinish}
        >
          <AppText style={styles.secondaryBtnText}>See how GoodCause works</AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF", // Plain clean white background
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  
  // Icon Badge
  iconContainer: {
    marginBottom: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    // Subtle Apple soft shadow
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },

  // Typography
  title: {
    fontSize: 32,
    lineHeight: 42,
    fontFamily: font.bold,
    color: colors.onSurface,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.6,
    paddingVertical: 4,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: font.regular,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    marginBottom: 36,
    lineHeight: 23,
    paddingHorizontal: 8,
  },

  // Apple Design Commitment Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#000000",
    borderStyle: "dashed",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    width: "100%",
    marginBottom: 36,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E6F4EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  cardDetails: {
    flex: 1,
  },
  cardAmount: {
    fontSize: 18,
    fontFamily: font.bold,
    color: colors.onSurface,
  },
  cardSub: {
    fontSize: 13,
    fontFamily: font.medium,
    color: colors.onSurfaceSecondary,
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: font.regular,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },

  // Emotional Quote Section
  quoteContainer: {
    paddingHorizontal: 16,
  },
  quoteText: {
    fontSize: 16,
    fontFamily: font.medium,
    fontStyle: "italic",
    color: colors.brandPrimary,
    textAlign: "center",
    lineHeight: 24,
    opacity: 0.9,
  },

  // Footer Buttons
  footer: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  primaryBtn: {
    width: "100%",
    height: 56,
    backgroundColor: colors.brandPrimary,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: font.bold,
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    fontFamily: font.medium,
  },
});
