/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/SOME_DEMO/dahlia-v3',
  images: { unoptimized: true },
  // 关闭 React 严格模式（R3F 在严格模式下会 double mount 导致 WebGL 资源泄漏）
  reactStrictMode: false,
};
module.exports = nextConfig;