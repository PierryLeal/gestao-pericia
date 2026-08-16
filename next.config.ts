import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The import screen sends a whole .xlsx to a Server Action; Next's default
      // 1MB body cap is easy for a real spreadsheet to exceed once RSC-serialized.
      bodySizeLimit: '10mb',
    },
    // Defaults to true, and caches *every* server-side fetch (including
    // explicit cache:'no-store' ones) across HMR refreshes in dev, only
    // clearing on a hard navigation — not necessarily between Server Action
    // calls. Confirmed root cause of a real bug: an early, empty/stale
    // Supabase read got stuck in this cache and kept being served no matter
    // how many times the page was reloaded, until the dev server restarted.
    // Local-dev-only setting, zero effect in production.
    serverComponentsHmrCache: false,
  },
};

export default nextConfig;
