"use client";

import { useEffect } from "react";
import { resolveThemeColors, themeToCssVars, type ThemeColors } from "@/lib/theme/themes";

interface ThemeProviderProps {
  presetId: string;
  customColors?: Partial<ThemeColors>;
  children: React.ReactNode;
}

/**
 * Applies theme CSS variables to the document root.
 * Renders children immediately — theme is applied via side effect.
 */
export function ThemeProvider({ presetId, customColors, children }: ThemeProviderProps) {
  useEffect(() => {
    const colors = resolveThemeColors(presetId, customColors);
    const vars = themeToCssVars(colors);
    const root = document.documentElement;

    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    return () => {
      for (const key of Object.keys(vars)) {
        root.style.removeProperty(key);
      }
    };
  }, [presetId, customColors]);

  return <>{children}</>;
}
