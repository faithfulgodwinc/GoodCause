import React, { useEffect, useRef, useState } from "react";
import { View, Animated, StyleSheet, Easing } from "react-native";
import { BrandLogo } from "@/src/components/ui";
import * as SplashScreen from "expo-splash-screen";

export function CustomSplashScreen({ onFinish }: { onFinish: () => void }) {
  const [isAnimating, setIsAnimating] = useState(true);
  
  // Animation values
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide the native splash screen as soon as our React Native one mounts
    SplashScreen.hideAsync().catch(() => {});

    // Phase 1: Subtle zoom and fade in of the text
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Phase 2: Wait for ~1.5s then fade out the whole container
    const timeout = setTimeout(() => {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setIsAnimating(false);
        onFinish();
      });
    }, 1500); // 1.5s wait + 500ms fadeout = 2 seconds total

    return () => clearTimeout(timeout);
  }, [scale, opacity, containerOpacity, onFinish]);

  if (!isAnimating) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: containerOpacity },
      ]}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          opacity,
        }}
      >
        <BrandLogo size={42} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
  },
});
