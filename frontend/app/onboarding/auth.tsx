import React, { useState } from "react";
import { View, StyleSheet, Pressable, TextInput, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { AppText, BrandLogo, TypeWriterText } from "@/src/components/ui";
import { colors, font } from "@/src/theme";
import { useAuth } from "@/src/context/auth";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/>
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </Svg>
);

export default function AuthScreen() {
  const router = useRouter();
  const { tier } = useLocalSearchParams();
  const { sendOtp, verifyOtp } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"options" | "email" | "code">("options");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleContinueEmail = async () => {
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      await sendOtp(email);
      setStep("code");
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code) return;
    setLoading(true);
    setError("");
    try {
      await verifyOtp(email, code);
      router.push({ pathname: "/onboarding/payment", params: { tier } });
    } catch (e: any) {
      setError(e.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    router.push({ pathname: "/onboarding/payment", params: { tier } });
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === "android" ? insets.top : 0 }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <BrandLogo size={20} />
        </View>

        <View style={styles.content}>
          <View style={styles.imageContainer}>
            {/* Using slide2 (smiling community) as a placeholder for the organic shape boy */}
            <Image 
              source={require("../../assets/images/onboarding/slide2.jpg")} 
              style={styles.heroImage} 
              resizeMode="cover" 
            />
            <View style={styles.doodle}>
              <Ionicons name="leaf-outline" size={32} color={colors.brandPrimary} />
            </View>
          </View>

          <AppText style={styles.title}>One last step. ❤️</AppText>
          <TypeWriterText 
            style={styles.subtitle} 
            text="Create your secure profile so you can see exactly whose lives you are changing, and watch your impact grow over time." 
          />

          {step === "options" && (
            <View style={styles.authOptions}>
              <Pressable style={styles.socialBtnOutline} onPress={() => {}}>
                <View style={styles.socialIconWrap}>
                  <GoogleIcon size={20} />
                </View>
                <AppText style={styles.socialTextOutline}>Continue with Google</AppText>
              </Pressable>

              {Platform.OS === "ios" && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={24}
                  style={{ width: "100%", height: 48 }}
                  onPress={handleAppleAuth}
                />
              )}

              <Pressable style={styles.socialBtnPrimary} onPress={() => setStep("email")}>
                <View style={styles.socialIconWrap}>
                  <Ionicons name="mail" size={20} color={colors.surface} />
                </View>
                <AppText style={styles.socialTextSolid}>Continue with email</AppText>
              </Pressable>
            </View>
          )}

          {step === "email" && (
            <View style={styles.authForm}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email Address"
                placeholderTextColor={colors.onSurfaceTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
                autoFocus
              />
              <Pressable style={styles.socialBtnPrimaryCentered} onPress={handleContinueEmail} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.surface} /> : <AppText style={styles.socialTextCentered}>Send Code</AppText>}
              </Pressable>
              <Pressable style={{ marginTop: 16 }} onPress={() => setStep("options")}>
                <AppText style={{ textAlign: "center", color: colors.onSurfaceSecondary, fontFamily: font.medium }}>Back to options</AppText>
              </Pressable>
            </View>
          )}

          {step === "code" && (
            <View style={styles.authForm}>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="6-Digit Code"
                placeholderTextColor={colors.onSurfaceTertiary}
                keyboardType="number-pad"
                editable={!loading}
                maxLength={6}
                autoFocus
              />
              <Pressable style={styles.socialBtnPrimaryCentered} onPress={handleVerifyCode} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.surface} /> : <AppText style={styles.socialTextCentered}>Verify Code</AppText>}
              </Pressable>
            </View>
          )}

          {error ? <AppText style={styles.error}>{error}</AppText> : null}

          <View style={{ flex: 1 }} />
          
          <AppText style={styles.terms}>
            By continuing, you agree to our{"\n"}
            <AppText style={{ textDecorationLine: "underline" }}>Terms</AppText> & <AppText style={{ textDecorationLine: "underline" }}>Privacy Policy</AppText>.
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { alignItems: "center", paddingVertical: 16 },
  content: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
  
  imageContainer: {
    alignSelf: "center",
    width: "100%",
    height: 180,
    marginTop: 16,
    marginBottom: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: "80%",
    height: "100%",
    borderRadius: 32, // Gives a pill-like organic feel
  },
  doodle: {
    position: "absolute",
    right: 20,
    top: 20,
    transform: [{ rotate: "15deg" }]
  },

  title: { fontSize: 28, fontFamily: font.bold, color: colors.onSurface, marginBottom: 12, textAlign: "center", lineHeight: 40, paddingTop: 4 },
  subtitle: { fontSize: 14, color: colors.onSurfaceSecondary, textAlign: "center", marginBottom: 32, lineHeight: 22, paddingHorizontal: 16 },
  
  authOptions: { gap: 12 },
  authForm: { gap: 12 },
  
  socialBtnPrimary: {
    height: 48,
    backgroundColor: colors.brandPrimary,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  socialBtnApple: {
    height: 48,
    backgroundColor: "#000000",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  socialBtnPrimaryCentered: {
    height: 48,
    backgroundColor: colors.brandPrimary,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  socialTextSolid: { color: colors.surface, fontSize: 16, fontFamily: font.semibold },
  socialTextCentered: { color: colors.surface, fontSize: 16, fontFamily: font.semibold },
  
  socialBtnOutline: {
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  socialTextOutline: { color: colors.onSurface, fontSize: 16, fontFamily: font.semibold },
  socialIconWrap: { width: 24, alignItems: "center", marginRight: 8 },
  
  input: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    paddingHorizontal: 24,
    fontSize: 16,
    color: colors.onSurface,
    fontFamily: font.medium,
    marginBottom: 8,
  },
  
  error: { color: colors.error, fontSize: 14, marginTop: 12, textAlign: "center" },
  terms: { fontSize: 12, color: colors.onSurfaceSecondary, textAlign: "center", lineHeight: 18, fontFamily: font.medium },
});
