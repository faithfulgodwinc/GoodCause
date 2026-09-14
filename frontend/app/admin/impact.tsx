import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, TextInput, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { AppText, Button, LoadingView } from "@/src/components/ui";
import { formatNaira } from "@/src/format";
import { colors, spacing, radius, font } from "@/src/theme";

export default function AdminImpactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [periodKey, setPeriodKey] = useState("");
  const [apple, setApple] = useState("");
  const [google, setGoogle] = useState("");
  const [reference, setReference] = useState("");
  const [paymentRef, setPaymentRef] = useState("");

  const periods = useQuery({
    queryKey: ["admin", "impact-periods"],
    queryFn: () => api<any[]>("/admin/impact-periods"),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "impact-periods"] });
    qc.invalidateQueries({ queryKey: ["impact"] });
  };
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: any }) =>
      api(path, { method: "POST", body }),
    onSuccess: refresh,
    onError: (error: any) => Alert.alert("Could not complete action", error.message),
  });
  const settlement = useMutation({
    mutationFn: (periodId: string) => api(`/admin/impact-periods/${periodId}/settlement`, {
      method: "PUT",
      body: {
        apple_net_kobo: Math.round(Number(apple || 0) * 100),
        google_net_kobo: Math.round(Number(google || 0) * 100),
        adjustments_kobo: 0,
        reconciliation_reference: reference.trim(),
      },
    }),
    onSuccess: refresh,
    onError: (error: any) => Alert.alert("Settlement not saved", error.message),
  });

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.onSurface} /></Pressable>
        <AppText variant="title">Impact administration</AppText><View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="h2">Create settlement period</AppText>
        <AppText variant="caption" style={styles.help}>Enter figures only from authoritative Apple and Google settlement reports. Amounts below are naira.</AppText>
        <Field label="Period key (for example 2026-09)" value={periodKey} onChangeText={setPeriodKey} />
        <Button title="Create draft" onPress={() => action.mutate({ path: "/admin/impact-periods", body: { period_key: periodKey.trim() } })} disabled={!periodKey.trim()} />

        {periods.isLoading ? <LoadingView /> : periods.data?.map((period) => (
          <View key={period.id} style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}><AppText variant="h2">{period.period_key}</AppText><AppText variant="caption">{period.status}</AppText></View>
              <AppText variant="label">{formatNaira(period.current_impact_kobo || 0)} impact</AppText>
            </View>
            {period.status === "DRAFT" ? (
              <>
                <Field label="Apple net proceeds (₦)" value={apple} onChangeText={setApple} keyboardType="numeric" />
                <Field label="Google net proceeds (₦)" value={google} onChangeText={setGoogle} keyboardType="numeric" />
                <Field label="Private settlement reference" value={reference} onChangeText={setReference} />
                <Button title="Save confirmed settlement" onPress={() => settlement.mutate(period.id)} disabled={!reference.trim()} />
                <Button title="Calculate equal allocations" variant="outline" onPress={() => action.mutate({ path: `/admin/impact-periods/${period.id}/calculate` })} />
              </>
            ) : null}
            {period.status === "CALCULATED" ? <Button title="Approve allocations" onPress={() => Alert.alert("Approve allocations?", "This freezes the settlement and allocation figures.", [{ text: "Cancel", style: "cancel" }, { text: "Approve", onPress: () => action.mutate({ path: `/admin/impact-periods/${period.id}/approve` }) }])} /> : null}
            {period.status === "APPROVED" ? <Button title="Publish transparency report" onPress={() => action.mutate({ path: `/admin/impact-periods/${period.id}/publish` })} /> : null}
            {period.status === "PUBLISHED" ? <Button title="Close completed period" variant="outline" onPress={() => action.mutate({ path: `/admin/impact-periods/${period.id}/close` })} /> : null}
            {period.allocations?.map((allocation: any) => (
              <View key={allocation.id} style={styles.allocation}>
                <View style={{ flex: 1 }}><AppText variant="label">{allocation.campaign_title_snapshot}</AppText><AppText variant="caption">{formatNaira(allocation.amount_kobo)} · {allocation.status}</AppText></View>
                {allocation.status === "ALLOCATED" && ["APPROVED", "PUBLISHED"].includes(period.status) ? (
                  <View style={{ gap: 6 }}>
                    <TextInput value={paymentRef} onChangeText={setPaymentRef} placeholder="Payment ref" style={styles.smallInput} />
                    <Pressable onPress={() => action.mutate({ path: `/admin/impact-allocations/${allocation.id}/paid`, body: { payment_reference: paymentRef.trim() } })}><AppText variant="caption" color={colors.brandPrimary}>Mark paid</AppText></Pressable>
                    <Pressable onPress={() => Alert.alert("Cancel allocation?", "The amount returns to restricted rollover.", [{ text: "Keep", style: "cancel" }, { text: "Cancel allocation", style: "destructive", onPress: () => action.mutate({ path: `/admin/impact-allocations/${allocation.id}/cancel`, body: { reason_code: "PAYOUT_BLOCKED", explanation: "Payout cancelled by administrator after review." } }) }])}><AppText variant="caption" color={colors.error}>Cancel</AppText></Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Field(props: any) {
  return <View style={{ marginTop: spacing.sm }}><AppText variant="caption">{props.label}</AppText><TextInput {...props} style={styles.input} placeholderTextColor={colors.muted} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  content: { padding: spacing.lg, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center", gap: spacing.md },
  help: { color: colors.onSurfaceSecondary, lineHeight: 18 },
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center" },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, color: colors.onSurface, fontFamily: font.regular, marginTop: 4 },
  smallInput: { width: 120, height: 36, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 8, color: colors.onSurface },
  allocation: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm },
});
