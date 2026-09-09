import React, { useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, TypeWriterText } from "@/src/components/ui";
import { colors, font } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { useSubscription } from "@/src/lib/revenuecat";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const ONBOARDING_DONE_KEY = "gc_onboarding_done";

export default function SuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier } = useLocalSearchParams();
  const { availablePackages } = useSubscription();
  
  const pkg = availablePackages.find((p) => p.identifier === tier) || availablePackages[0];

  useEffect(() => {
    storage.setItem(ONBOARDING_DONE_KEY, true);
  }, []);

  const handleFinish = () => {
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        
        <View style={styles.successHeader}>
          {/* Confetti decorations can go here, using simple icons for now */}
          <Ionicons name="sparkles" size={24} color={colors.brandPrimary} style={styles.sparkleLeft} />
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={32} color={colors.surface} />
          </View>
          <Ionicons name="sparkles" size={16} color={colors.brandPrimary} style={styles.sparkleRight} />
        </View>

        <AppText style={styles.title}>Welcome home. ❤️</AppText>
        <TypeWriterText 
          style={styles.subtitle} 
          text="You just made a promise to catch someone when they fall. Somewhere in Nigeria, a life is about to change because of you." 
        />

        {pkg && (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name="calendar-outline" size={20} color={colors.brandPrimary} />
            </View>
            <View>
              <AppText style={styles.cardAmount}>{pkg.product.priceString} <AppText style={styles.cardSub}>/month</AppText></AppText>
              <AppText style={styles.cardDesc}>Your monthly commitment</AppText>
            </View>
          </View>
        )}

        <View style={styles.quoteBox}>
          {/* Using italic standard font as a fallback for the cursive font in mockup */}
          <AppText style={styles.quoteText}>
            "You don't always have to know whose life you're saving. You just have to know you saved one."
          </AppText>
        </View>

      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Pressable style={styles.btn} onPress={handleFinish}>
          <AppText style={styles.btnText}>See the lives you'll touch</AppText>
        </Pressable>
        <Pressable onPress={handleFinish} style={styles.secondaryBtn}>
          <AppText style={styles.secondaryBtnText}>See how GoodCause works</AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface }, // Very light pastel green from mockup
  content: { flex: 1, paddingHorizontal: 24, alignItems: "center", paddingTop: 40 },
  
  successHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 32, position: "relative" },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  sparkleLeft: { position: "absolute", left: -40, top: 10, opacity: 0.6, transform: [{ rotate: "-15deg" }] },
  sparkleRight: { position: "absolute", right: -30, bottom: 0, opacity: 0.6, transform: [{ rotate: "15deg" }] },
  
  title: { fontSize: 32, fontFamily: font.bold, color: colors.onSurface, textAlign: "center", marginBottom: 16, letterSpacing: -0.5, lineHeight: 38 },
  subtitle: { fontSize: 14, color: colors.onSurfaceSecondary, textAlign: "center", marginBottom: 40, lineHeight: 22, paddingHorizontal: 16 },
  
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 16,
    width: "100%",
    marginBottom: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eef8ef",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  cardAmount: { fontSize: 18, fontFamily: font.bold, color: colors.onSurface, marginBottom: 2 },
  cardSub: { fontSize: 12, fontFamily: font.medium, color: colors.onSurfaceSecondary },
  cardDesc: { fontSize: 12, color: colors.onSurfaceSecondary },
  
  quoteBox: { paddingHorizontal: 32 },
  quoteText: { 
    fontSize: 20, 
    fontFamily: font.medium, 
    fontStyle: "italic", 
    color: colors.brandPrimary, 
    textAlign: "center", 
    lineHeight: 28 
  },
  
  footer: { paddingHorizontal: 24, alignItems: "center" },
  btn: {
    width: "100%",
    height: 56,
    backgroundColor: colors.brandPrimary,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  btnText: { color: colors.surface, fontSize: 16, fontFamily: font.bold },
  secondaryBtn: { paddingVertical: 8 },
  secondaryBtnText: { color: colors.onSurfaceSecondary, fontSize: 12, fontFamily: font.medium },
});
