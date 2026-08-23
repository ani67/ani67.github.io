import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use static export in production, allow API routes in dev
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  // Pin the workspace root. A stray lockfile in the home directory otherwise
  // makes Turbopack infer ~/ as the root and warn on every start.
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
