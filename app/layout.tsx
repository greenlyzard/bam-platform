import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/bam/theme-provider";
import { getStudioSettings } from "@/lib/queries/studio-settings";

const cormorant = Cormorant_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  let studioName = "Ballet Academy & Movement";
  let faviconUrl: string | null = null;
  let appIconUrl: string | null = null;

  try {
    const settings = await getStudioSettings();
    if (settings) {
      studioName = settings.studio_name ?? studioName;
      faviconUrl = settings.favicon_url ?? null;
      appIconUrl = settings.app_icon_url ?? null;
    }
  } catch {
    // Settings table may not exist yet
  }

  return {
    title: studioName,
    description:
      "Real ballet training in a nurturing environment. San Clemente, California.",
    icons: {
      icon: faviconUrl
        ? [{ url: faviconUrl }]
        : [
            { url: "/favicon.ico", sizes: "48x48" },
            { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
            { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
          ],
      shortcut: faviconUrl ?? "/favicon-16x16.png",
      apple: appIconUrl ?? "/apple-touch-icon.png",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let themePreset = "lavender-cream";
  let customColors = {};
  try {
    const settings = await getStudioSettings();
    if (settings) {
      themePreset = settings.theme_preset;
      customColors = settings.custom_colors ?? {};
    }
  } catch {
    // Settings table may not exist yet — use defaults
  }

  return (
    <html lang="en">
      <body
        className={`${cormorant.variable} ${montserrat.variable} font-body antialiased bg-cream text-charcoal`}
      >
        <ThemeProvider presetId={themePreset} customColors={customColors}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
