import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, BrandLogo } from "@/src/components/ui";
import { colors, font } from "@/src/theme";
import * as Haptics from "expo-haptics";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const TIERS = [
  { id: "tier_1k", label: "₦1,000", sub: "/month", desc: "A small step. A real difference." },
  { id: "tier_2k5", label: "₦2,500", sub: "/month", desc: "More support. More impact." },
  { id: "tier_5k", label: "₦5,000", sub: "/month", desc: "A powerful way to give.", popular: true },
  { id: "tier_10k", label: "₦10,000", sub: "/month", desc: "Greater reach. Bigger impact." },
];

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

        <ScrollView 
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <AppText style={styles.title}>How much would you like to give every month?</AppText>
          <AppText style={styles.subtitle}>
            Your contribution joins other GoodCauses to support verified people and causes across Nigeria.
          </AppText>

          {/* Ultra-Minimal iOS Inset Grouped List */}
          <View style={styles.listContainer}>
            {TIERS.map((tier, index) => {
              const isSelected = selected === tier.id;
              const isLast = index === TIERS.length - 1;
              return (
                <View key={tier.id}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.listItem,
                      pressed && { backgroundColor: "rgba(0,0,0,0.03)" }
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelected(tier.id);
                    }}
                  >
                    <View style={styles.listContent}>
                      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                        <AppText style={styles.listLabel}>{tier.label}</AppText>
                        <AppText style={styles.listSub}>{tier.sub}</AppText>
                      </View>
                      <AppText style={styles.listDesc}>{tier.desc}</AppText>
                    </View>

                    <View style={styles.listRight}>
                      {tier.popular && (
                        <View style={styles.badge}>
                          <AppText style={styles.badgeText}>Popular</AppText>
                        </View>
                      )}
                      {isSelected ? (
                        <Ionicons name="checkmark" size={24} color={colors.brandPrimary} />
                      ) : (
                        <View style={{ width: 24 }} /> 
                      )}
                    </View>
                  </Pressable>
                  {!isLast && <View style={styles.divider} />}
                </View>
              );
            })}

            <View style={styles.divider} />

            <Pressable
              style={({ pressed }) => [
                styles.listItem,
                pressed && { backgroundColor: "rgba(0,0,0,0.03)" }
              ]}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                alert("Custom amounts coming soon in production!");
              }}
            >
              <View style={styles.listContent}>
                <AppText style={styles.listLabel}>Custom amount</AppText>
              </View>
              <View style={styles.listRight}>
                 <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
              </View>
            </Pressable>
          </View>

          <View style={{ marginTop: 40 }}>
            <Pressable 
              style={({ pressed }) => [
                styles.continueBtn,
                pressed && { opacity: 0.85 }
              ]} 
              onPress={handleContinue}
            >
              <AppText style={styles.continueText}>Continue</AppText>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface }, // Pure white
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: { padding: 8 },
  skipText: { fontSize: 16, fontFamily: font.medium, color: colors.onSurfaceSecondary },
  
  scroll: { paddingHorizontal: 24, paddingTop: 16 },
  
  title: { fontSize: 32, fontFamily: font.bold, color: colors.onSurface, marginBottom: 8, letterSpacing: -1, lineHeight: 38 },
  subtitle: { fontSize: 16, color: colors.onSurfaceSecondary, marginBottom: 40, lineHeight: 24, fontFamily: font.regular },
  
  listContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden", 
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
  },
  listContent: {
    flex: 1,
    justifyContent: "center",
  },
  listRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  listLabel: { fontSize: 18, fontFamily: font.bold, color: colors.onSurface },
  listSub: { fontSize: 15, color: colors.onSurfaceSecondary, marginLeft: 4, fontFamily: font.regular },
  listDesc: { fontSize: 14, color: colors.onSurfaceSecondary, marginTop: 4, fontFamily: font.regular },
  
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 20, // Classic iOS left inset on dividers
  },
  
  badge: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { color: colors.onSurface, fontSize: 12, fontFamily: font.semibold },
  
  continueBtn: { 
    backgroundColor: colors.brandPrimary, 
    height: 56, 
    borderRadius: 28, 
    alignItems: "center", 
    justifyContent: "center",
  },
  continueText: { color: colors.surface, fontSize: 18, fontFamily: font.bold },
});
