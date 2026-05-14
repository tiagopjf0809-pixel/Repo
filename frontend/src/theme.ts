/**
 * Lumi design tokens - mobile native.
 */

export const colors = {
  background: "#FAFAF8",
  surface: "#FFFFFF",
  surfaceSecondary: "#F3EFEA",
  primary: "#C09473",
  primaryHover: "#A67B5B",
  textMain: "#2A2421",
  textMuted: "#756B61",
  textOnDark: "#FFFFFF",
  border: "#E6E2DC",
  borderSoft: "rgba(230,226,220,0.5)",
  success: "#5C7053",
  warning: "#D4A373",
  ctaBg: "#2A2421",
  ctaText: "#FFFFFF",
  budgetBg: "rgba(192,148,115,0.12)",
  budgetText: "#A67B5B",
  sustainBg: "rgba(92,112,83,0.12)",
  sustainText: "#5C7053",
  overlay: "rgba(42,36,33,0.55)",
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const shadows = {
  card: {
    shadowColor: "#2A2421",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  cta: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
};

export const typography = {
  h1: { fontSize: 32, letterSpacing: -1, fontWeight: "300" as const, color: colors.textMain },
  h2: { fontSize: 24, letterSpacing: -0.5, fontWeight: "500" as const, color: colors.textMain },
  h3: { fontSize: 18, letterSpacing: -0.2, fontWeight: "600" as const, color: colors.textMain },
  body: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  small: { fontSize: 13, color: colors.textMuted },
  overline: { fontSize: 11, letterSpacing: 2, textTransform: "uppercase" as const, fontWeight: "600" as const, color: colors.primary },
  brand: { fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" as const, fontWeight: "700" as const, color: colors.textMuted },
  price: { fontSize: 14, fontWeight: "600" as const, color: colors.textMain },
};
