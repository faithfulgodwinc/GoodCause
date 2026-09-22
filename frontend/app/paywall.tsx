import React, { useState, useRef, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSubscription } from "@/src/lib/revenuecat";
import { AppText, Button } from "@/src/components/ui";
import { colors, spacing, radius, shadow, font } from "@/src/theme";
import { IMPACT_DISCLOSURE_COMPACT } from "@/src/constants/impact-commitment";

// ─── Feature list ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "bar-chart-2",
    title: "Advanced analytics",
    desc: "Deep insights into donors, reach and growth trends",
  },
  {
    icon: "layers",
    title: "Multiple active campaigns",
    desc: "Run and organize several fundraisers simultaneously",
  },
  {
    icon: "zap",
    title: "AI Campaign Assistant",
    desc: "Draft high-converting stories, headlines and budgets",
  },
  {
    icon: "users",
    title: "Advanced supporter management",
    desc: "Export lists and send custom personalised thank-you notes",
  },
  {
    icon: "calendar",
    title: "Scheduled updates",
    desc: "Plan milestone updates and proof uploads ahead of time",
  },
  {
    icon: "grid",
    title: "Campaign QR kit",
    desc: "High-res printable QR codes and social share assets",
  },
];

// ─── Animated feature row ─────────────────────────────────────────────────────

function FeatureRow({
  icon,
  title,
  desc,
  delay,
}: {
  icon: string;
  title: string;
  desc: string;
  delay: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.feature, { opacity, transform: [{ translateX }] }]}>
      <View style={styles.featIcon}>
        <Feather name={icon as any} size={16} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <AppText variant="label" color="#fff">
          {title}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.65)">
          {desc}
        </AppText>
      </View>
      <Feather name="check" size={14} color={colors.brandPrimary} />
    </Animated.View>
  );
}

// ─── Main paywall screen ──────────────────────────────────────────────────────

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    availablePackages,
    isSubscribed,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
  } = useSubscription();

  const [selected, setSelected] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);
  const [msg, setMsg] = useState("");
  // Header entrance animation
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerScale = useRef(new Animated.Value(0.85)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;

  const packages = availablePackages || [];

  useEffect(() => {
    if (packages.length && !selected) {
      const annual = packages.find((p) => p.packageType === "ANNUAL") || packages[0];
      setSelected(annual);
    }
  }, [packages]);

  // Header animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(headerScale, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Badge pulse loop
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(badgePulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const doPurchase = async (pkg: any) => {
    setConfirm(null);
    setMsg("");
    try {
      await purchase(pkg);
      setMsg("You're now a GoodCause Pro member! 🎉");
    } catch (e: any) {
      if (e?.userCancelled || String(e).includes("cancel")) return;
      setMsg("Purchase could not be completed. Please try again.");
    }
  };

  const doRestore = async () => {
    setMsg("");
    try {
      await restore();
      setMsg("Purchases restored successfully.");
    } catch {
      setMsg("Nothing to restore.");
    }
  };

  // Determine CTA label
  const selectedHasTrial =
    selected?.product?.introPrice?.periodNumberOfUnits > 0 ||
    selected?.product?.introPrice?.price === 0;

  const ctaLabel = isPurchasing
    ? "Processing…"
    : selectedHasTrial
    ? `Start free trial`
    : `Subscribe — ${selected?.product?.priceString || ""}`;

  if (Platform.OS === "ios") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, padding: spacing.lg, justifyContent: "center" }}>
        <View style={{ alignSelf: "center", width: "100%", maxWidth: 420, alignItems: "center" }}>
          <Feather name="star" size={36} color={colors.brandPrimary} />
          <AppText variant="h1" style={{ textAlign: "center", marginTop: spacing.md }}>
            GoodCause is free on iOS
          </AppText>
          <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: spacing.sm }}>
            In-app membership purchases are unavailable on iPhone and iPad while we update the program.
          </AppText>
          <Button
            title="Continue"
            onPress={() => router.back()}
            style={{ marginTop: spacing.xl, alignSelf: "stretch" }}
            testID="ios-paywall-continue"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#161514" }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignSelf: "center", width: "100%", maxWidth: 580 }}>
          {/* ── Header ── */}
          <View
            style={[
              styles.headerGradient,
              { paddingTop: insets.top + spacing.sm },
            ]}
          >
            {/* Close button */}
            <View style={styles.headerTopRow}>
              <Pressable
                testID="paywall-close"
                onPress={() => router.back()}
                style={styles.closeBtn}
              >
                <Feather name="x" size={20} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>

            {/* Badge + title */}
            <Animated.View
              style={[
                styles.heroBlock,
                { opacity: headerOpacity, transform: [{ scale: headerScale }] },
              ]}
            >
              <Animated.View
                style={[styles.badge, { transform: [{ scale: badgePulse }] }]}
              >
                <Feather name="star" size={26} color="#fff" />
              </Animated.View>

              <AppText
                variant="display"
                color="#fff"
                style={styles.proTitle}
              >
                GoodCause Pro
              </AppText>

              <AppText
                variant="body"
                color="rgba(255,255,255,0.7)"
                style={styles.proSubtitle}
              >
                Powerful membership tools—and a transparent commitment to verified causes.
              </AppText>

              {/* Social proof */}
              <View style={styles.socialProof}>
                <View style={styles.avatarStack}>
                  {["#C05C3D", "#2D7A5D", "#4A6E82"].map((c, i) => (
                    <View
                      key={i}
                      style={[
                        styles.proofAvatar,
                        { backgroundColor: c, marginLeft: i === 0 ? 0 : -8 },
                      ]}
                    />
                  ))}
                </View>
                <AppText
                  variant="caption"
                  color="rgba(255,255,255,0.65)"
                  style={{ marginLeft: spacing.sm, fontSize: 12 }}
                >
                  Membership that powers tools and impact
                </AppText>
              </View>
            </Animated.View>
          </View>

          {/* ── Already subscribed banner ── */}
          {isSubscribed ? (
            <View style={styles.activeCard}>
              <Feather name="check-circle" size={18} color="#2D7A5D" />
              <AppText
                variant="label"
                color="#fff"
                style={{ marginLeft: spacing.sm }}
              >
                {"You're a Pro member — thank you!"}
              </AppText>
            </View>
          ) : null}

          {/* ── Feature list ── */}
          <View style={styles.section}>
            <AppText
              variant="label"
              color="rgba(255,255,255,0.45)"
              style={styles.sectionLabel}
            >
              WHAT YOU GET
            </AppText>
            <View style={{ gap: spacing.sm }}>
              {FEATURES.map((f, i) => (
                <FeatureRow
                  key={f.title}
                  icon={f.icon}
                  title={f.title}
                  desc={f.desc}
                  delay={120 + i * 65}
                />
              ))}
            </View>
          </View>

          {/* ── Pricing packages ── */}
          {!isSubscribed && (
            <View style={styles.section}>
              <AppText
                variant="label"
                color="rgba(255,255,255,0.45)"
                style={styles.sectionLabel}
              >
                CHOOSE YOUR PLAN
              </AppText>

              <View style={{ gap: spacing.sm }}>
                {packages.map((pkg) => {
                  const active = selected?.identifier === pkg.identifier;
                  const isAnnual = pkg.packageType === "ANNUAL";
                  const priceLabel =
                    pkg.product.priceString ||
                    (isAnnual ? "$4.99 / yr" : "$0.99 / mo");

                  return (
                    <Pressable
                      key={pkg.identifier}
                      testID={`pkg-${pkg.identifier}`}
                      onPress={() => setSelected(pkg)}
                      style={[styles.pkgCard, active && styles.pkgActive]}
                    >
                      {/* Left: radio + labels */}
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active ? <View style={styles.radioDot} /> : null}
                      </View>

                      <View style={{ flex: 1, marginLeft: spacing.md }}>
                        <View style={styles.rowBetween}>
                          <AppText variant="label" color="#fff">
                            {pkg.product.title}
                          </AppText>
                          {isAnnual ? (
                            <View style={styles.popularBadge}>
                              <AppText
                                variant="caption"
                                style={{
                                  color: colors.brandPrimary,
                                  fontFamily: font.bold,
                                  fontSize: 10,
                                  letterSpacing: 0.4,
                                }}
                              >
                                MOST POPULAR
                              </AppText>
                            </View>
                          ) : null}
                        </View>

                        <AppText
                          variant="caption"
                          color="rgba(255,255,255,0.6)"
                          style={{ marginTop: 2 }}
                        >
                          {pkg.product.description}
                          {isAnnual ? " · Save 17%" : ""}
                        </AppText>
                      </View>

                      <AppText
                        variant="label"
                        color={active ? colors.brandPrimary : "#fff"}
                        style={{ marginLeft: spacing.md, fontFamily: font.bold }}
                      >
                        {priceLabel}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>

              {/* Status message */}
              {msg ? (
                <AppText
                  variant="body"
                  color={msg.includes("member") || msg.includes("restored") ? "#2D7A5D" : colors.warning}
                  style={{ textAlign: "center", marginTop: spacing.md }}
                >
                  {msg}
                </AppText>
              ) : null}

              <AppText variant="caption" color="rgba(255,255,255,0.72)" style={{ textAlign: "center", marginBottom: spacing.xs }}>
                {IMPACT_DISCLOSURE_COMPACT}
              </AppText>
              <Pressable onPress={() => router.push("/impact-commitment")} style={{ alignSelf: "center", marginBottom: spacing.sm }}>
                <AppText variant="caption" color={colors.brandPrimary}>Learn how it works</AppText>
              </Pressable>

              {/* CTA */}
              <Pressable
                onPress={() => setConfirm(selected)}
                disabled={isPurchasing || !selected}
                style={({ pressed }) => [
                  styles.ctaBtn,
                  pressed && { opacity: 0.88 },
                  (isPurchasing || !selected) && { opacity: 0.5 },
                ]}
                testID="paywall-subscribe-button"
              >
                {isPurchasing ? (
                  <AppText variant="button" color="#fff" style={{ fontSize: 15 }}>
                    Processing…
                  </AppText>
                ) : (
                  <>
                    <Feather
                      name="star"
                      size={16}
                      color="#fff"
                      style={{ marginRight: spacing.sm }}
                    />
                    <AppText
                      variant="button"
                      color="#fff"
                      style={{ fontSize: 15, fontFamily: font.semibold }}
                    >
                      {ctaLabel}
                    </AppText>
                  </>
                )}
              </Pressable>

              {/* Restore */}
              <Pressable
                onPress={doRestore}
                disabled={isRestoring}
                style={{ alignSelf: "center", marginTop: spacing.md, padding: spacing.sm }}
              >
                <AppText variant="label" color="rgba(255,255,255,0.45)">
                  {isRestoring ? "Restoring…" : "Restore purchases"}
                </AppText>
              </Pressable>

              <AppText
                variant="caption"
                color="rgba(255,255,255,0.3)"
                style={{ textAlign: "center", marginTop: spacing.sm }}
              >
                Cancel anytime in your store subscription settings.
              </AppText>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Confirmation Modal ── */}
      <Modal
        visible={!!confirm}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirm(null)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalBadge}>
              <Feather name="star" size={20} color={colors.brandPrimary} />
            </View>
            <AppText variant="h2" style={{ textAlign: "center", marginTop: spacing.md }}>
              Confirm Subscription
            </AppText>
            <AppText
              variant="body"
              color={colors.onSurfaceSecondary}
              style={{ textAlign: "center", marginTop: spacing.sm }}
            >
              Subscribe to{" "}
              <AppText variant="bodyMedium" color={colors.onSurface}>
                {confirm?.product?.title}
              </AppText>{" "}
              for{" "}
              <AppText variant="bodyMedium" color={colors.onSurface}>
                {confirm?.product?.priceString || "the selected plan"}
              </AppText>
              ?
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: spacing.sm }}>
              {IMPACT_DISCLOSURE_COMPACT}
            </AppText>
            <View
              style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl }}
            >
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setConfirm(null)}
                style={{ flex: 1 }}
              />
              <Button
                title="Confirm"
                onPress={() => doPurchase(confirm)}
                loading={isPurchasing}
                style={{ flex: 1, backgroundColor: colors.brandPrimary }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerGradient: {
    backgroundColor: "#1E1C1A",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    paddingBottom: spacing.xl,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBlock: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.raised,
  },
  proTitle: {
    fontSize: 28,
    letterSpacing: -0.6,
    marginTop: spacing.lg,
    textAlign: "center",
    fontFamily: font.bold,
  },
  proSubtitle: {
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 22,
    fontSize: 14,
  },
  socialProof: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  proofAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#161514",
  },
  activeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(45, 122, 93, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(45, 122, 93, 0.3)",
    padding: spacing.md,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    fontFamily: font.semibold,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  featIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(192, 92, 61, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  pkgCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  pkgActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: "rgba(192, 92, 61, 0.10)",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: colors.brandPrimary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brandPrimary,
  },
  popularBadge: {
    backgroundColor: "rgba(192, 92, 61, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(192, 92, 61, 0.3)",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
    marginRight: spacing.sm,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandPrimary,
    height: 52,
    borderRadius: radius.md,
    marginTop: spacing.xl,
    ...shadow.raised,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    ...shadow.card,
  },
  modalBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(192, 92, 61, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
});
