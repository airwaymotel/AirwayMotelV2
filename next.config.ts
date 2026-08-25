import type { NextConfig } from "next";

const isCloudBuild =
  process.env.VERCEL === "true" || process.env.NETLIFY === "true";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  ...(isCloudBuild ? {} : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/scan/(.*)',
        headers: securityHeaders.filter(h => h.key !== 'Permissions-Policy'),
      },
      {
        source: '/((?!scan/).*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
