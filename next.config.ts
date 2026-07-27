import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "sharp",
    "pdfkit",
    "@prisma/client",
    "@prisma/adapter-libsql",
  ],
  // Phone camera photos / Excel registry imports can be several MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
    // Next 16 proxies/clones bodies through middleware — raise with uploads.
    proxyClientMaxBodySize: "20mb",
  },
};

export default nextConfig;
