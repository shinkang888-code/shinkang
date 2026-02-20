/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3001", "localhost:3000"] },
  },
  serverExternalPackages: ["bcryptjs", "@prisma/client", ".prisma"],
};

export default nextConfig;
