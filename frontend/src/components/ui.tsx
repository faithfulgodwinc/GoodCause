import React, { useState, useEffect } from "react";
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
  Animated,
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
  display: { fontFamily: font.display, fontSize: 26, lineHeight: 32, color: colors.onSurface, letterSpacing: -0.5 },
  h1: { fontFamily: font.display, fontSize: 22, lineHeight: 28, color: colors.onSurface, letterSpacing: -0.4 },
  h2: { fontFamily: font.displaySemi, fontSize: 18, lineHeight: 24, color: colors.onSurface, letterSpacing: -0.3 },
  title: { fontFamily: font.bold, fontSize: 15, lineHeight: 21, color: colors.onSurface, letterSpacing: -0.2 },
  subtitle: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18, color: colors.onSurfaceSecondary },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colors.onSurfaceSecondary },
  bodyMedium: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: colors.onSurface },
  label: { fontFamily: font.semibold, fontSize: 13, lineHeight: 17, color: colors.onSurface },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: colors.onSurfaceTertiary },
  button: { fontFamily: font.semibold, fontSize: 14, lineHeight: 18, letterSpacing: -0.1 },
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
    : variant === "outline" ? colors.onSurface
    : colors.onSurface;
  const border = variant === "outline" ? { borderWidth: 1, borderColor: colors.borderStrong } : null;

  return (
    <Pressable
      testID={testID}
      disabled={isDisabled}
      onPress={() => {
        if (isDisabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        small && { height: 38, paddingHorizontal: spacing.md, borderRadius: radius.sm },
        { backgroundColor: bg },
        border,
        isDisabled && { opacity: 0.4 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Feather name={icon} size={16} color={fg} style={{ marginRight: 6 }} /> : null}
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
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.92 }}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

/* ---------------- ProgressBar ---------------- */
export function ProgressBar({ percent, color = colors.brandPrimary, height = 4 }: {
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
  if (!verified && !inReview) return null;
  const fg = verified ? colors.brandPrimary : colors.warning;
  const label = verified ? "Verified" : "Pending";
  const icon = verified ? "shield" : "clock";
  return (
    <View style={styles.badge}>
      <Feather name={icon as any} size={11} color={fg} />
      <AppText variant="caption" color={fg} style={{ marginLeft: 3, fontSize: 11, fontWeight: "600" }}>{label}</AppText>
    </View>
  );
}

/* ---------------- CommunityBackedBadge ---------------- */
export function CommunityBackedBadge({ supportersCount }: { supportersCount?: number }) {
  return (
    <View style={styles.badge}>
      <Feather name="users" size={11} color={colors.brandPrimary} />
      <AppText variant="caption" color={colors.brandPrimary} style={{ marginLeft: 3, fontSize: 10.5, fontWeight: "700" }}>
        Community Backed
      </AppText>
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
      <AppText
        variant="caption"
        color={active ? "#FFFFFF" : colors.onSurfaceSecondary}
        style={{ fontWeight: active ? "600" : "500", fontSize: 13 }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({ name, uri, size = 36 }: { name?: string; uri?: string | null; size?: number }) {
  const initials = (name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  if (uri) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: colors.surfaceTertiary }}>
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" }}>
      <AppText variant="caption" color={colors.onSurface} style={{ fontWeight: "600", fontSize: size * 0.38 }}>{initials}</AppText>
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
        <Feather name={icon} size={22} color={colors.onSurfaceSecondary} />
      </View>
      <AppText variant="h2" style={{ marginTop: spacing.md, textAlign: "center" }}>{title}</AppText>
      {message ? <AppText variant="body" style={{ marginTop: spacing.xs, textAlign: "center", maxWidth: 280 }}>{message}</AppText> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} small style={{ marginTop: spacing.md }} />
      ) : null}
    </View>
  );
}

/* ---------------- BrandLogo ---------------- */
export function BrandLogo({
  size = 24,
  color = colors.onSurface,
  style,
}: {
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <RNText
      style={[
        {
          fontFamily: font.display || "Inter-Bold",
          fontSize: size,
          fontWeight: "800",
          letterSpacing: -0.6,
          color: color,
        },
        style,
      ]}
    >
      goodcause
    </RNText>
  );
}

/* ---------------- Loading / Error / Preloader ---------------- */
export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="small" color={colors.brandPrimary} />
      {label ? (
        <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ marginTop: spacing.sm }}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

export function FirstTimePreloader({ message = "Setting up your GoodCause account..." }: { message?: string }) {
  const pulseAnim = React.useRef(new Animated.Value(0.92)).current;
  const opacityAnim = React.useRef(new Animated.Value(0.4)).current;
  const ringScale = React.useRef(new Animated.Value(0.8)).current;
  const ringOpacity = React.useRef(new Animated.Value(0.6)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(ringScale, {
            toValue: 1.25,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.15,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.92,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.7,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(ringScale, {
            toValue: 0.8,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.6,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, opacityAnim, ringScale, ringOpacity]);

  return (
    <View style={styles.preloaderContainer}>
      <View style={styles.preloaderContent}>
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
            }}
          >
            <BrandLogo size={42} />
          </Animated.View>
        <AppText
          variant="subtitle"
          color={colors.onSurfaceSecondary}
          style={{ marginTop: spacing.md, textAlign: "center" }}
        >
          {message}
        </AppText>
      </View>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Feather name="cloud-off" size={24} color={colors.onSurfaceTertiary} />
      <AppText variant="subtitle" style={{ marginTop: spacing.sm, textAlign: "center" }}>
        {message || "Something went wrong."}
      </AppText>
      {onRetry ? <Button title="Try again" variant="outline" small onPress={onRetry} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 46,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnRow: { flexDirection: "row", alignItems: "center" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  track: { width: "100%", backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  communityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(2, 169, 92, 0.08)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(2, 169, 92, 0.2)",
  },
  chip: {
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: {
    backgroundColor: colors.onSurface,
    borderColor: colors.onSurface,
  },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  progressFill: { height: "100%", borderRadius: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  preloaderContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  preloaderContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
});

// ─── TypeWriterText ─────────────────────────────────────────────────────────────

export function TypeWriterText({ 
  text, 
  delay = 25, 
  start = true, 
  onComplete,
  style, 
  ...props 
}: { 
  text: string, 
  delay?: number, 
  start?: boolean, 
  onComplete?: () => void,
  style?: any, 
  [key: string]: any 
}) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!start) {
      setDisplayedText("");
      return;
    }
    
    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let i = 0;
    
    setDisplayedText("");

    const typeNext = () => {
      if (isCancelled) return;
      if (i >= text.length) {
        if (onComplete) onComplete();
        return;
      }
      
      setDisplayedText(text.substring(0, i + 1));
      const char = text[i];
      i++;

      let nextDelay = delay;
      // Add emotional pauses for punctuation (reduced multipliers for faster overall speed)
      if (char === "." || char === "!" || char === "?" || char === "❤️") {
        nextDelay = delay * 5; // Deep pause (but faster)
      } else if (char === ",") {
        nextDelay = delay * 3; // Slight pause
      } else {
        nextDelay = delay + (Math.random() * 10); // Organic jitter
      }

      timeoutId = setTimeout(typeNext, nextDelay);
    };

    timeoutId = setTimeout(typeNext, delay);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [text, delay, start]);

  return (
    <AppText style={style} {...props}>
      {displayedText}
    </AppText>
  );
}
