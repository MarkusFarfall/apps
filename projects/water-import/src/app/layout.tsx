import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/game/ServiceWorker";
// Шрифты подключены локально (@fontsource) — сборка не зависит от Google Fonts.
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import type { ReactNode } from "react";
import "./globals.css";

// Адрес площадки нужен для абсолютных OpenGraph-ссылок. Берём явно заданный SITE_URL,
// иначе домен production-проекта на Vercel, а локально — адрес dev-сервера.
const siteUrl = process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000");

export const metadata: Metadata = {
  title: "Знакомая вода — симулятор морской рыбалки",
  description: "Лодка, удочка, море и одинокий рыбак на рассвете. Двенадцать акваторий, триста видов рыб, пять портов, погода, сезоны и ежедневные задания.",
  applicationName: "Знакомая вода",
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
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
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-[#050a12] text-[#e6e1d6] antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
