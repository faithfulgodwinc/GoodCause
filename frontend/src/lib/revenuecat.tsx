import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import type { CustomerInfo } from "react-native-purchases";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "pro";
export const rcEnabled = Platform.OS !== "web" || __DEV__;

const DEV_STORAGE_KEY = "@goodcause_pro_subscribed";

// Built-in sandbox packages for development and testing
export const SANDBOX_PACKAGES: any[] = [
  {
    identifier: "tier_1k",
    packageType: "MONTHLY",
    product: {
      identifier: "gc_monthly_1k",
      title: "GoodCause Pro Starter",
      description: "Run multiple active campaigns.",
      priceString: "₦1,000",
      price: 1000,
      currencyCode: "NGN",
    },
  },
  {
    identifier: "tier_2k5",
    packageType: "MONTHLY",
    product: {
      identifier: "gc_monthly_2k5",
      title: "GoodCause Pro Plus",
      description: "Multiple campaigns plus organizer tools.",
      priceString: "₦2,500",
      price: 2500,
      currencyCode: "NGN",
    },
  },
  {
    identifier: "tier_5k",
    packageType: "MONTHLY",
    product: {
      identifier: "gc_monthly_5k",
      title: "GoodCause Pro Growth",
      description: "Organizer tools for active fundraisers.",
      priceString: "₦5,000",
      price: 5000,
      currencyCode: "NGN",
    },
  },
  {
    identifier: "tier_10k",
    packageType: "MONTHLY",
    product: {
      identifier: "gc_monthly_10k",
      title: "GoodCause Pro Champion",
      description: "Full Pro access for active organizers.",
      priceString: "₦10,000",
      price: 10000,
      currencyCode: "NGN",
    },
  },
];

function getRevenueCatApiKey() {
  if (Platform.OS === "ios" && REVENUECAT_IOS_API_KEY) return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android" && REVENUECAT_ANDROID_API_KEY) return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY || null;
}

export function initializeRevenueCat() {
  if (!rcEnabled) return;
  const key = getRevenueCatApiKey();
  if (!key) return;
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: key });
  } catch (e) {
    console.warn("RevenueCat config error:", e);
  }
}

function useSubscriptionContext() {
  const queryClient = useQueryClient();
  const [devSubscribed, setDevSubscribed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DEV_STORAGE_KEY).then((v) => {
      if (v === "true") setDevSubscribed(true);
    });
  }, []);

  const key = getRevenueCatApiKey();

  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: async () => {
      if (!key) return null;
      try {
        return await Purchases.getCustomerInfo();
      } catch {
        return null;
      }
    },
    enabled: rcEnabled && !!key,
    staleTime: 60 * 1000,
    retry: false,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      if (!key) return null;
      try {
        return await Purchases.getOfferings();
      } catch {
        return null;
      }
    },
    enabled: rcEnabled && !!key,
    staleTime: 300 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!rcEnabled || !key) return;
    const listener = (info: CustomerInfo) =>
      queryClient.setQueryData(["revenuecat", "customer-info"], info);
    try {
      Purchases.addCustomerInfoUpdateListener(listener);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(listener);
      };
    } catch {}
  }, [queryClient, key]);

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: any) => {
      if (!key) {
        // Sandbox simulation
        await AsyncStorage.setItem(DEV_STORAGE_KEY, "true");
        setDevSubscribed(true);
        return { active: true };
      }
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!key) {
        await AsyncStorage.setItem(DEV_STORAGE_KEY, "true");
        setDevSubscribed(true);
        return { active: true };
      }
      return await Purchases.restorePurchases();
    },
  });

  const liveSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
  const isSubscribed = liveSubscribed || devSubscribed;
  const originalAppUserId = customerInfoQuery.data?.originalAppUserId;
  const identityReady = !key || (!!originalAppUserId && !originalAppUserId.startsWith("$RCAnonymousID:"));

  // If live offerings are present, use them. Otherwise fallback to sandbox packages.
  const livePackages = offeringsQuery.data?.current?.availablePackages || [];
  const availablePackages = livePackages.length > 0 ? livePackages : SANDBOX_PACKAGES;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    availablePackages,
    isSubscribed,
    identityReady,
    rcEnabled,
    isLoading: key ? (customerInfoQuery.isLoading || offeringsQuery.isLoading) : false,
    offeringsError: false,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}
