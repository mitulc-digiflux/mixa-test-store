import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Test store: every page reads live data (orders file, query params), so
  // Cache Components / PPR would only add Suspense boilerplate here.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // CSV images are already compressed webp on R2; skip the optimizer.
    unoptimized: true,
  },
};

export default nextConfig;
