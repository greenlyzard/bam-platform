"use client";

import { useState, useEffect } from "react";
import {
  THEME_PRESETS,
  FONT_OPTIONS,
  resolveThemeColors,
  themeToCssVars,
  type ThemeColors,
} from "@/lib/theme/themes";
import { updateThemeSettings } from "./actions";

interface ThemeEditorProps {
  initialStudioName: string;
  initialPreset: string;
  initialCustomColors: Partial<ThemeColors>;
  initialHeadingFont: string;
  initialBodyFont: string;
  initialLogoUrl: string;
  initialFaviconUrl: string;
  initialAppIconUrl: string;
}

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "primaryDark", label: "Primary Dark" },
  { key: "primaryLight", label: "Primary Light" },
  { key: "background", label: "Background" },
  { key: "accent", label: "Accent" },
  { key: "accentDark", label: "Accent Dark" },
  { key: "charcoal", label: "Text" },
  { key: "slate", label: "Secondary Text" },
  { key: "silver", label: "Borders" },
  { key: "cloud", label: "Subtle BG" },
];

export function ThemeEditor({
  initialStudioName,
  initialPreset,
  initialCustomColors,
  initialHeadingFont,
  initialBodyFont,
  initialLogoUrl,
  initialFaviconUrl,
  initialAppIconUrl,
}: ThemeEditorProps) {
  const [studioName, setStudioName] = useState(initialStudioName);
  const [preset, setPreset] = useState(initialPreset);
  const [customColors, setCustomColors] = useState<Partial<ThemeColors>>(initialCustomColors);
  const [headingFont, setHeadingFont] = useState(initialHeadingFont);
  const [bodyFont, setBodyFont] = useState(initialBodyFont);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [faviconUrl, setFaviconUrl] = useState(initialFaviconUrl);
  const [appIconUrl, setAppIconUrl] = useState(initialAppIconUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Live preview: apply CSS vars as they change
  useEffect(() => {
    const colors = resolveThemeColors(preset, customColors);
    const vars = themeToCssVars(colors);
    const root = document.documentElement;

    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    return () => {
      // Restore on unmount — re-apply initial
      const initial = resolveThemeColors(initialPreset, initialCustomColors);
      const initialVars = themeToCssVars(initial);
      for (const [key, value] of Object.entries(initialVars)) {
        root.style.setProperty(key, value);
      }
    };
  }, [preset, customColors, initialPreset, initialCustomColors]);

  const resolvedColors = resolveThemeColors(preset, customColors);

  function handleColorChange(key: keyof ThemeColors, value: string) {
    setCustomColors((prev) => ({ ...prev, [key]: value }));
  }

  function handleResetColors() {
    setCustomColors({});
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.set("studio_name", studioName);
    formData.set("theme_preset", preset);
    formData.set("custom_colors", JSON.stringify(customColors));
    formData.set("heading_font", headingFont);
    formData.set("body_font", bodyFont);
    formData.set("logo_url", logoUrl);
    formData.set("favicon_url", faviconUrl);
    formData.set("app_icon_url", appIconUrl);

    const result = await updateThemeSettings(formData);
    setSaving(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess("Theme saved successfully.");
    }
  }

  return (
    <div className="space-y-8">
      {/* Status messages */}
      {error && (
        <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
          {success}
        </div>
      )}

      {/* Section: Studio Branding */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-1">
          Studio Branding
        </h2>
        <p className="text-sm text-slate mb-4">
          Configure your studio name, favicon, and app icon.
        </p>
        <div className="space-y-6">
          {/* Studio Name */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              Studio Name
            </label>
            <input
              type="text"
              value={studioName}
              onChange={(e) => setStudioName(e.target.value)}
              placeholder="Ballet Academy & Movement"
              className="w-full max-w-md h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-mist">
              This name appears in the portal header, emails, and landing pages.
            </p>
          </div>

          {/* Favicon */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              Favicon
            </label>
            <div className="flex items-start gap-4">
              <div className="flex-1 max-w-md">
                <input
                  type="url"
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  placeholder="https://example.com/favicon.png"
                  className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
                />
                <p className="mt-1.5 text-xs text-mist">
                  PNG or ICO. Leave blank to use the default favicon.
                </p>
              </div>
              {faviconUrl && (
                <div className="h-10 w-10 rounded-lg border border-silver bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={faviconUrl}
                    alt="Favicon preview"
                    className="h-8 w-8 object-contain"
                  />
                </div>
              )}
            </div>
          </div>

          {/* App Icon */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              App Icon (iOS / Android)
            </label>
            <div className="flex items-start gap-4">
              <div className="flex-1 max-w-md">
                <input
                  type="url"
                  value={appIconUrl}
                  onChange={(e) => setAppIconUrl(e.target.value)}
                  placeholder="https://example.com/app-icon-180.png"
                  className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
                />
                <p className="mt-1.5 text-xs text-mist">
                  PNG, minimum 180x180. Used for Apple Touch Icon and Android home screen.
                </p>
              </div>
              {appIconUrl && (
                <div className="h-12 w-12 rounded-xl border border-silver bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={appIconUrl}
                    alt="App icon preview"
                    className="h-10 w-10 object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Section: Theme Presets */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-1">
          Theme Preset
        </h2>
        <p className="text-sm text-slate mb-4">
          Choose a base palette. You can customize individual colors below.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {THEME_PRESETS.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => {
                setPreset(theme.id);
                setCustomColors({});
              }}
              className={`group rounded-xl border-2 p-4 text-left transition-all ${
                preset === theme.id
                  ? "border-lavender bg-lavender/5 shadow-sm"
                  : "border-silver hover:border-lavender/50"
              }`}
            >
              {/* Color swatches */}
              <div className="flex gap-1.5 mb-3">
                <div
                  className="h-8 w-8 rounded-full border border-black/10"
                  style={{ backgroundColor: theme.colors.primary }}
                />
                <div
                  className="h-8 w-8 rounded-full border border-black/10"
                  style={{ backgroundColor: theme.colors.accent }}
                />
                <div
                  className="h-8 w-8 rounded-full border border-black/10"
                  style={{ backgroundColor: theme.colors.background }}
                />
                <div
                  className="h-8 w-8 rounded-full border border-black/10"
                  style={{ backgroundColor: theme.colors.charcoal }}
                />
              </div>
              <p className="text-sm font-semibold text-charcoal">
                {theme.name}
              </p>
              <p className="text-xs text-mist mt-0.5">
                {theme.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Section 2: Custom Color Builder */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-heading font-semibold text-charcoal">
              Custom Colors
            </h2>
            <p className="text-sm text-slate mt-0.5">
              Override individual colors from the selected preset.
            </p>
          </div>
          {Object.keys(customColors).length > 0 && (
            <button
              type="button"
              onClick={handleResetColors}
              className="text-xs text-mist hover:text-error font-medium"
            >
              Reset to preset
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {COLOR_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate mb-1.5">
                {label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={resolvedColors[key]}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="h-10 w-10 rounded-lg border border-silver cursor-pointer bg-transparent p-0.5"
                />
                <input
                  type="text"
                  value={resolvedColors[key]}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="flex-1 h-10 rounded-lg border border-silver bg-white px-3 text-xs font-mono text-charcoal uppercase focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
                  maxLength={7}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Fonts */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-1">
          Typography
        </h2>
        <p className="text-sm text-slate mb-4">
          Choose heading and body fonts from Google Fonts.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              Heading Font
            </label>
            <select
              value={headingFont}
              onChange={(e) => setHeadingFont(e.target.value)}
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            >
              {FONT_OPTIONS.filter((f) => f.category === "serif").map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
              <option disabled>───────────</option>
              {FONT_OPTIONS.filter((f) => f.category === "sans-serif").map(
                (f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                )
              )}
            </select>
            <p
              className="mt-2 text-lg text-charcoal"
              style={{ fontFamily: `'${headingFont}', serif` }}
            >
              The Nutcracker 2026
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              Body Font
            </label>
            <select
              value={bodyFont}
              onChange={(e) => setBodyFont(e.target.value)}
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            >
              {FONT_OPTIONS.filter((f) => f.category === "sans-serif").map(
                (f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                )
              )}
              <option disabled>───────────</option>
              {FONT_OPTIONS.filter((f) => f.category === "serif").map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <p
              className="mt-2 text-sm text-charcoal"
              style={{ fontFamily: `'${bodyFont}', sans-serif` }}
            >
              Classical ballet training in a nurturing environment for dancers
              ages 3 and up.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: Logo Upload */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-1">
          Logo
        </h2>
        <p className="text-sm text-slate mb-4">
          Paste a URL to your studio logo. Upload support coming soon.
        </p>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
          {logoUrl && (
            <div className="h-16 w-16 rounded-lg border border-silver bg-white flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Logo preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
        </div>
      </section>

      {/* Live Preview */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-4">
          Live Preview
        </h2>
        <div
          className="rounded-2xl border border-silver overflow-hidden"
          style={{ backgroundColor: resolvedColors.background }}
        >
          {/* Preview header */}
          <div
            className="px-6 py-4"
            style={{ backgroundColor: resolvedColors.primary }}
          >
            <p
              className="text-lg font-semibold text-white"
              style={{ fontFamily: `'${headingFont}', serif` }}
            >
              Ballet Academy and Movement
            </p>
          </div>
          {/* Preview body */}
          <div className="px-6 py-6 space-y-4">
            <h3
              className="text-xl font-semibold"
              style={{
                fontFamily: `'${headingFont}', serif`,
                color: resolvedColors.charcoal,
              }}
            >
              Welcome to Our Studio
            </h3>
            <p
              className="text-sm leading-relaxed"
              style={{
                fontFamily: `'${bodyFont}', sans-serif`,
                color: resolvedColors.slate,
              }}
            >
              Real ballet training in a nurturing environment. Small classes,
              professional faculty, and a community that celebrates every
              dancer&apos;s growth.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="h-10 rounded-lg px-5 text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: resolvedColors.primary }}
              >
                Schedule a Trial
              </button>
              <button
                type="button"
                className="h-10 rounded-lg px-5 text-sm font-semibold border-2 transition-colors"
                style={{
                  borderColor: resolvedColors.accent,
                  color: resolvedColors.accent,
                }}
              >
                View Classes
              </button>
            </div>
            {/* Sample cards */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {["Ballet Level 1", "Jazz Foundations", "Pre-Ballet"].map(
                (name) => (
                  <div
                    key={name}
                    className="rounded-xl p-4 border"
                    style={{
                      backgroundColor: resolvedColors.cloud,
                      borderColor: resolvedColors.silver,
                    }}
                  >
                    <p
                      className="text-sm font-semibold"
                      style={{ color: resolvedColors.charcoal }}
                    >
                      {name}
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ color: resolvedColors.mist }}
                    >
                      Mon & Wed · 4:00 PM
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-8 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Theme"}
        </button>
      </div>
    </div>
  );
}
