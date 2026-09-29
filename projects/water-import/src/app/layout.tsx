import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const sans = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-text",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Знакомая вода — симулятор морской рыбалки",
  description: "Лодка, удочка, море и одинокий рыбак на рассвете. Двенадцать акваторий, триста видов рыб, пять портов, погода, сезоны и ежедневные задания.",
  applicationName: "Знакомая вода",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon.jpg", type: "image/jpeg" }], apple: [{ url: "/icon.jpg" }] },
  openGraph: {
    title: "Знакомая вода",
    description: "Симулятор морской рыбалки: двенадцать акваторий, триста видов рыб, пять портов.",
    images: [{ url: "/icon.jpg", width: 1024, height: 1024 }],
    locale: "ru_RU",
    type: "website",
  },
  appleWebApp: { capable: true, title: "Знакомая вода", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#050a12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${serif.variable} ${sans.variable}`}>
      <body className="bg-[#050a12] text-[#e6e1d6] antialiased">{children}</body>
    </html>
  );
}
