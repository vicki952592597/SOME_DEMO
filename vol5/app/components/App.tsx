'use client';
import { Canvas } from '@react-three/fiber';
import Scene from './Scene';
import ControlPanel from './ControlPanel';
import { useStore } from '@/app/store';

function ViewToggle() {
  const viewMode = useStore((s) => s.viewMode);
  const set = useStore((s) => s.set);
  return (
    <div style={{
      position: 'fixed', top: 16, left: 16, zIndex: 100,
      display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden',
      border: '1px solid rgba(80,140,60,0.2)',
      backdropFilter: 'blur(12px)',
    }}>
      <button
        onClick={() => set({ viewMode: 'showcase' })}
        style={{
          padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: 'none', color: viewMode === 'showcase' ? '#fff' : '#90b880',
          background: viewMode === 'showcase' ? 'rgba(80,140,60,0.5)' : 'rgba(6,14,6,0.85)',
          transition: 'all 0.2s',
        }}
      >
        🎬 展示视角
      </button>
      <button
        onClick={() => set({ viewMode: 'free' })}
        style={{
          padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: 'none', borderLeft: '1px solid rgba(80,140,60,0.2)',
          color: viewMode === 'free' ? '#fff' : '#90b880',
          background: viewMode === 'free' ? 'rgba(80,140,60,0.5)' : 'rgba(6,14,6,0.85)',
          transition: 'all 0.2s',
        }}
      >
        🖱️ 自由3D
      </button>
    </div>
  );
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a1a' }}>
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 100, position: [0, 0.2, 0.8] }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: 0 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene />
      </Canvas>
      <ViewToggle />
      <ControlPanel />
    </div>
  );
}