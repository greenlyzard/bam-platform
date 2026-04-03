import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin/schedule",
        destination: "/admin/classes",
        permanent: true,
      },
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
