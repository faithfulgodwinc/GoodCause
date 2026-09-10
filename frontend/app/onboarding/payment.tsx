import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, TypeWriterText } from "@/src/components/ui";
import { colors, font } from "@/src/theme";
import { useSubscription } from "@/src/lib/revenuecat";
import { useAuth } from "@/src/context/auth";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Stamp ────────────────────────────────────────────────────────────────────

function MemberStamp({
  name,
  picture,
  onLanded,
}: {
  name: string;
  picture?: string | null;
  onLanded: () => void;
}) {
  // stamp drops from y = -120 and scales 1.4 → 1 with a thump
  const translateY = useSharedValue(-140);
  const scale = useSharedValue(1.4);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue("-6deg");

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 60 });
    translateY.value = withDelay(
      200,
      withSequence(
        // drop in
        withSpring(0, { stiffness: 280, damping: 18, mass: 0.9 }),
        // tiny bounce to signal "stamp"
        withSpring(-6, { stiffness: 500, damping: 30 }),
        withSpring(
          0,
          { stiffness: 500, damping: 30 },
          (finished) => {
            if (finished) runOnJS(onLanded)();
          }
        )
      )
    );
    scale.value = withDelay(
      200,
      withSpring(1, { stiffness: 280, damping: 18, mass: 0.9 })
    );
    rotate.value = withDelay(
      200,
      withSpring("-3deg", { stiffness: 280, damping: 18 })
    );
  }, []);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: rotate.value },
    ],
  }));

  return (
    <Animated.View style={[styles.stampWrap, stampStyle]}>
      <View style={styles.stamp}>
        {/* Avatar */}
        <View style={styles.stampAvatarRing}>
          {picture ? (
            <Image source={{ uri: picture }} style={styles.stampAvatar} />
          ) : (
            <View style={styles.stampInitials}>
              <AppText style={styles.stampInitialsText}>
                {getInitials(name)}
              </AppText>
            </View>
          )}
        </View>
        {/* Stamp text */}
        <AppText style={styles.stampMemberText}>MEMBER</AppText>
        <AppText style={styles.stampName} numberOfLines={1}>
          {name}
        </AppText>
        {/* Tick */}
        <View style={styles.stampTick}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      </View>
      {/* Glow shadow underneath */}
      <View style={styles.stampGlow} />
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier } = useLocalSearchParams();
  const { availablePackages, purchase, isPurchasing } = useSubscription();
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [stampLanded, setStampLanded] = useState(false);

  // CTA slides up after stamp lands
  const ctaY = useSharedValue(40);
  const ctaOpacity = useSharedValue(0);

  const handleStampLanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setStampLanded(true);
    ctaY.value = withSpring(0, { stiffness: 240, damping: 22 });
    ctaOpacity.value = withTiming(1, { duration: 320 });
  };

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaY.value }],
  }));

  const pkg =
    availablePackages.find((p) => p.identifier === tier) ||
    availablePackages[0];

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

  const displayName = user?.name ?? "You";
  const picture = user?.picture;

  return (
    <SafeAreaView
      style={[
        styles.container,
        { paddingTop: Platform.OS === "android" ? insets.top : 0 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          disabled={isPurchasing}
        >
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <AppText style={styles.title}>Seal your promise</AppText>

        {/* Card + stamp */}
        {pkg && (
          <View style={styles.cardWrap}>
            {/* The receipt card */}
            <View style={styles.receipt}>
              <View style={styles.receiptTop}>
                <View style={styles.iconCircle}>
                  <Ionicons
                    name="heart"
                    size={20}
                    color={colors.brandPrimary}
                  />
                </View>
                <View>
                  <AppText style={styles.receiptTitle}>
                    GoodCause Community Fund
                  </AppText>
                  <AppText style={styles.receiptAmount}>
                    {pkg.product.priceString}{" "}
                    <AppText style={styles.receiptSub}>/month</AppText>
                  </AppText>
                </View>
              </View>

              <View style={styles.receiptDivider} />

              <View style={styles.receiptBottom}>
                <AppText style={styles.firstContribution}>
                  Your journey begins with
                </AppText>
                <AppText style={styles.totalValue}>
                  {pkg.product.priceString}
                </AppText>
              </View>
            </View>

            {/* Stamp — positioned over the card's top-right */}
            <MemberStamp
              name={displayName}
              picture={picture}
              onLanded={handleStampLanded}
            />
          </View>
        )}

        {/* Security blurb */}
        <View style={styles.secureSection}>
          <AppText style={styles.secureTitle}>
            Secured by {Platform.OS === "ios" ? "Apple" : "Google"}
          </AppText>
          <TypeWriterText
            style={styles.secureDesc}
            text={`Your generosity is processed with bank-level encryption by ${
              Platform.OS === "ios" ? "Apple" : "Google"
            }. We never hold your details, and you can pause or cancel anytime from settings.`}
          />
        </View>

        {error ? (
          <AppText style={styles.error}>{error}</AppText>
        ) : null}
      </View>

      {/* CTA — slides up after stamp lands */}
      <Animated.View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 24) },
          ctaStyle,
        ]}
        pointerEvents={stampLanded ? "auto" : "none"}
      >
        <Pressable
          style={[styles.payBtn, (!pkg || isPurchasing) && styles.payBtnDisabled]}
          onPress={handlePay}
          disabled={isPurchasing || !pkg}
        >
          {isPurchasing ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <AppText style={styles.payText}>
              Subscribe · {pkg?.product.priceString}/mo
            </AppText>
          )}
        </Pressable>

        <AppText style={styles.securedBy}>
          <Ionicons
            name="shield-checkmark"
            size={12}
            color={colors.onSurfaceSecondary}
          />{" "}
          Secured by {Platform.OS === "ios" ? "Apple" : "Google"}
        </AppText>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 8, alignSelf: "flex-start", marginLeft: -8 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },

  title: {
    fontSize: 28,
    fontFamily: font.bold,
    color: colors.onSurface,
    marginBottom: 28,
    letterSpacing: -0.5,
    lineHeight: 34,
  },

  // ── Card + stamp container ──────────────────────────────────────────────────
  cardWrap: {
    marginBottom: 36,
    // Extra space at top so the stamp has room to drop into
    paddingTop: 48,
  },

  receipt: {
    backgroundColor: "#F0FBF4",
    borderRadius: 20,
    padding: 24,
  },
  receiptTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  receiptTitle: {
    fontSize: 14,
    fontFamily: font.bold,
    color: colors.onSurface,
    marginBottom: 2,
  },
  receiptAmount: {
    fontSize: 18,
    fontFamily: font.bold,
    color: colors.onSurface,
  },
  receiptSub: {
    fontSize: 14,
    fontFamily: font.medium,
    color: colors.onSurfaceSecondary,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: "#D8EFE2",
    marginBottom: 20,
  },
  receiptBottom: {},
  firstContribution: {
    fontSize: 13,
    color: colors.onSurfaceSecondary,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 18,
    fontFamily: font.bold,
    color: colors.onSurface,
  },

  // ── Stamp ──────────────────────────────────────────────────────────────────
  stampWrap: {
    position: "absolute",
    top: -4,         // sits just above the card top edge
    right: 20,
    alignItems: "center",
  },
  stamp: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    // Subtle inner border ring like a classic stamp
    borderWidth: 2,
    borderColor: "#22C55E",
    // Drop shadow
    shadowColor: "#14532D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  stampAvatarRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
    overflow: "hidden",
    marginBottom: 4,
  },
  stampAvatar: { width: "100%", height: "100%" },
  stampInitials: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  stampInitialsText: {
    fontSize: 13,
    fontFamily: font.bold,
    color: "#fff",
  },
  stampMemberText: {
    fontSize: 7,
    fontFamily: font.bold,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  stampName: {
    fontSize: 9,
    fontFamily: font.bold,
    color: "#fff",
    letterSpacing: 0.4,
    textAlign: "center",
    maxWidth: 74,
    marginTop: 1,
  },
  stampTick: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#15803D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  stampGlow: {
    width: 60,
    height: 8,
    borderRadius: 8,
    backgroundColor: colors.brandPrimary,
    opacity: 0.18,
    marginTop: 4,
    // blur handled by opacity on Android; on iOS the blur is natural
  },

  // ── Security ───────────────────────────────────────────────────────────────
  secureSection: { paddingHorizontal: 4 },
  secureTitle: {
    fontSize: 16,
    fontFamily: font.bold,
    color: colors.onSurface,
    marginBottom: 8,
  },
  secureDesc: {
    fontSize: 13,
    color: colors.onSurfaceSecondary,
    lineHeight: 20,
  },

  error: { color: colors.error, fontSize: 14, marginTop: 20 },

  // ── Footer / CTA ───────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  payBtn: {
    width: "100%",
    backgroundColor: colors.brandPrimary,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  payBtnDisabled: { opacity: 0.6 },
  payText: {
    color: colors.surface,
    fontSize: 16,
    fontFamily: font.bold,
  },
  securedBy: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    fontFamily: font.medium,
  },
});
