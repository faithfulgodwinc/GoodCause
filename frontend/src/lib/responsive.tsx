import React from "react";
import { useWindowDimensions, View, ViewStyle, StyleProp, Platform } from "react-native";
import { colors, radius, shadow, spacing } from "@/src/theme";

// Breakpoints for mobile, foldables, tablets, and desktop
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  const isWide = width >= 700;
  const isXWide = width >= 1024;

  const columns = width >= 1100 ? 3 : width >= 700 ? 2 : 1;
  const maxContentWidth = isXWide ? 1160 : isWide ? 860 : width;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    isXWide,
    columns,
    maxContentWidth,
    formMaxWidth: 480,
    feedMaxWidth: 680,
    modalMaxWidth: 560,
  };
}

export function ResponsiveContainer({
  children,
  maxWidth = 1160,
  style,
  asCard = false,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
  asCard?: boolean;
}) {
  const { width, isMobile } = useResponsive();
  const isConstrained = width > maxWidth;

  return (
    <View
      style={[
        {
          width: "100%",
          alignSelf: "center",
          maxWidth: isConstrained ? maxWidth : "100%",
        },
        asCard && !isMobile && {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadow.md,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

