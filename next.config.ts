import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Zorg dat de AI knowledge-markdown meegaat in de serverless bundle (anders
  // faalt readFile in productie). Lokaal niet nodig, maar voorkomt een prod-landmijn.
  outputFileTracingIncludes: {
    "/admin/**": ["./knowledge/**/*.md"],
  },
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
