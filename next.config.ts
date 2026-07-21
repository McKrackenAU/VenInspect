import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "sharp",
    "pdfkit",
    "@prisma/client",
    "@prisma/adapter-libsql",
  ],
  // Phone camera photos are often 3–12 MB; default server-action limit is ~1 MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
