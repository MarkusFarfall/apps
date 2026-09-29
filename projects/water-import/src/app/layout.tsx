import type { Metadata, Viewport } from "next";
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

// Адрес площадки нужен для абсолютных OpenGraph-ссылок. Если SITE_URL не задан,
// metadataBase не подставляем: Next.js сам возьмёт адрес деплоя на Vercel
// (VERCEL_PROJECT_PRODUCTION_URL), а локально — http://localhost:3000.
const siteUrl = process.env.SITE_URL;

export const metadata: Metadata = {
  title: "Знакомая вода — симулятор морской рыбалки",
  description: "Лодка, удочка, море и одинокий рыбак на рассвете. Двенадцать акваторий, триста видов рыб, пять портов, погода, сезоны и ежедневные задания.",
  applicationName: "Знакомая вода",
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
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
    <html lang="ru">
      <body className="bg-[#050a12] text-[#e6e1d6] antialiased">{children}</body>
    </html>
  );
}
