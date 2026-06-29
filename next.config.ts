import type { NextConfig } from "next";

function getSupabaseHostname() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    return null;
  }
}

const supabaseImageHostnames = Array.from(
  new Set(
    [
      "trogwrgxxhsvixzglzpn.supabase.co",
      getSupabaseHostname(),
    ].filter((hostname): hostname is string => Boolean(hostname))
  )
);

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
      ...supabaseImageHostnames.map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/storage/v1/object/public/**",
      })),
    ],
  },
};

export default nextConfig;
