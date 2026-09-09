import React from "react";
import { View, StyleSheet, Pressable, Platform, ImageBackground } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, TypeWriterText } from "@/src/components/ui";
import { colors, font } from "@/src/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const TIER_AMOUNTS: Record<string, string> = {
  tier_1k: "₦1,000",
  tier_2k5: "₦2,500",
  tier_5k: "₦5,000",
  tier_10k: "₦10,000",
};

export default function ModelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier } = useLocalSearchParams();
  
  const tierString = typeof tier === "string" && TIER_AMOUNTS[tier] ? TIER_AMOUNTS[tier] : "₦5,000";

  const handleContinue = () => {
    router.push({ pathname: "/onboarding/auth", params: { tier } });
  };

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={require("../../assets/images/onboarding/slide3.jpg")} 
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["rgba(8,10,12,0.0)", "rgba(8,10,12,0.4)", "#080a0c", "#080a0c"]}
        locations={[0, 0.3, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: Platform.OS === "android" ? insets.top + 12 : insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.surface} />
        </Pressable>
      </View>

      <View style={[styles.contentWrapper, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <AppText style={styles.titleGreen}>{tierString}</AppText>
        <AppText style={styles.titleWhite}>creates a lifeline.</AppText>
        
        <TypeWriterText 
          style={styles.subtitle}
          delay={30}
          text="Your monthly giving pools together with thousands of others to fund verified medical and food campaigns. Every ₦1,000 has a home."
        />

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="calendar-outline" size={20} color={colors.brandPrimary} />
          </View>
          <View style={styles.cardText}>
            <AppText style={styles.cardLabel}>Your monthly promise</AppText>
            <View style={styles.cardAmountRow}>
              <AppText style={styles.cardAmount}>{tierString}</AppText>
              <AppText style={styles.cardSub}> /month</AppText>
            </View>
            <AppText style={styles.cardFooter}>You are always in control. Pause or cancel your giving whenever you need.</AppText>
          </View>
        </View>

        <AppText style={styles.howItWorksTitle}>How it works</AppText>
        
        <View style={styles.stepsRow}>
          <View style={styles.stepCol}>
            <View style={styles.stepIconBox}>
              <Ionicons name="heart-outline" size={16} color={colors.brandPrimary} />
            </View>
            <AppText style={styles.stepNum}>01</AppText>
            <AppText style={styles.stepTitle}>You care</AppText>
            <AppText style={styles.stepDesc}>You step forward with a gift from the heart.</AppText>
          </View>
          
          <View style={styles.stepCol}>
            <View style={styles.stepIconBox}>
              <Ionicons name="git-merge-outline" size={16} color={colors.brandPrimary} />
            </View>
            <AppText style={styles.stepNum}>02</AppText>
            <AppText style={styles.stepTitle}>We combine</AppText>
            <AppText style={styles.stepDesc}>It joins thousands of others in the pool.</AppText>
          </View>
          
          <View style={styles.stepCol}>
            <View style={styles.stepIconBox}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.brandPrimary} />
            </View>
            <AppText style={styles.stepNum}>03</AppText>
            <AppText style={styles.stepTitle}>We uplift</AppText>
            <AppText style={styles.stepDesc}>Together, we fund urgent, verified needs.</AppText>
          </View>
        </View>

        <Pressable style={styles.continueBtn} onPress={handleContinue}>
          <AppText style={styles.continueText}>Become a GoodCause</AppText>
          <Ionicons name="arrow-forward" size={20} color={colors.surface} style={{ marginLeft: 8 }} />
        </Pressable>
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
  
  titleGreen: { fontSize: 32, fontFamily: font.bold, color: colors.brandPrimary, letterSpacing: -1, lineHeight: 36 },
  titleWhite: { fontSize: 32, fontFamily: font.bold, color: colors.surface, marginBottom: 8, letterSpacing: -1, lineHeight: 36 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 20, lineHeight: 20 },
  
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 12, color: colors.onSurfaceSecondary, fontFamily: font.medium, marginBottom: 2 },
  cardAmountRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 4 },
  cardAmount: { fontSize: 20, fontFamily: font.bold, color: colors.onSurface },
  cardSub: { fontSize: 12, color: colors.onSurfaceSecondary, fontFamily: font.medium },
  cardFooter: { fontSize: 11, color: colors.onSurfaceSecondary, lineHeight: 16 },
  
  howItWorksTitle: { fontSize: 14, fontFamily: font.bold, color: colors.surface, marginBottom: 12 },
  stepsRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 24 },
  stepCol: { flex: 1 },
  stepIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  stepNum: { fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: font.bold, marginBottom: 2 },
  stepTitle: { fontSize: 12, color: colors.surface, fontFamily: font.bold, marginBottom: 4 },
  stepDesc: { fontSize: 10, color: "rgba(255,255,255,0.6)", lineHeight: 14 },
  
  continueBtn: { 
    backgroundColor: colors.brandPrimary, 
    height: 56, 
    borderRadius: 28, 
    flexDirection: "row",
    alignItems: "center", 
    justifyContent: "center" 
  },
  continueText: { color: colors.surface, fontSize: 16, fontFamily: font.bold },
});
