import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // NOTE: /admin/schedule → /admin/classes was removed 2026-07-30.
      // It landed 2026-03-31 (f629df2) implementing the merge proposed in
      // docs/UNIFIED_SCHEDULE.md, which was then REJECTED 2026-04-29 —
      // four weeks after the redirect shipped. Removing it restores the
      // April decision. Both surfaces stay, separate and intentional:
      // /admin/schedule is the operational live view, /admin/classes is
      // class management (future Class Builder). This is NOT a revival of
      // UNIFIED_SCHEDULE.md, which remains rejected.
      {
        source: "/portal/children",
        destination: "/portal/students",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/widget/:path*",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;
