// GoodCause Design Tokens — Inspired by GoFundMe's clean, trusted, signature UI.
export const colors = {
  // Pure white canvas & clean neutral typography
  surface: "#FFFFFF",
  surfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#F7F7F8",
  surfaceHover: "#EFEFEF",
  surfaceInverse: "#1A1A1A",

  onSurface: "#1A1A1A",          // GoFundMe deep charcoal/black
  onSurfaceSecondary: "#595959", // Clear readable secondary text
  onSurfaceTertiary: "#8C8C8C",  // Timestamps and metadata
  onSurfaceInverse: "#FFFFFF",

  // brand — GoodCause Green (as per design mockup)
  brand: "#16A34A",
  brandPrimary: "#16A34A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#22C55E",
  brandTertiary: "#E8F9F1",
  onBrandTertiary: "#15803D",
  brandDark: "#14532D",

  // Warm accent & semantic
  accent: "#F59E0B",
  accentTint: "#FEF3C7",
  success: "#16A34A",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  onWarning: "#FFFFFF",
  error: "#E02E2E",
  onError: "#FFFFFF",
  info: "#0284C7",
  onInfo: "#FFFFFF",

  // Clean borders & dividers
  border: "#EDEDED",
  borderStrong: "#DFDFDF",
  divider: "#F0F0F0",
  muted: "#8C8C8C",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const radius = { sm: 6, md: 12, lg: 16, xl: 22, pill: 999 };

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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  raised: {
    shadowColor: "#02A95C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
  },
};

export const CATEGORY_COLORS: Record<string, string> = {
  medical: "#E02E2E",
  education: "#0284C7",
  emergency: "#D97706",
  community: "#16A34A",
  memorial: "#6B7280",
  business: "#8B5CF6",
  environment: "#16A34A",
  animals: "#78716C",
  others: "#71717A",
};
