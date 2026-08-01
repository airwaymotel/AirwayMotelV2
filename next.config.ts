import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
