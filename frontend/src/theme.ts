// GoodCause Design Tokens — Warm, trusted Nigerian crowdfunding theme.
export const colors = {
  // surfaces
  surface: "#FAF8F5",
  onSurface: "#23211F",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#5C5954",
  surfaceTertiary: "#F3EFEA",
  onSurfaceTertiary: "#8A847C",
  surfaceInverse: "#23211F",
  onSurfaceInverse: "#FAF8F5",

  // brand — Trust Green
  brand: "#2D7A5D",
  brandPrimary: "#2D7A5D",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#439373",
  brandTertiary: "#EAF4EF",
  onBrandTertiary: "#205742",
  brandDark: "#1E543F",

  // warm amber accent
  accent: "#D99026",
  accentStrong: "#B87314",
  onAccent: "#FFFFFF",
  accentTint: "#FBF1E0",

  // semantic
  success: "#2D7A5D",
  onSuccess: "#FFFFFF",
  warning: "#D99026",
  onWarning: "#FFFFFF",
  error: "#B83A3A",
  onError: "#FFFFFF",
  info: "#3A7299",
  onInfo: "#FFFFFF",

  // lines / neutrals
  border: "#EBE6DF",
  borderStrong: "#D5CEC4",
  divider: "#F1ECE5",
  muted: "#9E988F",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const radius = { sm: 6, md: 12, lg: 18, xl: 24, pill: 999 };

// Inter / System font
export const font = {
  display: "Inter-Bold",
  displaySemi: "Inter-SemiBold",
  regular: "Inter-Regular",
  medium: "Inter-Medium",
  semibold: "Inter-SemiBold",
  bold: "Inter-Bold",
};

export const shadow = {
  soft: {
    shadowColor: "#23211F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  card: {
    shadowColor: "#23211F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  raised: {
    shadowColor: "#23211F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
};

// Category accent colors
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
