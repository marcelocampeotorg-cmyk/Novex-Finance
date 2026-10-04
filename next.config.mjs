/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ["better-auth"],
  },
  ...(process.env.DOCKER_BUILD === "true" ? { output: "standalone" } : {}),
};

export default nextConfig;
