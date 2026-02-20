import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use static export in production, allow API routes in dev
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
