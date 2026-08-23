// GoodCause Design Tokens — Rappi-inspired clean surfaces, vibrant classy accents, and soft diffuse shadows.
export const colors = {
  // surfaces
  surface: "#FAFAFC",
  onSurface: "#0F172A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#334155",
  surfaceTertiary: "#F1F5F9",
  onSurfaceTertiary: "#64748B",
  surfaceInverse: "#0F172A",
  onSurfaceInverse: "#FFFFFF",

  // Rappi-inspired brand & accent colors
  brand: "#16A34A",
  brandPrimary: "#16A34A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#22C55E",
  brandTertiary: "#DCFCE7",
  onBrandTertiary: "#15803D",
  brandDark: "#14532D",

  // Vibrant hero / promo accents (Rappi coral/tangerine + gold)
  coral: "#FF4A22",
  coralLight: "#FFF1EE",
  coralDark: "#E02E08",
  accent: "#F59E0B",
  accentStrong: "#D97706",
  onAccent: "#78350F",
  accentTint: "#FEF3C7",

  // Pastels for signature category hero cards
  pastelOrange: "#FFF3EB",
  pastelOrangeText: "#C2410C",
  pastelGreen: "#ECFDF5",
  pastelGreenText: "#047857",
  pastelBlue: "#EFF6FF",
  pastelBlueText: "#1D4ED8",
  pastelPurple: "#FAF5FF",
  pastelPurpleText: "#7E22CE",
  pastelYellow: "#FEFCE8",
  pastelYellowText: "#A16207",

  // semantic
  success: "#16A34A",
  onSuccess: "#FFFFFF",
  warning: "#EA580C",
  onWarning: "#FFFFFF",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#3B82F6",
  onInfo: "#FFFFFF",

  // lines / neutrals
  border: "#F1F5F9",
  borderStrong: "#E2E8F0",
  divider: "#F8FAFC",
  muted: "#94A3B8",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const radius = { sm: 10, md: 16, lg: 22, xl: 30, xxl: 38, pill: 999 };

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
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  raised: {
    shadowColor: "#FF4A22",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 8,
  },
  dock: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 12,
  },
};

// Category accent colors
export const CATEGORY_COLORS: Record<string, string> = {
  medical: "#EF4444",
  education: "#3B82F6",
  emergency: "#EA580C",
  community: "#10B981",
  memorial: "#8B5CF6",
  business: "#EC4899",
  environment: "#059669",
  animals: "#D97706",
};

