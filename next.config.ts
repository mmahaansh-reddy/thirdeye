import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No ESLint dependency yet; type safety is enforced by `tsc` during build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
