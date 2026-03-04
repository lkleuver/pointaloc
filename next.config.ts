import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/pointaloc",
  images: { unoptimized: true },
};

export default nextConfig;
