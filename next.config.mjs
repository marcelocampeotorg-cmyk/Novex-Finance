/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  ...(process.env.DOCKER_BUILD === "true" ? { output: "standalone" } : {}),
};

export default nextConfig;
