import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker development port is published on this loopback address.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
