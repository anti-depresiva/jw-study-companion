import type { NextConfig } from "next";

/**
 * Statische App für GitHub Pages: kein Server, keine Datenbank in der Cloud.
 * NEXT_PUBLIC_BASE_PATH = "/<repository-name>" (wird im GitHub-Workflow gesetzt).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
