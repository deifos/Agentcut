import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image (see Dockerfile).
  output: "standalone",
  experimental: {
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
    ];
  },
};

export default nextConfig;
