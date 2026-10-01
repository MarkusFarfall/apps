import type { NextConfig } from "next";

/**
 * Заголовки безопасности.
 *
 * Игра целиком живёт на своём origin: canvas-сцена, WebAudio, локальные шрифты
 * (@fontsource) и service worker. Внешних CDN нет, поэтому CSP собирается без
 * исключений. `'unsafe-inline'` для скриптов нужен hydration-бутстрапу Next.js,
 * `'unsafe-eval'` — только в разработке (fast refresh).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // Arena/Vercel preview proxies use a generated subdomain; allow it in dev for HMR and route requests.
  allowedDevOrigins: ["*.e2b.app"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
