import { useRouter } from "expo-router";
import { Platform } from "react-native";
import { useSubscription } from "@/src/lib/revenuecat";

/**
 * Returns a `triggerPaywall` function you can call from any screen when
 * a user tries to access a Pro-only feature.
 *
 * Usage:
 *   const { triggerPaywall } = usePaywallTrigger();
 *   // In a button handler:
 *   if (!isSubscribed) { triggerPaywall(); return; }
 */
export function usePaywallTrigger() {
  const router = useRouter();
  const { isSubscribed } = useSubscription();

  const triggerPaywall = () => {
    router.push("/paywall");
  };

  /**
   * Guards a callback behind Pro subscription.
   * If the user is subscribed, runs `action`. Otherwise opens the paywall.
   */
  const withPro = (action: () => void) => {
    if (Platform.OS === "ios" || isSubscribed) {
      action();
    } else {
      triggerPaywall();
    }
  };

  return { isSubscribed, triggerPaywall, withPro };
}
