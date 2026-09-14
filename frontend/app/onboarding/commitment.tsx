import React, { useState } from "react";
import { View, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, BrandLogo } from "@/src/components/ui";
import { formatCurrency } from "@/src/format";
import { colors, font } from "@/src/theme";
import * as Haptics from "expo-haptics";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { useAuth } from "@/src/context/auth";

const TIERS = [
  { id: "tier_1k", amount: 1000, desc: "Essential membership." },
  { id: "tier_2k5", amount: 2500, desc: "Supporting membership." },
  { id: "tier_5k", amount: 5000, desc: "Impact membership." },
  { id: "tier_10k", amount: 10000, desc: "Champion membership." },
];

function TierRow({
  isSelected,
  onPress,
  label,
  desc,
}: {
  isSelected: boolean;
  onPress: () => void;
  label: string;
  desc: string;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.98, { stiffness: 400, damping: 20 }); }}
      onPressOut={() => { scale.value = withSpring(1, { stiffness: 400, damping: 20 }); }}
    >
      <Animated.View style={[styles.tierRow, animatedStyle]}>
        <View style={styles.tierText}>
          <AppText style={[styles.tierAmount, isSelected && styles.tierAmountSelected]}>
            {label}
          </AppText>
          <AppText style={styles.tierDesc} numberOfLines={2}>
            {desc}
          </AppText>
        </View>
        <View style={[styles.radio, isSelected && styles.radioSelected]}>
          {isSelected && <View style={styles.radioDot} />}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function CommitmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selected, setSelected] = useState("tier_5k");

  const handleSkip = () => {
    if (user) {
      router.replace("/(tabs)");
    } else {
      router.replace({ pathname: "/onboarding/auth", params: { returnTo: "tabs" } });
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/onboarding/model", params: { tier: selected } });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <BrandLogo size={20} color={colors.onSurface} />
        <Pressable onPress={handleSkip} style={styles.headerBtn} hitSlop={8}>
          <AppText style={styles.skipText}>Skip</AppText>
        </Pressable>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.titleWrap}>
          <AppText style={styles.title}>Choose your GoodCause{"\n"}membership</AppText>
          <AppText style={styles.subtitle}>Get member benefits and help GoodCause fund verified causes every month.</AppText>
        </View>

        {/* Tier list */}
        <View style={styles.list}>
          {TIERS.map((tier) => (
            <TierRow
              key={tier.id}
              isSelected={selected === tier.id}
              onPress={() => {
                Haptics.selectionAsync();
                setSelected(tier.id);
              }}
              label={formatCurrency(tier.amount, "NGN") + "/mo"}
              desc={tier.desc}
            />
          ))}
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Pressable
          style={styles.customBtn}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            alert("Custom amounts coming soon!");
          }}
        >
          <AppText style={styles.customText}>Enter a custom amount</AppText>
        </Pressable>

        <Pressable style={styles.continueBtn} onPress={handleContinue}>
          <AppText style={styles.continueText}>Continue</AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerBtn: { padding: 4 },
  skipText: {
    fontSize: 16,
    fontFamily: font.medium,
    color: colors.onSurfaceSecondary,
  },

  // Body
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  titleWrap: {
    marginBottom: 36,
  },
  title: {
    fontSize: 28,
    fontFamily: font.bold,
    color: colors.onSurface,
    letterSpacing: -0.5,
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: font.regular,
    color: colors.onSurfaceSecondary,
  },

  // Tier list
  list: {
    gap: 0,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    justifyContent: "space-between",
  },
  tierText: {
    flex: 1,
    paddingRight: 16,
  },
  tierAmount: {
    fontSize: 17,
    fontFamily: font.semibold,
    color: colors.onSurface,
    marginBottom: 3,
  },
  tierAmountSelected: {
    color: colors.brandPrimary,
  },
  tierDesc: {
    fontSize: 13,
    fontFamily: font.regular,
    color: colors.onSurfaceSecondary,
    lineHeight: 18,
  },

  // Radio button
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.onSurfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: colors.brandPrimary,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.brandPrimary,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
  },
  customBtn: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  customText: {
    fontSize: 15,
    fontFamily: font.medium,
    color: colors.onSurfaceSecondary,
  },
  continueBtn: {
    backgroundColor: colors.brandPrimary,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    color: colors.onBrandPrimary,
    fontSize: 17,
    fontFamily: font.semibold,
  },
});
