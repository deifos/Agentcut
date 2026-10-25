import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image (see Dockerfile).
  output: "standalone",
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // 3D device models load from local renders too (motion/components/cinematic/devices3d).
  async headers() {
    return [{ source: "/models/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
};

export default nextConfig;
