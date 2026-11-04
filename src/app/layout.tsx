import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { siteConfig } from "@/config/site";
import { LocaleProvider } from "@/components/locale-provider";
import { Toaster } from "@/components/ui/toaster";
import { getLocale, getTheme } from "@/server/locale";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: `${siteConfig.name} — vidéos sur les véhicules motorisés`, template: `%s · ${siteConfig.name}` },
  description: siteConfig.tagline,
  applicationName: siteConfig.name,
  openGraph: { type: "website", siteName: siteConfig.name, locale: "fr_FR", url: siteConfig.url },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0c0f" },
    { media: "(prefers-color-scheme: light)", color: "#f6f6f3" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  return (
    <html lang={locale} data-theme={theme} className={`${inter.variable} ${grotesk.variable}`}>
      <body>
        <LocaleProvider locale={locale}>
          {children}
          <Toaster />
        </LocaleProvider>
      </body>
    </html>
  );
}
