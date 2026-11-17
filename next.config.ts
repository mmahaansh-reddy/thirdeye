import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Funnel Items and Requests & Quotes were folded into Leads and Bookings.
  async redirects() {
    return [
      { source: "/funnel", destination: "/leads", permanent: false },
      { source: "/requests", destination: "/leads", permanent: false },
      { source: "/requests/:id", destination: "/leads?request=:id", permanent: false },
    ];
  },
  // No ESLint dependency yet; type safety is enforced by `tsc` during build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
