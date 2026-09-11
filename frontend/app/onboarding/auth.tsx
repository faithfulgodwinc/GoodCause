import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Pressable, TextInput, ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Dimensions, Image } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { AppText, BrandLogo, TypeWriterText } from "@/src/components/ui";
import { colors, font } from "@/src/theme";
import { useAuth } from "@/src/context/auth";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

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

  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Seamless infinite vertical scroll loop
    panY.setValue(0);
    Animated.loop(
      Animated.timing(panY, {
        toValue: -IMAGE_SIZE,
        duration: 40000, // Slow, loping, endless vibe
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [panY]);

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
      router.push({ pathname: "/onboarding/commitment" });
    } catch (e: any) {
      setError(e.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    router.push({ pathname: "/onboarding/commitment" });
  };

  return (
    <View style={styles.container}>
      {/* Edge to edge rolling background grid */}
      <View style={[StyleSheet.absoluteFill, { height: SCREEN_H * 0.65, overflow: "hidden", alignItems: "center" }]}>
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
        {/* Deep fade into the bottom black content area */}
        <LinearGradient
          colors={["transparent", "rgba(8,10,12,0.6)", "rgba(8,10,12,1)", "#080a0c"]}
          locations={[0.2, 0.5, 0.8, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === "android" ? insets.top : 0 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.header}>
            <BrandLogo size={20} color={colors.brandPrimary} />
          </View>

          <View style={styles.content}>
            <View style={{ flex: 1 }} /> 
            
            {/* The Text was explicitly requested to remove the emoji */}
            <AppText style={styles.title}>Let's get started.</AppText>
            <TypeWriterText 
              style={styles.subtitle} 
              text="Create your secure profile to begin your journey and watch your impact grow over time." 
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
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={24}
                    style={{ width: "100%", height: 48 }}
                    onPress={handleAppleAuth}
                  />
                )}

                <Pressable onPress={() => setStep("email")} style={styles.emailTextBtn}>
                  <AppText style={styles.emailTextBtnLabel}>
                    or continue with email
                  </AppText>
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
                  <AppText style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontFamily: font.medium }}>Back to options</AppText>
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

            <AppText style={styles.terms}>
              By continuing, you agree to our{"\n"}
              <AppText style={{ textDecorationLine: "underline" }}>Terms</AppText> & <AppText style={{ textDecorationLine: "underline" }}>Privacy Policy</AppText>.
            </AppText>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080a0c" },
  header: { alignItems: "center", paddingVertical: 16 },
  content: { flex: 1, paddingHorizontal: 24, paddingBottom: 24, justifyContent: "flex-end" },
  
  title: { fontSize: 32, fontFamily: font.bold, color: colors.surface, marginBottom: 12, textAlign: "center", lineHeight: 40, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.7)", textAlign: "center", marginBottom: 32, lineHeight: 22, paddingHorizontal: 16 },
  
  authOptions: { gap: 12, marginBottom: 32 },
  authForm: { gap: 12, marginBottom: 32 },
  
  socialBtnPrimary: {
    height: 48,
    backgroundColor: colors.brandPrimary,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
  socialTextSolid: { color: "#0A1A0F", fontSize: 16, fontFamily: font.semibold },
  socialTextCentered: { color: "#0A1A0F", fontSize: 16, fontFamily: font.semibold },

  emailTextBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  emailTextBtnLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontFamily: font.medium,
    textDecorationLine: "underline",
    letterSpacing: 0.2,
  },
  
  socialBtnOutline: {
    height: 48,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  socialTextOutline: { color: colors.surface, fontSize: 16, fontFamily: font.semibold },
  socialIconWrap: { width: 24, alignItems: "center", marginRight: 8 },
  
  input: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 24,
    fontSize: 16,
    color: colors.surface,
    fontFamily: font.medium,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.05)"
  },
  
  error: { color: colors.error, fontSize: 14, marginTop: 12, textAlign: "center" },
  terms: { fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", lineHeight: 18, fontFamily: font.medium },
});
