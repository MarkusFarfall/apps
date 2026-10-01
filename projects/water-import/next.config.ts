import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Arena/Vercel preview proxies use a generated subdomain; allow it in dev for HMR and route requests.
  allowedDevOrigins: ["*.e2b.app"],
};

export default nextConfig;
