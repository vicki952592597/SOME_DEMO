'use client';
/**
 * ============================================================
 * 主页面 (page.tsx)
 * ============================================================
 * 使用 R3F 的 Canvas 组件，包裹整个 3D 场景
 */
import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';

// 动态导入 Scene 组件，禁用 SSR（Three.js 需要 DOM）
const SceneContent = dynamic(() => import('@/components/Scene'), { ssr: false });

export default function Home() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#08081e' }}>
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 100, position: [0, 1, 3] }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: 0, // NoToneMapping
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}