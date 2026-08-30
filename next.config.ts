import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: without this, loading the dev server via 127.0.0.1 gets its
  // /_next/* chunks 403'd (cross-origin dev protection) and the page
  // renders with no client JS at all — no hydration, no animations.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
