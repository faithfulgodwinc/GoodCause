// GoodCause design tokens (from design_guidelines.json). Warm terracotta / sand. No blue/indigo/purple.
export const colors = {
  surface: "#FAF8F5",
  onSurface: "#2C2926",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#3F3C38",
  surfaceTertiary: "#F1EFEA",
  onSurfaceTertiary: "#5C5954",
  surfaceInverse: "#23211F",
  onSurfaceInverse: "#F5F3EE",
  brand: "#C05C3D",
  brandPrimary: "#C05C3D",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E18E70",
  brandTertiary: "#F5DCD3",
  onBrandTertiary: "#7A3520",
  success: "#2D7A5D",
  onSuccess: "#FFFFFF",
  warning: "#D99026",
  onWarning: "#FFFFFF",
  error: "#B83A3A",
  onError: "#FFFFFF",
  info: "#4A6E82",
  onInfo: "#FFFFFF",
  border: "#E8E4DB",
  borderStrong: "#CFC9BC",
  divider: "#E8E4DB",
  muted: "#8A857D",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export const font = {
  display: "Fraunces-Bold",
  displaySemi: "Fraunces-SemiBold",
  regular: "Jakarta-Regular",
  medium: "Jakarta-Medium",
  semibold: "Jakarta-SemiBold",
  bold: "Jakarta-Bold",
};

export const shadow = {
  card: {
    shadowColor: "#2C2926",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  raised: {
    shadowColor: "#2C2926",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
};

export const CATEGORY_COLORS: Record<string, string> = {
  medical: "#B83A3A",
  education: "#4A6E82",
  emergency: "#D99026",
  community: "#2D7A5D",
  memorial: "#7A3520",
  business: "#C05C3D",
  environment: "#2D7A5D",
  animals: "#5C5954",
};
