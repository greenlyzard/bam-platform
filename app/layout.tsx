import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";
import { ChatbotWidget } from "@/components/bam/chatbot-widget";
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

export const metadata: Metadata = {
  title: "Ballet Academy and Movement",
  description:
    "Real ballet training in a nurturing environment. San Clemente, California.",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

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
        <ChatbotWidget />
      </body>
    </html>
  );
}
