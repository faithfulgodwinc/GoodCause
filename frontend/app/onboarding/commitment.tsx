import React, { useState } from "react";
import { View, StyleSheet, Pressable, Platform, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, BrandLogo } from "@/src/components/ui";
import { colors, font } from "@/src/theme";
import * as Haptics from "expo-haptics";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const { width } = Dimensions.get("window");

// A premium cool off-white/gray for Neumorphism
const NEU_BG = "#E0E5EC";
const LIGHT_SHADOW = "#FFFFFF";
const DARK_SHADOW = "#A3B1C6";

const TIERS = [
  { id: "tier_1k", label: "₦1,000", desc: "A small step." },
  { id: "tier_2k5", label: "₦2,500", desc: "More support." },
  { id: "tier_5k", label: "₦5,000", desc: "Powerful way." },
  { id: "tier_10k", label: "₦10,000", desc: "Greater reach." },
];

function NeuButton({ 
  isSelected, 
  onPress, 
  label, 
  desc 
}: { 
  isSelected: boolean; 
  onPress: () => void; 
  label: string; 
  desc: string 
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { stiffness: 400, damping: 20 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 400, damping: 20 });
  };

  return (
    <Pressable 
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ width: "47%", aspectRatio: 1, marginBottom: "6%" }}
    >
      <Animated.View style={[styles.neuOuter, animatedStyle]}>
        <View style={[
          styles.neuInner, 
          isSelected && styles.neuInnerSelected
        ]}>
          <View style={styles.neuContent}>
            {isSelected && (
              <View style={styles.selectedDot} />
            )}
            <AppText style={[styles.tierLabel, isSelected && { color: colors.brandPrimary }]}>
              {label}
            </AppText>
            <AppText style={styles.tierDesc}>
              {desc}
            </AppText>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function CommitmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState("tier_5k");

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/onboarding/model", params: { tier: selected } });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Minimal Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
          </Pressable>
          <BrandLogo size={20} />
          <Pressable onPress={() => router.replace("/")} style={styles.headerBtn}>
            <AppText style={styles.skipText}>Skip</AppText>
          </Pressable>
        </View>

        <View style={[styles.body, { paddingBottom: insets.bottom + 20 }]}>
          
          <View style={styles.textWrap}>
            <AppText style={styles.title}>How much would you like to give every month?</AppText>
            <AppText style={styles.subtitle}>
              Select a tier to join other GoodCauses.
            </AppText>
          </View>

          {/* 2x2 Neumorphic Grid */}
          <View style={styles.gridContainer}>
            {TIERS.map((tier) => (
              <NeuButton 
                key={tier.id}
                isSelected={selected === tier.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelected(tier.id);
                }}
                label={tier.label}
                desc={tier.desc}
              />
            ))}
          </View>

          <View style={styles.footer}>
             <Pressable
              style={({ pressed }) => [
                styles.customBtn,
                pressed && { opacity: 0.7 }
              ]}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                alert("Custom amounts coming soon in production!");
              }}
            >
              <AppText style={styles.customText}>Enter custom amount</AppText>
            </Pressable>

            {/* Neumorphic Continue Button */}
            <Pressable onPress={handleContinue}>
              <View style={styles.continueOuter}>
                 <View style={styles.continueInner}>
                    <AppText style={styles.continueText}>Continue</AppText>
                    <Ionicons name="arrow-forward" size={20} color={colors.surface} />
                 </View>
              </View>
            </Pressable>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: NEU_BG 
  },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: { padding: 8 },
  skipText: { fontSize: 16, fontFamily: font.medium, color: colors.onSurfaceSecondary },
  
  body: { 
    flex: 1,
    paddingHorizontal: 24, 
    paddingTop: 16,
    justifyContent: "space-between" // Pushes elements apart for non-scrollable fit
  },
  
  textWrap: {
    marginBottom: 20,
  },
  title: { 
    fontSize: 32, 
    fontFamily: font.bold, 
    color: colors.onSurface, 
    marginBottom: 8, 
    letterSpacing: -1, 
    lineHeight: 38 
  },
  subtitle: { 
    fontSize: 16, 
    color: colors.onSurfaceSecondary, 
    lineHeight: 24, 
    fontFamily: font.regular 
  },
  
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
  },

  /* Neumorphic Tier Button Styles */
  neuOuter: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: NEU_BG,
    // Dark bottom-right shadow
    shadowColor: DARK_SHADOW,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
  },
  neuInner: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: NEU_BG,
    padding: 20,
    justifyContent: "flex-end",
    // Light top-left shadow
    shadowColor: LIGHT_SHADOW,
    shadowOffset: { width: -8, height: -8 },
    shadowOpacity: 0.9,
    shadowRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  neuInnerSelected: {
    backgroundColor: "#D6DCE5", // slightly darker, mimicking being pressed in
    borderColor: "rgba(0,0,0,0.05)",
  },
  neuContent: {
    alignItems: "flex-start"
  },
  tierLabel: { 
    fontSize: 28, 
    fontFamily: font.bold, 
    color: colors.onSurface,
    marginBottom: 4,
    letterSpacing: -1
  },
  tierDesc: { 
    fontSize: 14, 
    color: colors.onSurfaceSecondary, 
    fontFamily: font.medium 
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brandPrimary,
    position: "absolute",
    top: -24,
    right: 0,
  },

  /* Footer Area */
  footer: {
    gap: 24,
    marginTop: 20,
  },
  customBtn: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  customText: {
    fontSize: 16,
    fontFamily: font.semibold,
    color: colors.onSurfaceSecondary,
    textDecorationLine: "underline"
  },

  /* Neumorphic Continue Button */
  continueOuter: {
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandPrimary,
    // Soft glowing shadow matching brand color
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  continueInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  continueText: { 
    color: colors.surface, 
    fontSize: 18, 
    fontFamily: font.bold 
  },
});
