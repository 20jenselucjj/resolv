import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress responses with gzip
  compress: true,

  // React strict mode (catches bugs, no perf cost in prod)
  reactStrictMode: true,

  // Modern image formats & responsive sizes
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 768, 1024, 1280, 1536],
  },
};

export default nextConfig;
