import { useEffect, useState } from "react";
import { View, Platform } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/auth";
import { colors } from "@/src/theme";
import { BrandLogo, AppText } from "@/src/components/ui";
import { track } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";

const ONBOARDING_DONE_KEY = "gc_onboarding_done";

export default function Index() {
  const { user, loading } = useAuth();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    track("app_open");
  }, []);

  useEffect(() => {
    // Force clear for testing
    storage.removeItem(ONBOARDING_DONE_KEY).then(() => {
      // Check if this user has already completed onboarding.
      storage.getItem(ONBOARDING_DONE_KEY, false).then((done) => {
        setOnboardingDone(!!done);
        setOnboardingChecked(true);
      });
    });
  }, []);

  if (loading || !onboardingChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
        <BrandLogo size={42} color="#000000" />
      </View>
    );
  }

  // First-time mobile user who hasn't seen onboarding yet (skipped on web)
  if (!onboardingDone && Platform.OS !== "web") return <Redirect href="/onboarding" />;

  if (!user) return <Redirect href="/auth" />;

  return <Redirect href="/(tabs)" />;
}
