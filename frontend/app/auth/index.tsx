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
  Dimensions,
  Easing,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";

import { useAuth } from "@/src/context/auth";
import { AppText, BrandLogo, FirstTimePreloader } from "@/src/components/ui";
import { colors, radius, spacing, font } from "@/src/theme";
import { ApiError } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const IMAGE_SIZE = SCREEN_W * 1.5;

const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/>
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </Svg>
);

const DEFAULT_GOOGLE_WEB_CLIENT_ID = "121930938754-9hkno5bktltbrbj18b4m1jrvd1319l99.apps.googleusercontent.com";

// Native Google Sign-in loader
let GoogleSignin: any = null;
let statusCodes: any = {};
try {
  const pkg = require("@react-native-google-signin/google-signin");
  GoogleSignin = pkg.GoogleSignin;
  statusCodes = pkg.statusCodes || {};
  if (GoogleSignin && Platform.OS !== "web") {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID;
    const config: any = {
      webClientId,
      offlineAccess: false,
    };
    if (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) {
      config.iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    }
    GoogleSignin.configure(config);
  }
} catch {
  // Running in Expo Go — native Google Sign-In unavailable
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

  // ── Rolling background animation ─────────────────────────────────────────
  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    panY.setValue(0);
    Animated.loop(
      Animated.timing(panY, {
        toValue: -IMAGE_SIZE,
        duration: 40000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [panY]);

  // ── Google OAuth (web) ─────────────────────────────────────────────────────
  const [request, response, promptAsync] = Google.useAuthRequest({
    responseType: "id_token",
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID,
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
      const onboardingDone = await storage.getItem("gc_onboarding_done", false);
      if (isNew || !onboardingDone) {
        await storage.setItem("gc_onboarding_done", false);
        router.replace("/onboarding/commitment");
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
      setStep("code");
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
      if (Platform.OS !== "web" && GoogleSignin) {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        try { await GoogleSignin.signOut(); } catch {}
        const res = await GoogleSignin.signIn();
        const idToken = res.data?.idToken || (res as any).idToken;
        if (idToken) {
          await handleGoogleSession(idToken);
        } else {
          throw new Error("Could not retrieve ID token from Google.");
        }
        return;
      }

      if (Platform.OS === "web") {
        if (!request) {
          setError("Google sign-in is initializing. Please try again in a moment.");
          setGoogleLoading(false);
          return;
        }
        await promptAsync();
        return;
      }

      setError("Google sign-in is unavailable on this device.");
      setGoogleLoading(false);
    } catch (e: any) {
      console.error("Google Sign-In Error:", e);
      const isCancelled =
        e.code === statusCodes.SIGN_IN_CANCELLED ||
        e.code === statusCodes.IN_PROGRESS ||
        e.code === "ERR_REQUEST_CANCELED";
      if (!isCancelled) {
        let msg = e.message || "Google sign-in failed.";
        if (e.code === "10" || e.code === 10 || (typeof msg === "string" && msg.includes("DEVELOPER_ERROR"))) {
          msg = "Google Sign-In setup pending (SHA-1 fingerprint in Google Cloud). Please use Email code for now.";
        }
        setError(msg);
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

  if (showPreloader) {
    return <FirstTimePreloader message="Welcome back to GoodCause..." />;
  }

  return (
    <View style={styles.container}>
      {/* Edge to edge rolling background grid */}
      <View style={[StyleSheet.absoluteFill, { height: SCREEN_H * 0.65, overflow: "hidden", alignItems: "center" }]} pointerEvents="none">
        <Animated.View style={{ 
          width: IMAGE_SIZE * 3,
          flexDirection: "row",
          flexWrap: "wrap",
          transform: [
            { translateY: panY },
            { translateX: panY }
          ] 
        }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <Image 
              key={i}
              source={require("../../assets/images/onboarding/grid_nigerian.jpg")}
              style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, opacity: 0.6 }}
              resizeMode="cover"
            />
          ))}
        </Animated.View>
        <LinearGradient
          colors={["transparent", "rgba(8,10,12,0.6)", "rgba(8,10,12,1)", "#080a0c"]}
          locations={[0.2, 0.5, 0.8, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === "android" ? insets.top : 0 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <BrandLogo size={22} color={colors.brandPrimary} />
            </View>

            <View style={styles.content}>
              <View style={{ flex: 1, minHeight: 60 }} />

              {/* Title & subtitle */}
              <AppText style={styles.title}>
                {step === "code"
                  ? "Check your email"
                  : step === "email"
                  ? "What's your email?"
                  : "Welcome to\nyour home for help"}
              </AppText>
              <AppText style={styles.subtitle}>
                {step === "code"
                  ? `We sent a 6-digit code to ${email}`
                  : step === "email"
                  ? "We'll send you a code to sign in."
                  : "Create your secure profile to begin your journey and watch your impact grow."}
              </AppText>

              {/* Step 0: Main options */}
              {step === "main" && (
                <View style={styles.formGroup}>
                  <Pressable
                    onPress={googleSignIn}
                    disabled={googleLoading}
                    style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.8 }]}
                    testID="auth-google-button"
                  >
                    <View style={styles.socialIconWrap}>
                      <GoogleIcon size={20} />
                    </View>
                    <AppText style={styles.outlineBtnText}>
                      {googleLoading ? "Connecting…" : "Continue with Google"}
                    </AppText>
                  </Pressable>

                  {Platform.OS === "ios" && (
                    <Pressable
                      onPress={appleSignIn}
                      disabled={appleLoading}
                      style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.8 }]}
                    >
                      <Ionicons name="logo-apple" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <AppText style={styles.outlineBtnText}>
                        {appleLoading ? "Connecting…" : "Continue with Apple"}
                      </AppText>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() => setStep("email")}
                    style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
                    testID="auth-email-button"
                  >
                    <AppText style={styles.primaryBtnText}>
                      Continue with Email
                    </AppText>
                  </Pressable>
                </View>
              )}

              {/* Step 1: Email Input */}
              {step === "email" && (
                <View style={styles.formGroup}>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      placeholder="name@example.com"
                      placeholderTextColor="rgba(255,255,255,0.4)"
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

                  <Pressable
                    onPress={handleSendOtp}
                    disabled={emailLoading}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && { opacity: 0.85 },
                      emailLoading && { opacity: 0.6 },
                    ]}
                    testID="auth-send-otp-button"
                  >
                    {emailLoading ? (
                      <ActivityIndicator color="#080a0c" />
                    ) : (
                      <AppText style={styles.primaryBtnText}>Send code</AppText>
                    )}
                  </Pressable>

                  <Pressable onPress={() => setStep("main")} style={styles.textBtn}>
                    <AppText style={styles.textBtnLabel}>Back to options</AppText>
                  </Pressable>
                </View>
              )}

              {/* Step 2: OTP Code */}
              {step === "code" && (
                <View style={styles.formGroup}>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={[styles.input, { letterSpacing: 8, textAlign: "center", fontSize: 22, fontFamily: font.bold }]}
                      placeholder="123456"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={code}
                      onChangeText={(t) => { setCode(t.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                      keyboardType="number-pad"
                      maxLength={6}
                      testID="auth-otp-input"
                      autoFocus
                    />
                  </View>

                  {(isNewUser || code.length === 6) && (
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        placeholder="Your full name"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                        returnKeyType="done"
                        testID="auth-name-input"
                      />
                    </View>
                  )}

                  <Pressable
                    onPress={handleVerify}
                    disabled={verifyLoading}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && { opacity: 0.85 },
                      verifyLoading && { opacity: 0.6 },
                    ]}
                    testID="auth-verify-button"
                  >
                    {verifyLoading ? (
                      <ActivityIndicator color="#080a0c" />
                    ) : (
                      <AppText style={styles.primaryBtnText}>Sign in</AppText>
                    )}
                  </Pressable>

                  <View style={styles.codeActions}>
                    <Pressable
                      onPress={handleSendOtp}
                      disabled={resendTimer > 0 || emailLoading}
                      style={{ opacity: resendTimer > 0 ? 0.5 : 1 }}
                    >
                      <AppText style={{ color: colors.brandPrimary, fontSize: 13, fontFamily: font.semibold }}>
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
                      </AppText>
                    </Pressable>

                    <Pressable onPress={() => { setStep("email"); setCode(""); setName(""); setError(""); }}>
                      <AppText style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: font.medium }}>
                        Change email
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              )}

              {error ? (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={14} color={colors.error} style={{ marginRight: 6 }} />
                  <AppText style={styles.errorText}>{error}</AppText>
                </View>
              ) : null}

              {/* Legal Footer */}
              <AppText style={styles.legalNote}>
                By continuing to use goodcause, you agree to our{"\n"}
                <AppText
                  style={styles.legalLink}
                  onPress={() => router.push("/privacy")}
                >
                  Terms of Service
                </AppText>
                {" "}and{" "}
                <AppText
                  style={styles.legalLink}
                  onPress={() => router.push("/privacy")}
                >
                  Privacy Policy
                </AppText>.
              </AppText>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080a0c" },
  scroll: { flexGrow: 1 },
  header: { alignItems: "center", paddingTop: 16 },
  content: { flex: 1, paddingHorizontal: 28, paddingBottom: 36, justifyContent: "flex-end" },

  title: {
    fontSize: 32,
    fontFamily: font.bold,
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
    paddingHorizontal: 12,
  },

  formGroup: { gap: 12, marginBottom: 20 },

  primaryBtn: {
    height: 52,
    backgroundColor: colors.brandPrimary,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#080a0c", fontSize: 16, fontFamily: font.bold },

  outlineBtn: {
    height: 52,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  outlineBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: font.semibold },
  socialIconWrap: { width: 24, alignItems: "center", marginRight: 8 },

  inputBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 20,
    height: 52,
    justifyContent: "center",
  },
  input: { flex: 1, fontFamily: font.medium, fontSize: 16, color: "#FFFFFF" },

  textBtn: { paddingVertical: 12, alignItems: "center" },
  textBtnLabel: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: font.medium },

  codeActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    marginTop: 4,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(224,46,46,0.15)",
    borderWidth: 1,
    borderColor: "rgba(224,46,46,0.4)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: 16,
  },
  errorText: { color: "#FF6B6B", fontSize: 13, fontFamily: font.medium, flex: 1 },

  legalNote: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.4)",
    marginTop: 8,
  },
  legalLink: {
    color: colors.brandPrimary,
    textDecorationLine: "underline",
    fontFamily: font.semibold,
  },
});
