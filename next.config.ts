import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@prisma/client", "@prisma/adapter-libsql"],
};

export default nextConfig;
