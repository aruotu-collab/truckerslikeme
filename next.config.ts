import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/money", destination: "/", permanent: false },
      { source: "/check", destination: "/", permanent: false },
      { source: "/members", destination: "/me", permanent: false },
      { source: "/live", destination: "/trip?tab=live", permanent: false },
      { source: "/plan", destination: "/trip?tab=plan", permanent: false },
    ];
  },
};

export default nextConfig;
