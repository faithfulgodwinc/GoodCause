import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";

import { useSubscription } from "@/src/lib/revenuecat";
import { AppText, Button } from "@/src/components/ui";
import { colors, spacing, radius, shadow } from "@/src/theme";

const FEATURES = [
  { icon: "bar-chart-2", title: "Advanced analytics", desc: "Deep insights into donors and reach" },
  { icon: "layers", title: "Multiple active campaigns", desc: "Run several fundraisers at once" },
  { icon: "zap", title: "AI Campaign Assistant", desc: "Draft stories, titles and budgets" },
  { icon: "users", title: "Advanced supporter management", desc: "Organise and thank your supporters" },
  { icon: "calendar", title: "Scheduled updates", desc: "Plan updates ahead of time" },
  { icon: "grid", title: "Campaign QR kit", desc: "Printable QR codes and share assets" },
];

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { offerings, isSubscribed, purchase, restore, isPurchasing, isRestoring, identityReady, rcEnabled, offeringsError } = useSubscription();
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [confirm, setConfirm] = useState<PurchasesPackage | null>(null);
  const [msg, setMsg] = useState("");

  const packages = offerings?.current?.availablePackages || [];
  const unavailable = !rcEnabled || offeringsError || packages.length === 0;

  React.useEffect(() => {
    if (packages.length && !selected) {
      const annual = packages.find((p) => p.packageType === "ANNUAL") || packages[0];
      setSelected(annual);
    }
  }, [packages.length]);

  const doPurchase = async (pkg: PurchasesPackage) => {
    setConfirm(null); setMsg("");
    try {
      await purchase(pkg);
      setMsg("You're now GoodCause Pro 🎉");
    } catch (e: any) {
      if (e?.userCancelled || String(e).includes("cancel")) return;
      setMsg(e?.message === "identity_not_ready" ? "Please sign in again to purchase." : "Purchase could not be completed.");
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
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable testID="paywall-close" onPress={() => router.back()} style={styles.closeBtn}><Feather name="x" size={22} color="#fff" /></Pressable>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, alignItems: "center" }}>
          <View style={styles.badge}><Feather name="star" size={26} color={colors.onBrandPrimary} /></View>
          <AppText variant="display" color="#fff" style={{ textAlign: "center", marginTop: spacing.lg }}>GoodCause Pro</AppText>
          <AppText variant="body" color="rgba(255,255,255,0.8)" style={{ textAlign: "center", marginTop: spacing.xs }}>
            Powerful tools for serious fundraisers. Donating is always free.
          </AppText>
        </View>

        {isSubscribed ? (
          <View style={styles.activeCard}>
            <Feather name="check-circle" size={20} color={colors.success} />
            <AppText variant="label" color="#fff" style={{ marginLeft: spacing.sm }}>{"You're a Pro member — thank you!"}</AppText>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm }}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <View style={styles.featIcon}><Feather name={f.icon as any} size={16} color={colors.brandSecondary} /></View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <AppText variant="label" color="#fff">{f.title}</AppText>
                <AppText variant="caption" color="rgba(255,255,255,0.7)">{f.desc}</AppText>
              </View>
            </View>
          ))}
        </View>

        {!isSubscribed && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            {unavailable ? (
              <View style={styles.unavailable}>
                <AppText variant="body" color="rgba(255,255,255,0.8)" style={{ textAlign: "center" }}>
                  Subscription options are unavailable right now. Please try again later.
                </AppText>
              </View>
            ) : (
              <>
                {packages.map((p) => {
                  const active = selected?.identifier === p.identifier;
                  return (
                    <Pressable key={p.identifier} testID={`plan-${p.packageType}`} onPress={() => setSelected(p)} style={[styles.plan, active && styles.planActive]}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="title" color="#fff">{p.product.title?.replace(/\(.*\)/, "").trim() || p.packageType}</AppText>
                        <AppText variant="caption" color="rgba(255,255,255,0.7)">{p.product.description || "Full Pro access"}</AppText>
                      </View>
                      <AppText variant="h2" color="#fff">{p.product.priceString}</AppText>
                      <View style={[styles.radio, active && { borderColor: colors.brandSecondary, backgroundColor: colors.brandSecondary }]}>
                        {active ? <Feather name="check" size={12} color="#fff" /> : null}
                      </View>
                    </Pressable>
                  );
                })}
                <Button
                  title="Start GoodCause Pro"
                  onPress={() => selected && (identityReady ? setConfirm(selected) : setMsg("Please sign in again to purchase."))}
                  loading={isPurchasing}
                  disabled={!selected}
                  style={{ marginTop: spacing.lg }}
                  testID="paywall-subscribe"
                />
                <Pressable testID="paywall-restore" onPress={doRestore} style={{ alignItems: "center", marginTop: spacing.md }}>
                  <AppText variant="label" color="rgba(255,255,255,0.85)">{isRestoring ? "Restoring…" : "Restore purchases"}</AppText>
                </Pressable>
              </>
            )}
          </View>
        )}

        {msg ? <AppText variant="caption" color={colors.brandSecondary} style={{ textAlign: "center", marginTop: spacing.md }}>{msg}</AppText> : null}
        {__DEV__ && !unavailable ? (
          <AppText variant="caption" color="rgba(255,255,255,0.5)" style={{ textAlign: "center", marginTop: spacing.md }}>Test mode — purchases are simulated via RevenueCat Test Store.</AppText>
        ) : null}
      </ScrollView>

      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <AppText variant="h2">Confirm subscription</AppText>
            <AppText variant="body" style={{ marginTop: spacing.sm }}>
              Subscribe to GoodCause Pro for {confirm?.product.priceString}? You can cancel anytime.
            </AppText>
            <Button title={`Subscribe ${confirm?.product.priceString || ""}`} onPress={() => confirm && doPurchase(confirm)} style={{ marginTop: spacing.lg }} testID="confirm-subscribe" />
            <Button title="Not now" variant="ghost" onPress={() => setConfirm(null)} style={{ marginTop: spacing.xs }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, alignItems: "flex-end", paddingBottom: spacing.sm },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  badge: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", ...shadow.raised },
  activeCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(45,122,93,0.2)", marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md },
  feature: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.md, padding: spacing.md },
  featIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(224,142,112,0.15)", alignItems: "center", justifyContent: "center" },
  unavailable: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.md, padding: spacing.lg },
  plan: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.md, padding: spacing.lg, borderWidth: 1.5, borderColor: "transparent", marginBottom: spacing.sm },
  planActive: { borderColor: colors.brandSecondary, backgroundColor: "rgba(224,142,112,0.12)" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center", marginLeft: spacing.md },
  confirmBackdrop: { flex: 1, backgroundColor: "rgba(35,33,31,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  confirmCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, width: "100%" },
});
