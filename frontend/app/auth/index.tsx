import React, { useEffect, useRef, useState } from "react";
import {
  View, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, Image
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/auth";
import { AppText, BrandLogo, FirstTimePreloader } from "@/src/components/ui";
import { colors, radius, spacing, font } from "@/src/theme";
import { ApiError } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";
import { useResponsive } from "@/src/lib/responsive";

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isMobile } = useResponsive();
  const { login, register, completeGoogleSession, completeAppleSession } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [showPreloader, setShowPreloader] = useState(false);
  const [error, setError] = useState("");

  const [request, response, promptAsync] = Google.useAuthRequest({
    responseType: "id_token",
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "your_google_web_client_id_here",
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "your_google_ios_client_id_here",
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "your_google_android_client_id_here",
  });

  const onAuthSuccess = async () => {
    try {
      const done = await storage.getItem("gc_first_signin_done", false);
      if (!done) {
        setShowPreloader(true);
        await storage.setItem("gc_first_signin_done", true);
        setTimeout(() => {
          router.replace("/(tabs)");
        }, 1800);
        return;
      }
    } catch {
      // fallback if storage errors
    }
    router.replace("/(tabs)");
  };

  const handleSession = async (idToken: string) => {
    try {
      setGoogleLoading(true);
      await completeGoogleSession(idToken);
      await onAuthSuccess();
    } catch (e) {
      console.warn("Google session error:", e);
      setError(e instanceof ApiError ? e.message : "Could not complete Google sign-in.");
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      if (id_token) {
        handleSession(id_token);
      } else if (response.authentication?.idToken) {
        handleSession(response.authentication.idToken);
      } else {
        setError("Could not retrieve ID token from Google.");
      }
    } else if (response?.type === "error") {
      setError("Google sign-in failed.");
    }
  }, [response]);

  const submit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Please tell us your full name.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") await login(email.trim(), password);
      else await register(email.trim(), password, name.trim());
      await onAuthSuccess();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    setError("");
    if (!request) return;
    
    try {
      setGoogleLoading(true);
      await promptAsync();
    } catch (e: any) {
      setError(e.message || "Could not open Google sign-in.");
      setGoogleLoading(false);
    }
  };

  const appleSignIn = async () => {
    try {
      setAppleLoading(true);
      setError("");
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      const { identityToken, fullName } = credential;
      if (!identityToken) {
        throw new Error("No identity token provided by Apple.");
      }
      
      let name = undefined;
      if (fullName?.givenName || fullName?.familyName) {
        name = `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim();
      }

      await completeAppleSession(identityToken, name);
      await onAuthSuccess();
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled the sign-in flow
      } else {
        setError(e instanceof ApiError ? e.message : "Could not complete Apple sign-in.");
        console.warn("Apple session error:", e);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  if (showPreloader) {
    return (
      <FirstTimePreloader
        message={mode === "signup" ? "Setting up your GoodCause account..." : "Welcome to GoodCause..."}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scrollContainer, { paddingTop: Math.max(insets.top, 40) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <View style={styles.logoMark}>
              <Feather name="heart" size={24} color="#FFFFFF" />
            </View>
            <AppText variant="display" style={styles.title}>
              {mode === "signup" ? "Create an account" : "Sign in to GoodCause"}
            </AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.subtitle}>
              {mode === "signup"
                ? "Enter your details to get started."
                : "Welcome back! Please enter your details."}
            </AppText>
          </View>

          <View style={styles.formContainer}>
            {mode === "signup" && (
              <View style={styles.fieldWrapper}>
                <AppText variant="label" style={styles.fieldLabel}>Full Name</AppText>
                <View style={styles.fieldInputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Faithful Godwin"
                    placeholderTextColor={colors.muted}
                    value={name}
                    onChangeText={setName}
                    testID="auth-name-input"
                  />
                </View>
              </View>
            )}

            <View style={styles.fieldWrapper}>
              <AppText variant="label" style={styles.fieldLabel}>Email</AppText>
              <View style={styles.fieldInputBox}>
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  testID="auth-email-input"
                />
              </View>
            </View>

            <View style={styles.fieldWrapper}>
              <AppText variant="label" style={styles.fieldLabel}>Password</AppText>
              <View style={styles.fieldInputBox}>
                <TextInput
                  style={styles.input}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={colors.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  testID="auth-password-input"
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                  style={styles.showPasswordBtn}
                >
                  <AppText variant="caption" color={colors.onSurfaceSecondary} style={{ fontFamily: font.medium }}>
                    {showPassword ? "Hide" : "Show"}
                  </AppText>
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <AppText variant="caption" color={colors.error}>{error}</AppText>
              </View>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={loading}
              style={({ pressed }) => [
                styles.primarySubmitBtn,
                pressed && { opacity: 0.8 },
                loading && { opacity: 0.6 },
              ]}
              testID="auth-submit-button"
            >
              <AppText variant="button" color="#FFFFFF" style={styles.submitBtnText}>
                {loading
                  ? "Please wait..."
                  : mode === "signup"
                  ? "Continue"
                  : "Sign In"}
              </AppText>
            </Pressable>

            <Pressable
              onPress={googleSignIn}
              disabled={googleLoading}
              style={({ pressed }) => [
                styles.ssoBtn,
                pressed && { opacity: 0.7 },
              ]}
              testID="auth-google-button"
            >
              <Image
                source={{ uri: "https://developers.google.com/identity/images/g-logo.png" }}
                style={{ width: 20, height: 20, marginRight: 10 }}
              />
              <AppText variant="button" color={colors.onSurface} style={styles.ssoBtnText}>
                {googleLoading ? "Connecting..." : "Continue with Google"}
              </AppText>
            </Pressable>

            {Platform.OS === 'ios' && (
              <Pressable
                onPress={appleSignIn}
                disabled={appleLoading}
                style={({ pressed }) => [
                  styles.ssoBtn,
                  { backgroundColor: "#000000", borderColor: "#000000" },
                  pressed && { opacity: 0.7 },
                ]}
                testID="auth-apple-button"
              >
                <Feather name="apple" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
                <AppText variant="button" color="#FFFFFF" style={styles.ssoBtnText}>
                  {appleLoading ? "Connecting..." : "Continue with Apple"}
                </AppText>
              </Pressable>
            )}

            <View style={styles.toggleModeContainer}>
              <AppText variant="body" color={colors.onSurfaceSecondary} style={{ fontSize: 14 }}>
                {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
              </AppText>
              <Pressable
                onPress={() => {
                  setError("");
                  setMode(mode === "signup" ? "signin" : "signup");
                }}
                hitSlop={8}
              >
                <AppText variant="body" color={colors.brandPrimary} style={{ fontFamily: font.medium, fontSize: 14 }}>
                  {mode === "signup" ? "Sign In" : "Sign Up"}
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  contentWrapper: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontFamily: font.bold,
    color: colors.onSurface,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    color: colors.onSurfaceSecondary,
  },
  formContainer: {
    width: "100%",
    gap: spacing.lg,
  },
  fieldWrapper: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: font.medium,
    color: colors.onSurface,
  },
  fieldInputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: spacing.md,
    height: 52,
  },
  input: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.onSurface,
  },
  showPasswordBtn: {
    paddingLeft: spacing.sm,
    paddingVertical: 8,
  },
  errorBox: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: "#FFF0F0",
    borderRadius: 8,
  },
  primarySubmitBtn: {
    backgroundColor: colors.brandPrimary,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: font.semibold,
  },
  ssoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  ssoBtnText: {
    fontSize: 16,
    fontFamily: font.semibold,
  },
  toggleModeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
});
