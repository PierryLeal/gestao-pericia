import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The import screen sends a whole .xlsx to a Server Action; Next's default
      // 1MB body cap is easy for a real spreadsheet to exceed once RSC-serialized.
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
