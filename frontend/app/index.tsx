import { useEffect } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/auth";
import { colors } from "@/src/theme";
import { track } from "@/src/lib/api";

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    track("app_open");
  }, []);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  }
  if (!user) return <Redirect href="/auth" />;
  return <Redirect href="/(tabs)" />;
}
