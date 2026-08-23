import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/src/theme";
import { AppText } from "@/src/components/ui";

type Checks = {
  identity?: boolean;
  beneficiary?: boolean;
  documents?: boolean;
  relationship?: boolean;
  updates_enabled?: boolean;
};

const LABELS: { key: keyof Checks; label: string }[] = [
  { key: "identity", label: "Organizer identity reviewed" },
  { key: "beneficiary", label: "Beneficiary information reviewed" },
  { key: "documents", label: "Supporting documentation reviewed" },
  { key: "relationship", label: "Organizer/beneficiary relationship declared" },
  { key: "updates_enabled", label: "Campaign updates enabled" },
];

export function TrustCard({
  status,
  checks,
  campaignAgeDays,
  updatesCount,
  relationship,
  onReport,
}: {
  status?: string;
  checks?: Checks;
  campaignAgeDays?: number | null;
  updatesCount?: number;
  relationship?: string;
  onReport?: () => void;
}) {
  const verified = status === "VERIFIED";
  return (
    <View style={styles.wrap} testID="trust-card">
      <View style={styles.header}>
        <View style={styles.shield}>
          <Feather name="shield" size={18} color={colors.onBrandPrimary} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <AppText variant="title">{verified ? "GoodCause Verified" : "Verification in progress"}</AppText>
          <AppText variant="caption" style={{ marginTop: 2 }}>Verification checks completed — not a guarantee</AppText>
        </View>
      </View>

      <View style={styles.checks}>
        {LABELS.map(({ key, label }) => {
          const done = !!checks?.[key];
          return (
            <View key={key} style={styles.checkRow}>
              <Feather
                name={done ? "check-circle" : "circle"}
                size={16}
                color={done ? colors.success : colors.borderStrong}
              />
              <AppText
                variant="body"
                color={done ? colors.onSurface : colors.onSurfaceTertiary}
                style={{ marginLeft: spacing.sm, flex: 1 }}
              >
                {label}
              </AppText>
            </View>
          );
        })}
      </View>

      <View style={styles.metaRow}>
        <Meta icon="calendar" label="Campaign age" value={campaignAgeDays != null ? `${campaignAgeDays} days` : "—"} />
        <Meta icon="message-square" label="Updates" value={String(updatesCount ?? 0)} />
        <Meta icon="user-check" label="Relationship" value={relationship || "—"} />
      </View>

      <View style={styles.note}>
        <Feather name="info" size={13} color={colors.info} />
        <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ marginLeft: 6, flex: 1 }}>
          GoodCause reviews information provided but does not guarantee any campaign. Give with care.
        </AppText>
      </View>

      {onReport ? (
        <View style={styles.reportRow}>
          <Feather name="flag" size={13} color={colors.error} />
          <AppText testID="report-campaign-btn" onPress={onReport} variant="label" color={colors.error} style={{ marginLeft: 6 }}>
            Report this campaign
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function Meta({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Feather name={icon} size={14} color={colors.onSurfaceTertiary} />
      <AppText variant="caption" style={{ marginTop: 4 }}>{label}</AppText>
      <AppText variant="label" style={{ marginTop: 2 }} numberOfLines={1}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  header: { flexDirection: "row", alignItems: "center" },
  shield: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  checks: { marginTop: spacing.lg, gap: spacing.sm },
  checkRow: { flexDirection: "row", alignItems: "center" },
  metaRow: {
    flexDirection: "row", marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md,
  },
  meta: { flex: 1, alignItems: "flex-start" },
  note: {
    flexDirection: "row", alignItems: "flex-start", marginTop: spacing.md, backgroundColor: colors.surfaceTertiary,
    padding: spacing.md, borderRadius: radius.md,
  },
  reportRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, justifyContent: "center" },
});
