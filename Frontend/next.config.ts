import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next.js dev/HMR resources to load through the Arena/e2b preview proxy.
  allowedDevOrigins: ["*.e2b.app"],
  // node-postgres and Prisma ship native runtime assets — keep them out of the
  // server bundle so they can load from node_modules at runtime.
  serverExternalPackages: [
    "ws",
    "pg",
    "@prisma/adapter-pg",
    "@prisma/client",
    "@prisma/client-runtime-utils",
    "@prisma/query-plan-executor",
  ],
};

export default nextConfig;
