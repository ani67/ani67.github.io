import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use static export in production, allow API routes in dev
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  // The static host resolves directory indexes; Next's dev server needs an
  // explicit mapping for the standalone game in public/.
  ...(process.env.NODE_ENV === 'development' && {
    async rewrites() {
      return [
        { source: '/interplanetary-racers/', destination: '/interplanetary-racers/index.html' },
      ];
    },
  }),
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
