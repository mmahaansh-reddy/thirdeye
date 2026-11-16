import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The old Funnel Items page was merged into Leads & Funnel.
  async redirects() {
    return [{ source: "/funnel", destination: "/leads", permanent: false }];
  },
  // No ESLint dependency yet; type safety is enforced by `tsc` during build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
