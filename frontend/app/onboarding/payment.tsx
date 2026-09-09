import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, TypeWriterText } from "@/src/components/ui";
import { colors, font } from "@/src/theme";
import { useSubscription } from "@/src/lib/revenuecat";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function PaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier } = useLocalSearchParams();
  const { availablePackages, purchase, isPurchasing } = useSubscription();
  const [error, setError] = useState("");

  const pkg = availablePackages.find((p) => p.identifier === tier) || availablePackages[0];

  const handlePay = async () => {
    if (!pkg) return;
    setError("");
    try {
      await purchase(pkg);
      router.push("/onboarding/success");
    } catch (e: any) {
      if (!e.userCancelled) {
        setError(e.message || "Payment failed");
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === "android" ? insets.top : 0 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} disabled={isPurchasing}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <AppText style={styles.title}>Seal your promise</AppText>

        {pkg && (
          <View style={styles.receipt}>
            <View style={styles.receiptTop}>
              <View style={styles.iconCircle}>
                <Ionicons name="heart" size={20} color={colors.brandPrimary} />
              </View>
              <View>
                <AppText style={styles.receiptTitle}>GoodCause Community Fund</AppText>
                <AppText style={styles.receiptAmount}>{pkg.product.priceString} <AppText style={styles.receiptSub}>/month</AppText></AppText>
              </View>
            </View>
            
            <View style={styles.receiptBottom}>
              <AppText style={styles.firstContribution}>Your journey begins with</AppText>
              <AppText style={styles.totalValue}>{pkg.product.priceString}</AppText>
            </View>
          </View>
        )}

        <View style={styles.secureSection}>
          <AppText style={styles.secureTitle}>Secured by {Platform.OS === "ios" ? "Apple" : "Google"}</AppText>
          <TypeWriterText 
            style={styles.secureDesc} 
            text={`Your generosity is processed with bank-level encryption by ${Platform.OS === "ios" ? "Apple" : "Google"}. We never hold your details, and you have complete freedom to pause or cancel anytime from your settings.`} 
          />
        </View>

        {error ? <AppText style={styles.error}>{error}</AppText> : null}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Pressable style={styles.payBtn} onPress={handlePay} disabled={isPurchasing || !pkg}>
          {isPurchasing ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <AppText style={styles.payText}>Subscribe {pkg?.product.priceString}</AppText>
          )}
        </Pressable>
        <AppText style={styles.securedBy}>
          <Ionicons name="shield-checkmark" size={12} color={colors.onSurfaceSecondary} /> Secured by {Platform.OS === 'ios' ? 'Apple' : 'Google'}
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 8, alignSelf: "flex-start", marginLeft: -8 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  
  title: { fontSize: 28, fontFamily: font.bold, color: colors.onSurface, marginBottom: 32, letterSpacing: -0.5, lineHeight: 34 },
  
  receipt: {
    backgroundColor: "#e8f7e8", // Very light pastel green from mockup
    borderRadius: 16,
    padding: 24,
    marginBottom: 40,
  },
  receiptTop: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  receiptTitle: { fontSize: 14, fontFamily: font.bold, color: colors.onSurface, marginBottom: 4 },
  receiptAmount: { fontSize: 18, fontFamily: font.bold, color: colors.onSurface },
  receiptSub: { fontSize: 14, fontFamily: font.medium, color: colors.onSurfaceSecondary },
  
  receiptBottom: {},
  firstContribution: { fontSize: 13, color: colors.onSurfaceSecondary, marginBottom: 4 },
  totalValue: { fontSize: 18, fontFamily: font.bold, color: colors.onSurface },
  
  secureSection: { paddingHorizontal: 4 },
  secureTitle: { fontSize: 16, fontFamily: font.bold, color: colors.onSurface, marginBottom: 8 },
  secureDesc: { fontSize: 13, color: colors.onSurfaceSecondary, lineHeight: 20 },
  
  error: { color: colors.error, fontSize: 14, marginTop: 24 },
  
  footer: { paddingHorizontal: 24, paddingTop: 16, backgroundColor: colors.surface, alignItems: "center" },
  payBtn: {
    width: "100%",
    backgroundColor: colors.brandPrimary,
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  payText: { color: colors.surface, fontSize: 16, fontFamily: font.bold },
  securedBy: { fontSize: 12, color: colors.onSurfaceSecondary, fontFamily: font.medium, flexDirection: "row", alignItems: "center" },
});
