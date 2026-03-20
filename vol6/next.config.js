/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/SOME_DEMO/tulip-v2',
  images: { unoptimized: true },
  reactStrictMode: false,
};
module.exports = nextConfig;