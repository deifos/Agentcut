import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image (see Dockerfile).
  output: "standalone",
  experimental: {
    agentUpgrade: "security",
    optimizePackageImports: ["lucide-react"],
  },
  // 3D device models load from local renders too (motion/components/cinematic/devices3d).
  async headers() {
    // Landing page media: cache for a day and revalidate in the background (the names aren't
    // versioned, so not immutable).
    const media = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    return [
      { source: "/models/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
      { source: "/demo/:path*", headers: media },
      { source: "/hero/:path*", headers: media },
      { source: "/studio/style-demo.mp4", headers: media },
      // Community styles: self-hosted studios read the main site's catalog. Files change when a
      // style gets a new revision, so keep the cache short.
      {
        source: "/community-styles/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
