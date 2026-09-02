import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSubscription } from "@/src/lib/revenuecat";
import { AppText, Button } from "@/src/components/ui";
import { colors, spacing, radius, shadow } from "@/src/theme";

const FEATURES = [
  { icon: "bar-chart-2", title: "Advanced analytics", desc: "Deep insights into donors, reach and growth" },
  { icon: "layers", title: "Multiple active campaigns", desc: "Run and organize several fundraisers at once" },
  { icon: "zap", title: "AI Campaign Assistant", desc: "Draft high-converting stories, headlines and budgets" },
  { icon: "users", title: "Advanced supporter management", desc: "Export supporter lists and send custom thank-you notes" },
  { icon: "calendar", title: "Scheduled updates", desc: "Plan milestone updates and proof uploads ahead of time" },
  { icon: "grid", title: "Campaign QR kit", desc: "High-res printable QR codes and social share assets" },
];

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { availablePackages, isSubscribed, purchase, restore, isPurchasing, isRestoring } = useSubscription();
  const [selected, setSelected] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);
  const [msg, setMsg] = useState("");

  const packages = availablePackages || [];

  React.useEffect(() => {
    if (packages.length && !selected) {
      const annual = packages.find((p) => p.packageType === "ANNUAL") || packages[0];
      setSelected(annual);
    }
  }, [packages]);

  const doPurchase = async (pkg: any) => {
    setConfirm(null);
    setMsg("");
    try {
      await purchase(pkg);
      setMsg("You're now a GoodCause Pro member! 🎉");
    } catch (e: any) {
      if (e?.userCancelled || String(e).includes("cancel")) return;
      setMsg("Purchase could not be completed.");
    }
  };

  const doRestore = async () => {
    setMsg("");
    try {
      await restore();
      setMsg("Purchases restored.");
    } catch {
      setMsg("Nothing to restore.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceInverse }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignSelf: "center", width: "100%", maxWidth: 580 }}>
          <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable testID="paywall-close" onPress={() => router.back()} style={styles.closeBtn}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
          </View>

        <View style={{ paddingHorizontal: spacing.lg, alignItems: "center" }}>
          <View style={styles.badge}>
            <Feather name="star" size={26} color={colors.onBrandPrimary} />
          </View>
          <AppText variant="display" color="#fff" style={{ textAlign: "center", marginTop: spacing.lg }}>
            GoodCause Pro
          </AppText>
          <AppText variant="body" color="rgba(255,255,255,0.8)" style={{ textAlign: "center", marginTop: spacing.xs }}>
            Powerful tools for serious fundraisers. Donating is always free.
          </AppText>
        </View>

        {isSubscribed ? (
          <View style={styles.activeCard}>
            <Feather name="check-circle" size={20} color={colors.success} />
            <AppText variant="label" color="#fff" style={{ marginLeft: spacing.sm }}>
              {"You're a Pro member — thank you!"}
            </AppText>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm }}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <View style={styles.featIcon}>
                <Feather name={f.icon as any} size={16} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <AppText variant="label" color="#fff">{f.title}</AppText>
                <AppText variant="caption" color="rgba(255,255,255,0.7)">{f.desc}</AppText>
              </View>
            </View>
          ))}
        </View>

        {!isSubscribed && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <View style={{ gap: spacing.sm }}>
              {packages.map((pkg) => {
                const active = selected?.identifier === pkg.identifier;
                const isAnnual = pkg.packageType === "ANNUAL";
                const priceLabel = pkg.product.priceString || (isAnnual ? "$4.99 / yr" : "$0.99 / mo");
                return (
                  <Pressable
                    key={pkg.identifier}
                    testID={`pkg-${pkg.identifier}`}
                    onPress={() => setSelected(pkg)}
                    style={[styles.pkgCard, active && styles.pkgActive]}
                  >
                    <View style={styles.radio}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <View style={styles.rowBetween}>
                        <AppText variant="label" color="#fff">{pkg.product.title}</AppText>
                        {isAnnual ? (
                          <View style={styles.saveBadge}>
                            <AppText variant="caption" color={colors.brandPrimary} style={{ fontWeight: "700", fontSize: 11 }}>
                              SAVE 17%
                            </AppText>
                          </View>
                        ) : null}
                      </View>
                      <AppText variant="caption" color="rgba(255,255,255,0.7)" style={{ marginTop: 2 }}>
                        {pkg.product.description}
                      </AppText>
                    </View>
                    <AppText variant="label" color="#fff" style={{ marginLeft: spacing.sm }}>
                      {priceLabel}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {msg ? (
              <AppText variant="body" color={colors.warning} style={{ textAlign: "center", marginTop: spacing.md }}>
                {msg}
              </AppText>
            ) : null}

            <Button
              title={isPurchasing ? "Processing…" : `Subscribe to ${selected?.product.title || "Pro"}`}
              loading={isPurchasing}
              onPress={() => setConfirm(selected)}
              style={{ marginTop: spacing.lg, backgroundColor: colors.brandPrimary }}
              testID="paywall-subscribe-button"
            />

            <Pressable onPress={doRestore} disabled={isRestoring} style={{ alignSelf: "center", marginTop: spacing.md }}>
              <AppText variant="label" color="rgba(255,255,255,0.7)">
                {isRestoring ? "Restoring…" : "Restore purchases"}
              </AppText>
            </Pressable>

            <AppText variant="caption" color="rgba(255,255,255,0.4)" style={{ textAlign: "center", marginTop: spacing.md }}>
              Cancel anytime in your store subscription settings.
            </AppText>
          </View>
        )}
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <AppText variant="h2" style={{ textAlign: "center" }}>Confirm Subscription</AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginTop: spacing.sm }}>
              Subscribe to {confirm?.product.title} for {confirm?.product.priceString || "the selected plan"}?
            </AppText>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl }}>
              <Button title="Cancel" variant="outline" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
              <Button title="Confirm" onPress={() => doPurchase(confirm)} loading={isPurchasing} style={{ flex: 1, backgroundColor: colors.brandPrimary }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    alignItems: "flex-end",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.raised,
  },
  activeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2, 169, 92, 0.15)",
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  featIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(2, 169, 92, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  pkgCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  pkgActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: "rgba(2, 169, 92, 0.12)",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brandPrimary,
  },
  saveBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
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
    ...shadow.card,
  },
});
