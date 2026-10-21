import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "*.run.app",
    "ais-dev-dou76kzxfx33uewp2z6qlm-363954431506.europe-west2.run.app",
    "ais-pre-dou76kzxfx33uewp2z6qlm-363954431506.europe-west2.run.app",
    "localhost:3000",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;