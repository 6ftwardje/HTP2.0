import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.mux.com",
      },
      {
        protocol: "https",
        hostname: "trogwrgxxhsvixzglzpn.supabase.co",
      },
    ],
  },
};

export default nextConfig;
