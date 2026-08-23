// GoodCause design tokens — Deep green primary, warm gold accent, clean white. (Inter / SF Pro)
export const colors = {
  // surfaces
  surface: "#F9FAFB",
  onSurface: "#111827",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#374151",
  surfaceTertiary: "#F3F4F6",
  onSurfaceTertiary: "#6B7280",
  surfaceInverse: "#0F1F17",
  onSurfaceInverse: "#F0FDF4",

  // brand (deep green)
  brand: "#16A34A",
  brandPrimary: "#16A34A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#22C55E",
  brandTertiary: "#DCFCE7",
  onBrandTertiary: "#15803D",
  brandDark: "#166534",

  // accent (warm gold)
  accent: "#FBBF24",
  accentStrong: "#D97706",
  onAccent: "#78350F",
  accentTint: "#FEF3C7",

  // semantic
  success: "#16A34A",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#2563EB",
  onInfo: "#FFFFFF",

  // lines / neutrals
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  divider: "#EEF0F2",
  muted: "#9CA3AF",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 };

// Inter across the app (per design spec).
export const font = {
  display: "Inter-Bold",
  displaySemi: "Inter-SemiBold",
  regular: "Inter-Regular",
  medium: "Inter-Medium",
  semibold: "Inter-SemiBold",
  bold: "Inter-Bold",
};

export const shadow = {
  card: {
    shadowColor: "#0B1F13",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  raised: {
    shadowColor: "#0B1F13",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
};

// Category accent colors — green-forward with tasteful variety on white.
export const CATEGORY_COLORS: Record<string, string> = {
  medical: "#16A34A",
  education: "#2563EB",
  emergency: "#D97706",
  community: "#0D9488",
  memorial: "#7C3AED",
  business: "#DB2777",
  environment: "#059669",
  animals: "#B45309",
};
