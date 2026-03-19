import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
  server: {
    port: 3000,
    open: true,
  },
  // 允许直接导入 .wgsl 着色器文件为字符串
  assetsInclude: ['**/*.wgsl'],
});