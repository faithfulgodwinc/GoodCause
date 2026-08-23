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

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// Configure RevenueCat once at module scope, before any component mounts.
try {
  initializeRevenueCat();
} catch (err) {
  console.warn("RevenueCat unavailable:", err);
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const CDN = "https://cdn.jsdelivr.net/fontsource/fonts";

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    "Inter-Regular": `${CDN}/inter@latest/latin-400-normal.ttf`,
    "Inter-Medium": `${CDN}/inter@latest/latin-500-normal.ttf`,
    "Inter-SemiBold": `${CDN}/inter@latest/latin-600-normal.ttf`,
    "Inter-Bold": `${CDN}/inter@latest/latin-700-normal.ttf`,
  });

  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
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
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="auth/index" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="campaign/[id]" options={{ animation: "slide_from_right" }} />
                  <Stack.Screen name="campaign/new" options={{ animation: "slide_from_bottom" }} />
                  <Stack.Screen name="donate/[id]" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                  <Stack.Screen name="paywall" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                  <Stack.Screen name="circles/index" />
                  <Stack.Screen name="circles/[id]" />
                  <Stack.Screen name="update/[id]" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                  <Stack.Screen name="admin/index" />
                </Stack>
              </View>
            </SubscriptionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
