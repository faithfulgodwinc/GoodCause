import React, { useEffect, useRef, useState } from "react";
import {
  View, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/auth";
import { AppText, Button } from "@/src/components/ui";
import { colors, radius, spacing, font } from "@/src/theme";
import { ApiError } from "@/src/lib/api";

WebBrowser.maybeCompleteAuthSession();

const HERO = "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2Mzl8MHwxfHNlYXJjaHwyfHxjb21tdW5pdHklMjBoYW5kcyUyMHRvZ2V0aGVyfGVufDB8fHx8MTc4NzQ4MDMyMnww&ixlib=rb-4.1.0&q=85";

function extractSessionId(url: string): string | null {
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, register, completeGoogleSession } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const handled = useRef<Set<string>>(new Set());

  const handleSession = async (sessionId: string) => {
    if (handled.current.has(sessionId)) return;
    handled.current.add(sessionId);
    try {
      setGoogleLoading(true);
      await completeGoogleSession(sessionId);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not complete Google sign-in.");
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) handleSession(sid);
    });
    Linking.getInitialURL().then((url) => {
      if (url) {
        const sid = extractSessionId(url);
        if (sid) handleSession(sid);
      }
    });
    return () => sub.remove();
  }, []);

  const submit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Please tell us your name.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") await login(email.trim(), password);
      else await register(email.trim(), password, name.trim());
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    setError("");
    try {
      setGoogleLoading(true);
      const redirectUrl = Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      if (Platform.OS === "web") {
        window.location.href = authUrl;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        const sid = extractSessionId(result.url);
        if (sid) await handleSession(sid);
      }
    } catch (e) {
      setError("Could not open Google sign-in.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
          <LinearGradient colors={["rgba(35,33,31,0.2)", "rgba(35,33,31,0.55)", colors.surface]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroContent, { paddingTop: insets.top + spacing.xxl }]}>
            <View style={styles.logoRow}>
              <View style={styles.logoMark}><Feather name="heart" size={18} color="#fff" /></View>
              <AppText variant="h2" color="#fff" style={{ marginLeft: spacing.sm }}>GoodCause</AppText>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <AppText variant="display">Trust makes generosity go further.</AppText>
          <AppText variant="body" style={{ marginTop: spacing.sm }}>
            Support verified causes, or raise funds for the people and communities you care about.
          </AppText>

          <View style={styles.switchRow}>
            <SwitchTab label="Sign in" active={mode === "signin"} onPress={() => setMode("signin")} />
            <SwitchTab label="Create account" active={mode === "signup"} onPress={() => setMode("signup")} />
          </View>

          {mode === "signup" ? (
            <Field icon="user" placeholder="Your name" value={name} onChangeText={setName} testID="auth-name-input" />
          ) : null}
          <Field icon="mail" placeholder="Email address" value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" testID="auth-email-input" />
          <Field icon="lock" placeholder="Password" value={password} onChangeText={setPassword}
            secureTextEntry testID="auth-password-input" />

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color={colors.error} />
              <AppText variant="caption" color={colors.error} style={{ marginLeft: 6, flex: 1 }}>{error}</AppText>
            </View>
          ) : null}

          <Button
            title={mode === "signin" ? "Sign in" : "Create account"}
            onPress={submit}
            loading={loading}
            testID="auth-submit-button"
            style={{ marginTop: spacing.lg }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <AppText variant="caption" style={{ marginHorizontal: spacing.md }}>or</AppText>
            <View style={styles.line} />
          </View>

          <Button
            title="Continue with Google"
            icon="chrome"
            variant="outline"
            onPress={googleSignIn}
            loading={googleLoading}
            testID="auth-google-button"
          />

          <AppText variant="caption" style={{ textAlign: "center", marginTop: spacing.xl, marginBottom: spacing.xxl }}>
            Donation-based fundraising. GoodCause reviews campaigns but does not guarantee them.
          </AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SwitchTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.switchTab, active && styles.switchTabActive]}>
      <AppText variant="label" color={active ? colors.onSurface : colors.onSurfaceTertiary}>{label}</AppText>
    </Pressable>
  );
}

function Field(props: any) {
  const { icon, ...rest } = props;
  return (
    <View style={styles.field}>
      <Feather name={icon} size={18} color={colors.onSurfaceTertiary} />
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 220 },
  heroContent: { flex: 1, paddingHorizontal: spacing.lg },
  logoRow: { flexDirection: "row", alignItems: "center" },
  logoMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: spacing.lg, marginTop: -spacing.xl },
  switchRow: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4, marginTop: spacing.xl, marginBottom: spacing.md },
  switchTab: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  switchTabActive: { backgroundColor: colors.surfaceSecondary },
  field: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    height: 52, marginTop: spacing.md,
  },
  input: { flex: 1, marginLeft: spacing.sm, fontFamily: font.medium, fontSize: 15, color: colors.onSurface },
  errorBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FBEBEB", padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.divider },
});
