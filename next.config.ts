import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: [
    "@midnight-ntwrk/compact-runtime",
    "@midnightntwrk/onchain-runtime-v4",
  ],
};

export default nextConfig;
