import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/cormorant-garamond/wght.css";
import "@fontsource-variable/cormorant-garamond/wght-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Знакомая вода — симулятор морской рыбалки",
  description: "Лодка, удочка, море и одинокий рыбак на рассвете. Двенадцать акваторий, триста видов рыб, пять портов, погода, сезоны и ежедневные задания.",
  applicationName: "Знакомая вода",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/icon.png", sizes: "512x512", type: "image/png" }],
  },
  openGraph: {
    title: "Знакомая вода",
    description: "Симулятор морской рыбалки: двенадцать акваторий, триста видов рыб, пять портов.",
    images: [{ url: "/icon.png", width: 512, height: 512 }],
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
    <html lang="ru">
      <body className="bg-[#050a12] text-[#e6e1d6] antialiased">{children}</body>
    </html>
  );
}
