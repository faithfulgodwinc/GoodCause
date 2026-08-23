import { useWindowDimensions } from "react-native";

// Adaptive breakpoints for Galaxy Z Fold (open), tablets and large Android devices.
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 700; // fold open / small tablet
  const isXWide = width >= 1024; // large tablet
  const columns = isXWide ? 3 : isWide ? 2 : 1;
  const maxContentWidth = isXWide ? 1120 : isWide ? 860 : width;
  return { width, height, isWide, isXWide, columns, maxContentWidth };
}
