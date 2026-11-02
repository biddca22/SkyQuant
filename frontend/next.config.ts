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
  async rewrites() {
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/flights/:path*",
          destination: "http://127.0.0.1:8000/api/flights/:path*",
        },
        {
          source: "/api/flight/:path*",
          destination: "http://127.0.0.1:8000/api/flight/:path*",
        },
        {
          source: "/api/random-flight",
          destination: "http://127.0.0.1:8000/api/random-flight",
        },
        {
          source: "/api/telemetry/:path*",
          destination: "http://127.0.0.1:8000/api/telemetry/:path*",
        },
      ];
    }
    return [];
  },
};

export default nextConfig;