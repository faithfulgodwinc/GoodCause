import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/auth";
import { AppText, BrandLogo, FirstTimePreloader } from "@/src/components/ui";
import { colors, radius, spacing, font } from "@/src/theme";
import { ApiError } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

// Safely load the native Google Sign-In SDK.
// It requires a compiled native module (not available in Expo Go), so we use
// a dynamic require() wrapped in try-catch. In Expo Go this returns null and
// we fall back to expo-auth-session. In a real native build it's fully loaded.
let GoogleSignin: any = null;
let statusCodes: any = {};
try {
  const pkg = require("@react-native-google-signin/google-signin");
  GoogleSignin = pkg.GoogleSignin;
  statusCodes = pkg.statusCodes || {};
  if (GoogleSignin && Platform.OS !== "web") {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
      offlineAccess: false,
    });
  }
} catch {
  // Running in Expo Go — native Google Sign-In unavailable, will use web OAuth
}

type Step = "main" | "email" | "code";

const OTP_RESEND_SECONDS = 60;

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sendOtp, verifyOtp, completeGoogleSession, completeAppleSession } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("main");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [showPreloader, setShowPreloader] = useState(false);

  const [emailLoading, setEmailLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Animations ─────────────────────────────────────────────────────────────
  const stepAnim = useRef(new Animated.Value(0)).current;

  const animateToStep = (toStep: Step) => {
    Animated.sequence([
      Animated.timing(stepAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(stepAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep(toStep);
    });
  };

  // ── Google OAuth (web) ─────────────────────────────────────────────────────
  // We ONLY pass the Web Client ID here. If we pass androidClientId, Expo Go on Android 
  // will try to use it in the browser flow, which throws a 404 from Google because 
  // Android Client IDs don't have web redirect URIs.
  const [request, response, promptAsync] = Google.useAuthRequest({
    responseType: "id_token",
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
    redirectUri: makeRedirectUri(),
  });

  useEffect(() => {
    if (Platform.OS === "web") {
      if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }
  }, []);

  // ── Auth success routing ───────────────────────────────────────────────────
  const onAuthSuccess = useCallback(
    async (isNew: boolean) => {
      if (isNew) {
        router.replace("/onboarding");
        return;
      }
      const onboardingDone = await storage.getItem("gc_onboarding_done", false);
      if (!onboardingDone) {
        router.replace("/onboarding");
        return;
      }
      const firstLogin = await storage.getItem("gc_first_signin_done", false);
      if (!firstLogin) {
        setShowPreloader(true);
        await storage.setItem("gc_first_signin_done", true);
        setTimeout(() => router.replace("/(tabs)"), 1800);
        return;
      }
      router.replace("/(tabs)");
    },
    [router]
  );

  // ── Resend timer ───────────────────────────────────────────────────────────
  const startResendTimer = useCallback(() => {
    setResendTimer(OTP_RESEND_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Send OTP ───────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setEmailLoading(true);
    try {
      await sendOtp(trimmed);
      startResendTimer();
      animateToStep("code");
      // Small delay so the animation completes before updating step
      setTimeout(() => setStep("code"), 160);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send code. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    setError("");
    if (code.trim().length !== 6 || !/^\d{6}$/.test(code.trim())) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }
    if (isNewUser && !name.trim()) {
      setError("Please tell us your name.");
      return;
    }
    setVerifyLoading(true);
    try {
      const { isNewUser: newUser } = await verifyOtp(
        email.trim().toLowerCase(),
        code.trim(),
        name.trim() || undefined
      );
      setIsNewUser(newUser);
      await onAuthSuccess(newUser);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Incorrect or expired code. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── Google sign-in ─────────────────────────────────────────────────────────
  const handleGoogleSession = async (idToken: string) => {
    setGoogleLoading(true);
    try {
      const { isNewUser: newUser } = await completeGoogleSession(idToken);
      await onAuthSuccess(newUser);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (response?.type === "success") {
      const token = response.params?.id_token || response.authentication?.idToken;
      if (token) handleGoogleSession(token);
      else { setError("Could not retrieve ID token from Google."); setGoogleLoading(false); }
    } else if (response?.type === "error") {
      setError("Google sign-in failed.");
      setGoogleLoading(false);
    } else if (response?.type === "dismiss" || response?.type === "cancel") {
      setGoogleLoading(false);
    }
  }, [response]);

  const googleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      console.log("=== GOOGLE SIGN-IN DEBUG ===");
      console.log("Web Client ID:", process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
      console.log("Request Object URL:", request?.url);
      console.log("============================");

      // ── Native build: use @react-native-google-signin for best UX ──────────
      if (GoogleSignin && Platform.OS !== "web") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const res = await GoogleSignin.signIn();
        const idToken = res.data?.idToken || (res as any).idToken;
        if (idToken) {
          await handleGoogleSession(idToken);
        } else {
          throw new Error("Could not retrieve ID token from Google.");
        }
        return;
      }

      // ── Expo Go / web: use expo-auth-session (browser OAuth) ───────────────
      if (!request) {
        setError("Google sign-in is not ready yet. Please wait a moment.");
        setGoogleLoading(false);
        return;
      }
      await promptAsync();
      // result handled in the useEffect above via `response`

    } catch (e: any) {
      const isCancelled =
        e.code === statusCodes.SIGN_IN_CANCELLED ||
        e.code === statusCodes.IN_PROGRESS ||
        e.code === "ERR_REQUEST_CANCELED";
      if (!isCancelled) {
        setError(e.message || "Google sign-in failed.");
      }
      setGoogleLoading(false);
    }
  };

  // ── Apple sign-in ──────────────────────────────────────────────────────────
  const appleSignIn = async () => {
    setError("");
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { identityToken, fullName } = credential;
      if (!identityToken) throw new Error("No identity token from Apple.");
      const displayName = [fullName?.givenName, fullName?.familyName].filter(Boolean).join(" ") || undefined;
      const { isNewUser: newUser } = await completeAppleSession(identityToken, displayName);
      await onAuthSuccess(newUser);
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        setError(e instanceof ApiError ? e.message : "Apple sign-in failed.");
      }
    } finally {
      setAppleLoading(false);
    }
  };

  // ── Preloader ──────────────────────────────────────────────────────────────
  if (showPreloader) {
    return <FirstTimePreloader message="Welcome back to GoodCause..." />;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 40) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>

          {/* ── Logo + heading ── */}
          <View style={styles.header}>
            <BrandLogo size={56} style={{ marginBottom: spacing.xxl }} />
            {step === "code" ? (
              <>
                <AppText variant="display" style={styles.title}>Check your email</AppText>
                <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.subtitle}>
                  We sent a 6-digit code to{" "}
                  <AppText variant="bodyMedium" color={colors.onSurface}>{email}</AppText>
                </AppText>
              </>
            ) : (
              <>
                <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.subtitle}>
                  Sign in or create an account to start supporting campaigns you care about.
                </AppText>
              </>
            )}
          </View>

          {/* ── Step 0: Main (SSO Only) ── */}
          {step === "main" && (
            <Animated.View style={[styles.form, { opacity: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
              {Platform.OS === "ios" && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={100} // Pill shape
                  style={styles.appleBtn}
                  onPress={appleSignIn}
                />
              )}

              <Pressable
                onPress={googleSignIn}
                disabled={googleLoading}
                style={({ pressed }) => [styles.ssoBtn, pressed && { opacity: 0.7 }]}
                testID="auth-google-button"
              >
                <Image
                  source={{ uri: "https://developers.google.com/identity/images/g-logo.png" }}
                  style={{ width: 20, height: 20, marginRight: spacing.sm }}
                />
                <AppText variant="button" color={colors.onSurface} style={styles.ssoBtnText}>
                  {googleLoading ? "Connecting…" : "Continue with Google"}
                </AppText>
              </Pressable>

              {error ? <ErrorBanner message={error} /> : null}

              <Pressable onPress={() => animateToStep("email")} style={styles.textBtn}>
                <AppText variant="button" color={colors.onSurfaceSecondary}>
                  Use email address
                </AppText>
              </Pressable>

              <AppText variant="caption" color={colors.muted} style={styles.legalNote}>
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </AppText>
            </Animated.View>
          )}

          {/* ── Step 1: Email Input ── */}
          {step === "email" && (
            <Animated.View style={[styles.form, { opacity: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
              <View style={styles.fieldGroup}>
                <AppText variant="label" style={styles.label}>Email address</AppText>
                <View style={styles.inputBox}>
                  <Feather name="mail" size={18} color={colors.muted} style={{ marginRight: spacing.sm }} />
                  <TextInput
                    style={styles.input}
                    placeholder="name@example.com"
                    placeholderTextColor={colors.muted}
                    value={email}
                    onChangeText={(t) => { setEmail(t); setError(""); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    returnKeyType="done"
                    onSubmitEditing={handleSendOtp}
                    testID="auth-email-input"
                    autoFocus
                  />
                </View>
              </View>

              {error ? <ErrorBanner message={error} /> : null}

              <Pressable
                onPress={handleSendOtp}
                disabled={emailLoading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.8 },
                  emailLoading && { opacity: 0.6 },
                ]}
                testID="auth-send-otp-button"
              >
                <AppText variant="button" color="#fff" style={styles.btnText}>
                  {emailLoading ? "Sending…" : "Send code"}
                </AppText>
                {!emailLoading && <Feather name="arrow-right" size={16} color="#fff" style={{ marginLeft: spacing.sm }} />}
              </Pressable>

              <Pressable onPress={() => animateToStep("main")} style={styles.textBtn}>
                <AppText variant="button" color={colors.onSurfaceSecondary}>
                  Other sign in options
                </AppText>
              </Pressable>
            </Animated.View>
          )}

          {/* ── Step 2: OTP Code + (optional) Name ── */}
          {step === "code" && (
            <Animated.View style={[styles.form, { opacity: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
              {/* OTP input */}
              <View style={styles.fieldGroup}>
                <AppText variant="label" style={styles.label}>6-digit code</AppText>
                <OtpInput value={code} onChange={(v) => { setCode(v); setError(""); if (v.length === 6) setIsNewUser(false); }} />
              </View>

              {/* Name field — shown only if new user detected or code length is 6 */}
              {(isNewUser || code.length === 6) && (
                <View style={[styles.fieldGroup, { marginTop: spacing.md }]}>
                  <AppText variant="label" style={styles.label}>
                    Your name <AppText variant="caption" color={colors.muted}>(for new accounts)</AppText>
                  </AppText>
                  <View style={styles.inputBox}>
                    <Feather name="user" size={18} color={colors.muted} style={{ marginRight: spacing.sm }} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Faithful Godwin"
                      placeholderTextColor={colors.muted}
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                      returnKeyType="done"
                      testID="auth-name-input"
                    />
                  </View>
                </View>
              )}

              {error ? <ErrorBanner message={error} /> : null}

              <Pressable
                onPress={handleVerify}
                disabled={verifyLoading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.8 },
                  verifyLoading && { opacity: 0.6 },
                ]}
                testID="auth-verify-button"
              >
                <AppText variant="button" color="#fff" style={styles.btnText}>
                  {verifyLoading ? "Verifying…" : "Sign in"}
                </AppText>
              </Pressable>

              {/* Resend + back */}
              <View style={styles.codeActions}>
                <Pressable
                  onPress={handleSendOtp}
                  disabled={resendTimer > 0 || emailLoading}
                  style={{ opacity: resendTimer > 0 ? 0.4 : 1 }}
                  testID="auth-resend-button"
                >
                  <AppText variant="label" color={colors.brandPrimary}>
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
                  </AppText>
                </Pressable>

                <Pressable onPress={() => { animateToStep("email"); setCode(""); setName(""); setError(""); }} hitSlop={12}>
                  <AppText variant="label" color={colors.onSurfaceSecondary}>
                    Change email
                  </AppText>
                </Pressable>
              </View>
            </Animated.View>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── OTP digit input ──────────────────────────────────────────────────────────

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Auto-focus when step changes to code
    setTimeout(() => inputRef.current?.focus(), 250);
  }, []);

  const digits = value.padEnd(6, " ").split("");

  return (
    <Pressable style={styles.otpRow} onPress={() => inputRef.current?.focus()}>
      {digits.map((d, i) => (
        <View
          key={i}
          style={[
            styles.otpBox,
            value.length === i && styles.otpBoxActive,
            d.trim() && styles.otpBoxFilled,
          ]}
        >
          <AppText variant="h1" style={styles.otpDigit}>{d.trim()}</AppText>
          {value.length === i && <View style={styles.otpCursor} />}
        </View>
      ))}
      {/* Hidden real input */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        style={styles.otpHidden}
        testID="auth-otp-input"
        caretHidden
      />
    </Pressable>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Feather name="alert-circle" size={14} color={colors.error} style={{ marginRight: spacing.xs }} />
      <AppText variant="caption" color={colors.error} style={{ flex: 1 }}>{message}</AppText>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingBottom: 64, paddingHorizontal: spacing.xl },
  inner: { width: "100%", maxWidth: 320 },

  header: { alignItems: "center", marginBottom: 48 },
  title: { fontSize: 32, fontFamily: font.bold, color: colors.onSurface, textAlign: "center", letterSpacing: -0.8, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22, paddingHorizontal: spacing.sm },

  form: { width: "100%", gap: spacing.lg },

  ssoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#F5F5F7", height: 52, borderRadius: 100, // Pill shape
  },
  ssoBtnText: { fontSize: 15, fontFamily: font.semibold, color: colors.onSurface },
  appleBtn: { width: "100%", height: 52 },

  textBtn: {
    paddingVertical: spacing.md, alignItems: "center", justifyContent: "center"
  },

  fieldGroup: { gap: spacing.xs },
  label: { fontSize: 13, fontFamily: font.medium, color: colors.onSurface, marginLeft: 4 },
  inputBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F5F5F7", borderRadius: radius.lg,
    paddingHorizontal: spacing.md, height: 52,
  },
  input: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.onSurface },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.brandPrimary, height: 52, borderRadius: 100, // Pill shape
    marginTop: spacing.sm,
  },
  btnText: { fontSize: 16, fontFamily: font.semibold },

  errorBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFF0F0", borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },

  legalNote: { textAlign: "center", fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: spacing.md },

  // OTP
  otpRow: { flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  otpBox: {
    width: 48, height: 58, borderRadius: radius.md,
    backgroundColor: "#F5F5F7",
    alignItems: "center", justifyContent: "center",
  },
  otpBoxActive: { backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: colors.brandPrimary },
  otpBoxFilled: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border },
  otpDigit: { fontSize: 24, fontFamily: font.bold, color: colors.onSurface },
  otpCursor: {
    position: "absolute", bottom: 12, width: 2, height: 20,
    backgroundColor: colors.brandPrimary, borderRadius: 1,
  },
  otpHidden: {
    position: "absolute", width: 1, height: 1, opacity: 0,
  },

  codeActions: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: spacing.sm, marginTop: spacing.md,
  },
});
