'use client';
import { Canvas } from '@react-three/fiber';
import Scene from './Scene';
import ControlPanel from './ControlPanel';
import { useStore } from '@/app/store';

function ViewToggle() {
  const viewMode = useStore((s) => s.viewMode);
  const liveCamPos = useStore((s) => s.liveCamPos);
  const liveCamTarget = useStore((s) => s.liveCamTarget);
  const set = useStore((s) => s.set);

  const btnBase = {
    padding: '8px 16px', fontSize: 12, fontWeight: 600 as const, cursor: 'pointer' as const,
    border: 'none', transition: 'all 0.2s',
  };

  return (
    <div style={{
      position: 'fixed', top: 16, left: 16, zIndex: 100,
      display: 'flex', flexDirection: 'column' as const, gap: 8,
    }}>
      {/* 模式切换 */}
      <div style={{
        display: 'flex', borderRadius: 8, overflow: 'hidden',
        border: '1px solid rgba(80,140,60,0.2)', backdropFilter: 'blur(12px)',
      }}>
        <button onClick={() => set({ viewMode: 'showcase' })} style={{
          ...btnBase,
          color: viewMode === 'showcase' ? '#fff' : '#90b880',
          background: viewMode === 'showcase' ? 'rgba(80,140,60,0.5)' : 'rgba(6,14,6,0.85)',
        }}>🎬 展示视角</button>
        <button onClick={() => set({ viewMode: 'free' })} style={{
          ...btnBase,
          borderLeft: '1px solid rgba(80,140,60,0.2)',
          color: viewMode === 'free' ? '#fff' : '#90b880',
          background: viewMode === 'free' ? 'rgba(80,140,60,0.5)' : 'rgba(6,14,6,0.85)',
        }}>🖱️ 自由3D</button>
      </div>

      {/* 动画 TAB */}
      <div style={{
        display: 'flex', flexWrap: 'wrap' as const, gap: 4,
        background: 'rgba(6,14,6,0.90)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(80,140,60,0.2)', borderRadius: 8,
        padding: '8px 10px',
      }}>
        <span style={{ width: '100%', fontSize: 10, color: '#70a060', marginBottom: 2, fontWeight: 700 }}>🎬 动画效果</span>
        {[
          { id: 1, label: '🌱 生长', active: true },
          { id: 2, label: '🌸 绽放', active: false },
          { id: 3, label: '🍃 风动', active: false },
          { id: 4, label: '✨ 发光', active: false },
          { id: 5, label: '🌀 旋转', active: false },
          { id: 6, label: '❄️ 凋零', active: false },
        ].map(tab => (
          <button key={tab.id} style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5,
            border: tab.active ? '1px solid rgba(80,180,60,0.4)' : '1px solid rgba(80,140,60,0.15)',
            background: tab.active ? 'rgba(80,180,60,0.3)' : 'rgba(6,14,6,0.6)',
            color: tab.active ? '#c0f0a0' : tab.id === 1 ? '#90b880' : '#506840',
            cursor: tab.active ? 'pointer' : tab.id === 1 ? 'pointer' : 'not-allowed',
            opacity: tab.id === 1 ? 1 : 0.5,
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 自由视角时显示实时参数 */}
      {viewMode === 'free' && (
        <div style={{
          background: 'rgba(6,14,6,0.90)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(80,140,60,0.2)', borderRadius: 8,
          padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#b8d0a8',
          minWidth: 220,
        }}>
          <div style={{ marginBottom: 6, fontWeight: 700, fontSize: 12, color: '#d0e8c0' }}>
            📷 相机参数
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: '#70a060' }}>Position: </span>
            <span>{liveCamPos.map(v => v.toFixed(3)).join(', ')}</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: '#70a060' }}>Target: </span>
            <span>{liveCamTarget.map(v => v.toFixed(3)).join(', ')}</span>
          </div>
          <button
            onClick={() => {
              set({
                showcasePos: [...liveCamPos],
                showcaseTarget: [...liveCamTarget],
                viewMode: 'showcase',
              });
            }}
            style={{
              width: '100%', padding: '6px 0', fontSize: 11, fontWeight: 700,
              background: 'rgba(80,180,60,0.25)', border: '1px solid rgba(80,180,60,0.3)',
              borderRadius: 6, color: '#c0f0a0', cursor: 'pointer',
            }}
          >
            � 设为展示视角
          </button>
        </div>
      )}
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