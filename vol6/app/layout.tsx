import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '郁金香 — 生长动画',
  description: 'Interactive 3D Tulip Growth Animation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}