import React from "react";
import {
  Text as RNText,
  TextProps,
  Pressable,
  View,
  ViewStyle,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  TextStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { colors, font, radius, spacing, shadow } from "@/src/theme";

/* ---------------- Text ---------------- */
type Variant =
  | "display" | "h1" | "h2" | "title" | "subtitle" | "body" | "bodyMedium"
  | "label" | "caption" | "button";

const VARIANT: Record<Variant, TextStyle> = {
  display: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: colors.onSurface },
  h1: { fontFamily: font.display, fontSize: 24, lineHeight: 30, color: colors.onSurface },
  h2: { fontFamily: font.displaySemi, fontSize: 20, lineHeight: 26, color: colors.onSurface },
  title: { fontFamily: font.bold, fontSize: 16, lineHeight: 22, color: colors.onSurface },
  subtitle: { fontFamily: font.semibold, fontSize: 14, lineHeight: 20, color: colors.onSurfaceSecondary },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.onSurfaceSecondary },
  bodyMedium: { fontFamily: font.medium, fontSize: 14, lineHeight: 21, color: colors.onSurface },
  label: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18, color: colors.onSurface },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: colors.onSurfaceTertiary },
  button: { fontFamily: font.bold, fontSize: 15, lineHeight: 20 },
};

export function AppText({
  variant = "body",
  color,
  style,
  children,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  return (
    <RNText style={[VARIANT[variant], color ? { color } : null, style]} {...rest}>
      {children}
    </RNText>
  );
}

/* ---------------- Button ---------------- */
type BtnVariant = "primary" | "secondary" | "outline" | "ghost";
export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  style,
  testID,
  small = false,
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  small?: boolean;
}) {
  const isDisabled = disabled || loading;
  const bg =
    variant === "primary" ? colors.brandPrimary
    : variant === "secondary" ? colors.surfaceTertiary
    : "transparent";
  const fg =
    variant === "primary" ? colors.onBrandPrimary
    : variant === "outline" ? colors.brandPrimary
    : colors.onSurface;
  const border = variant === "outline" ? { borderWidth: 1.5, borderColor: colors.brandPrimary } : null;

  return (
    <Pressable
      testID={testID}
      disabled={isDisabled}
      onPress={() => {
        if (isDisabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        small && { height: 40, paddingHorizontal: spacing.lg },
        { backgroundColor: bg },
        border,
        isDisabled && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Feather name={icon} size={18} color={fg} style={{ marginRight: 8 }} /> : null}
          <AppText variant="button" color={fg}>{title}</AppText>
        </View>
      )}
    </Pressable>
  );
}

/* ---------------- Card ---------------- */
export function Card({ children, style, onPress, testID }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string;
}) {
  const inner = <View style={[styles.card, style]}>{children}</View>;
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.9 }}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

/* ---------------- ProgressBar ---------------- */
export function ProgressBar({ percent, color = colors.brandPrimary, height = 8 }: {
  percent: number; color?: string; height?: number;
}) {
  const pct = Math.max(0, Math.min(100, percent || 0));
  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <View style={{ width: `${pct}%`, backgroundColor: color, height, borderRadius: height }} />
    </View>
  );
}

/* ---------------- VerifiedBadge ---------------- */
export function VerifiedBadge({ status, compact = true }: { status?: string; compact?: boolean }) {
  const verified = status === "VERIFIED";
  const inReview = status === "IN_REVIEW" || status === "PENDING";
  const bg = verified ? "#EAF4EF" : inReview ? "#FBF1E0" : colors.surfaceTertiary;
  const fg = verified ? colors.success : inReview ? colors.warning : colors.onSurfaceTertiary;
  const label = verified ? "Verified" : inReview ? "In review" : "Unverified";
  const icon = verified ? "shield" : "clock";
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Feather name={icon as any} size={12} color={fg} />
      <AppText variant="caption" color={fg} style={{ marginLeft: 4 }}>{label}</AppText>
    </View>
  );
}

/* ---------------- Chip ---------------- */
export function Chip({ label, active, onPress, testID }: {
  label: string; active?: boolean; onPress?: () => void; testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={[styles.chip, active ? styles.chipActive : null]}
    >
      <AppText variant="label" color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary}>
        {label}
      </AppText>
    </Pressable>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({ name, uri, size = 40 }: { name?: string; uri?: string | null; size?: number }) {
  const initials = (name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  if (uri) {
    return <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: colors.surfaceTertiary }}>
      <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={200} />
    </View>;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
      <AppText variant="label" color={colors.onBrandTertiary}>{initials}</AppText>
    </View>
  );
}

/* ---------------- EmptyState ---------------- */
export function EmptyState({ icon = "inbox", title, message, actionLabel, onAction, testID }: {
  icon?: keyof typeof Feather.glyphMap; title: string; message?: string;
  actionLabel?: string; onAction?: () => void; testID?: string;
}) {
  return (
    <View style={styles.empty} testID={testID}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={26} color={colors.brandPrimary} />
      </View>
      <AppText variant="h2" style={{ marginTop: spacing.lg, textAlign: "center" }}>{title}</AppText>
      {message ? <AppText variant="body" style={{ marginTop: spacing.sm, textAlign: "center", maxWidth: 300 }}>{message}</AppText> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={{ marginTop: spacing.lg, alignSelf: "center", paddingHorizontal: spacing.xl }} />
      ) : null}
    </View>
  );
}

/* ---------------- Loading / Error ---------------- */
export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
      {label ? <AppText variant="caption" style={{ marginTop: spacing.md }}>{label}</AppText> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Feather name="cloud-off" size={28} color={colors.onSurfaceTertiary} />
      <AppText variant="subtitle" style={{ marginTop: spacing.md, textAlign: "center" }}>
        {message || "Something went wrong."}
      </AppText>
      {onRetry ? <Button title="Try again" variant="outline" small onPress={onRetry} style={{ marginTop: spacing.md }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  btnRow: { flexDirection: "row", alignItems: "center" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  track: { width: "100%", backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
});
