import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node-only packages (database driver, ONNX runtime for embeddings) stay out of the bundle
  serverExternalPackages: ["pg", "@huggingface/transformers", "onnxruntime-node", "sharp"],
  // Pin the project root so a stray lockfile in a parent folder is ignored
  turbopack: { root: process.cwd() },
};

export default nextConfig;
