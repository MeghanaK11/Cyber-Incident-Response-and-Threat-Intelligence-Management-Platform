import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg and the transformers runtime are Node-only, keep them out of the bundle
  serverExternalPackages: ["pg"],
};

export default nextConfig;
