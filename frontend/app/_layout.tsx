import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/auth";
import { SubscriptionProvider, initializeRevenueCat } from "@/src/lib/revenuecat";
import { colors } from "@/src/theme";
import { GlobalHeader } from "@/src/components/GlobalHeader";
import { injectWebGlobalStyles } from "@/src/lib/WebGlobalStyles";
import { CustomSplashScreen } from "@/src/components/CustomSplashScreen";
import { useState } from "react";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// Configure RevenueCat and Web Styles once at module scope, before any component mounts.
try {
  initializeRevenueCat();
  injectWebGlobalStyles();
} catch (err) {
  console.warn("Initialization error:", err);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
});

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
  });

  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => { });
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SubscriptionProvider>
              <StatusBar style="dark" />
              <View style={{ flex: 1, backgroundColor: colors.surface }}>
                <GlobalHeader />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="auth" />
                  <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="campaign/[id]" options={{ animation: "slide_from_right" }} />
                  <Stack.Screen name="campaign/new" options={{ animation: "slide_from_bottom" }} />
                  <Stack.Screen name="donate/[id]" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                  <Stack.Screen name="paywall" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                  <Stack.Screen name="impact-commitment" options={{ animation: "slide_from_right" }} />
                  <Stack.Screen name="circles/index" />
                  <Stack.Screen name="circles/[id]" />
                  <Stack.Screen name="update/[id]" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                  <Stack.Screen name="fan-zone/setup" options={{ animation: "slide_from_right" }} />
                  <Stack.Screen name="fan-zone/[userId]" options={{ animation: "slide_from_right" }} />
                  <Stack.Screen name="admin/index" />
                  <Stack.Screen name="admin/impact" />
                </Stack>
              </View>
            </SubscriptionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
