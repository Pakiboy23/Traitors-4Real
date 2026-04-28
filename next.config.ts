import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.CAPACITOR_BUNDLED === "1" ? "export" : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
