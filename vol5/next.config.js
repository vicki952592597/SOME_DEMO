/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/SOME_DEMO/tulip',
  images: { unoptimized: true },
  reactStrictMode: false,
};
module.exports = nextConfig;