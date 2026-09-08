import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/auth";
import { colors } from "@/src/theme";
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
    return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  }

  // First-time user who hasn't seen onboarding yet
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  if (!user) return <Redirect href="/auth" />;

  return <Redirect href="/(tabs)" />;
}
