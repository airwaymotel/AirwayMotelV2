import type { NextConfig } from "next";

// Vercel and Netlify each install their own Next.js runtime, so the
// standalone output (used only for the local bun/Caddy server) must be
// turned off in build clouds.
const isCloudBuild =
  process.env.VERCEL === "true" || process.env.NETLIFY === "true";

const nextConfig: NextConfig = {
  ...(isCloudBuild ? {} : { output: "standalone" as const }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-b5651a90-62fd-47b1-bd79-f6cc0a8027f0.space-z.ai",
    ".space-z.ai",
  ],
};

export default nextConfig;
