import type { NextConfig } from "next";
import path from "node:path";

const lazyAuthClientEnabled =
  process.env.PROJECT_SPEED_LAZY_AUTH_CLIENT === "1";

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
  webpack(config, { webpack }) {
    if (lazyAuthClientEnabled) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /StudentAuthFormLegacy$/,
          path.resolve(
            process.cwd(),
            "components/auth/StudentAuthFormLazy.tsx"
          )
        )
      );
    }
    return config;
  },
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
