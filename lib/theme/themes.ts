/**
 * Theme presets for the BAM platform.
 * Each preset defines the full color palette used across the UI.
 * Custom themes override individual colors on top of a base preset.
 */

export interface ThemeColors {
  /** Primary brand color */
  primary: string;
  /** Darker shade for hover/active */
  primaryDark: string;
  /** Lighter shade for backgrounds */
  primaryLight: string;
  /** Page background */
  background: string;
  /** Warm white for inputs */
  warmWhite: string;
  /** Accent color (CTAs, badges) */
  accent: string;
  /** Accent dark for hover */
  accentDark: string;
  /** Accent light for tinted backgrounds */
  accentLight: string;
  /** Primary text */
  charcoal: string;
  /** Secondary text */
  slate: string;
  /** Placeholder/disabled text */
  mist: string;
  /** Borders */
  silver: string;
  /** Subtle backgrounds */
  cloud: string;
  /** Success */
  success: string;
  /** Warning */
  warning: string;
  /** Error */
  error: string;
  /** Info */
  info: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "lavender-cream",
    name: "Lavender & Cream",
    description: "The signature BAM palette — refined, feminine, classical",
    colors: {
      primary: "#9C8BBF",
      primaryDark: "#6B5A99",
      primaryLight: "#C4B8D9",
      background: "#FAF8F3",
      warmWhite: "#FEFDFB",
      accent: "#C9A84C",
      accentDark: "#9B7A2E",
      accentLight: "#E8D9A0",
      charcoal: "#2D2A33",
      slate: "#5A5662",
      mist: "#9E99A7",
      silver: "#D4D1D8",
      cloud: "#F0EDF3",
      success: "#5A9E6F",
      warning: "#D4A843",
      error: "#C45B5B",
      info: "#6B8FC4",
    },
  },
  {
    id: "rose-blush",
    name: "Rose & Blush",
    description: "Warm pink tones — playful yet elegant",
    colors: {
      primary: "#C48B9F",
      primaryDark: "#9E6B7F",
      primaryLight: "#E0B8C8",
      background: "#FDF8F6",
      warmWhite: "#FFFBFA",
      accent: "#D4956A",
      accentDark: "#B07548",
      accentLight: "#ECC8A8",
      charcoal: "#332A2D",
      slate: "#625558",
      mist: "#A7969A",
      silver: "#D8CED1",
      cloud: "#F5EDEF",
      success: "#6B9E7A",
      warning: "#D4A843",
      error: "#C45B5B",
      info: "#6B8FC4",
    },
  },
  {
    id: "midnight-gold",
    name: "Midnight & Gold",
    description: "Dark sophistication — dramatic, stage-ready",
    colors: {
      primary: "#2C3E5A",
      primaryDark: "#1A2840",
      primaryLight: "#5A7899",
      background: "#F5F3F0",
      warmWhite: "#FEFDFB",
      accent: "#C9A84C",
      accentDark: "#9B7A2E",
      accentLight: "#E8D9A0",
      charcoal: "#1A1A2E",
      slate: "#4A4A5C",
      mist: "#8E8E9E",
      silver: "#CCCCD4",
      cloud: "#EBEBF0",
      success: "#5A9E6F",
      warning: "#D4A843",
      error: "#C45B5B",
      info: "#6B8FC4",
    },
  },
  {
    id: "sage-ivory",
    name: "Sage & Ivory",
    description: "Earthy calm — grounded, natural, serene",
    colors: {
      primary: "#7A9E8B",
      primaryDark: "#5B7D6C",
      primaryLight: "#A8C4B4",
      background: "#F8F6F2",
      warmWhite: "#FEFDFB",
      accent: "#C4A87A",
      accentDark: "#9E845A",
      accentLight: "#E0D4B8",
      charcoal: "#2A3330",
      slate: "#556260",
      mist: "#99A7A2",
      silver: "#CDD6D2",
      cloud: "#ECF0ED",
      success: "#5A9E6F",
      warning: "#D4A843",
      error: "#C45B5B",
      info: "#6B8FC4",
    },
  },
  {
    id: "dusty-blue",
    name: "Dusty Blue",
    description: "Cool elegance — airy, coastal, composed",
    colors: {
      primary: "#7A9CB8",
      primaryDark: "#5A7C98",
      primaryLight: "#A8C0D4",
      background: "#F6F8FA",
      warmWhite: "#FEFEFF",
      accent: "#C4A060",
      accentDark: "#9E7E40",
      accentLight: "#E0D0A0",
      charcoal: "#2A2E33",
      slate: "#555E66",
      mist: "#99A2AA",
      silver: "#CDD3D8",
      cloud: "#ECF0F3",
      success: "#5A9E6F",
      warning: "#D4A843",
      error: "#C45B5B",
      info: "#6B8FC4",
    },
  },
  {
    id: "warm-charcoal",
    name: "Warm Charcoal",
    description: "Modern minimal — clean, neutral, bold",
    colors: {
      primary: "#5A5662",
      primaryDark: "#3D3A44",
      primaryLight: "#8A8694",
      background: "#F8F7F5",
      warmWhite: "#FEFDFB",
      accent: "#C9A84C",
      accentDark: "#9B7A2E",
      accentLight: "#E8D9A0",
      charcoal: "#2D2A33",
      slate: "#5A5662",
      mist: "#9E99A7",
      silver: "#D4D1D8",
      cloud: "#EDECED",
      success: "#5A9E6F",
      warning: "#D4A843",
      error: "#C45B5B",
      info: "#6B8FC4",
    },
  },
];

/** Available Google Fonts for heading/body selection */
export const FONT_OPTIONS = [
  { value: "Cormorant Garamond", label: "Cormorant Garamond", category: "serif" },
  { value: "Playfair Display", label: "Playfair Display", category: "serif" },
  { value: "Libre Baskerville", label: "Libre Baskerville", category: "serif" },
  { value: "DM Serif Display", label: "DM Serif Display", category: "serif" },
  { value: "Lora", label: "Lora", category: "serif" },
  { value: "Montserrat", label: "Montserrat", category: "sans-serif" },
  { value: "Raleway", label: "Raleway", category: "sans-serif" },
  { value: "Poppins", label: "Poppins", category: "sans-serif" },
  { value: "Nunito", label: "Nunito", category: "sans-serif" },
  { value: "Inter", label: "Inter", category: "sans-serif" },
  { value: "DM Sans", label: "DM Sans", category: "sans-serif" },
  { value: "Outfit", label: "Outfit", category: "sans-serif" },
] as const;

export type FontOption = (typeof FONT_OPTIONS)[number]["value"];

/** Build CSS variable map from theme colors */
export function themeToCssVars(colors: ThemeColors): Record<string, string> {
  return {
    "--color-lavender": colors.primary,
    "--color-lavender-dark": colors.primaryDark,
    "--color-lavender-light": colors.primaryLight,
    "--color-cream": colors.background,
    "--color-warm-white": colors.warmWhite,
    "--color-gold": colors.accent,
    "--color-gold-dark": colors.accentDark,
    "--color-gold-light": colors.accentLight,
    "--color-charcoal": colors.charcoal,
    "--color-slate": colors.slate,
    "--color-mist": colors.mist,
    "--color-silver": colors.silver,
    "--color-cloud": colors.cloud,
    "--color-success": colors.success,
    "--color-warning": colors.warning,
    "--color-error": colors.error,
    "--color-info": colors.info,
  };
}

/** Resolve final colors: preset + custom overrides */
export function resolveThemeColors(
  presetId: string,
  customColors: Partial<ThemeColors> = {}
): ThemeColors {
  const preset = THEME_PRESETS.find((p) => p.id === presetId) ?? THEME_PRESETS[0];
  return { ...preset.colors, ...customColors };
}
