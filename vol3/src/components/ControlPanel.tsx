'use client';
/**
 * 右侧参数控制面板
 * 半透明毛玻璃风格，分组折叠
 */
import { useState, useCallback } from 'react';
import { useStore, defaultParams } from '@/store';

// 滑块组件
function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#c8b8e8', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ color: '#a090d0', fontFamily: 'monospace' }}>{value.toFixed(step < 0.01 ? 3 : 2)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#7b68ee' }}
      />
    </div>
  );
}

// 折叠分组
function Group({ title, icon, children, defaultOpen = true }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          padding: '6px 0', borderBottom: '1px solid rgba(120,100,200,0.2)',
          fontSize: 13, fontWeight: 600, color: '#d4c4f4', userSelect: 'none',
        }}
      >
        <span>{icon}</span>
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{ fontSize: 10, color: '#8070b0' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && <div style={{ padding: '8px 0 4px' }}>{children}</div>}
    </div>
  );
}

export default function ControlPanel() {
  const store = useStore();
  const set = store.set;
  const reset = store.reset;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, bottom: 16,
      width: collapsed ? 36 : 280,
      background: 'rgba(12, 10, 30, 0.82)',
      backdropFilter: 'blur(16px)',
      borderRadius: 14,
      border: '1px solid rgba(120, 100, 200, 0.15)',
      color: '#e0d8f0',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      zIndex: 100,
      transition: 'width 0.3s ease',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: collapsed ? '12px 8px' : '14px 16px',
        borderBottom: '1px solid rgba(120,100,200,0.12)',
        flexShrink: 0,
      }}>
        {!collapsed && <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>🎛️ 参数调节</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'rgba(120,100,200,0.15)', border: 'none', borderRadius: 6,
            color: '#b0a0e0', cursor: 'pointer', padding: '4px 8px', fontSize: 12,
          }}
        >
          {collapsed ? '◀' : '▶'}
        </button>
      </div>

      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px', overflowX: 'hidden' }}>
          {/* 🌸 花朵 */}
          <Group title="花朵形态" icon="🌸">
            <Slider label="花瓣缩放" value={store.petalScale} min={0.5} max={2.0} step={0.05} onChange={(v) => set({ petalScale: v })} />
            <Slider label="波浪幅度" value={store.bloomWaveAmp} min={0} max={0.4} step={0.01} onChange={(v) => set({ bloomWaveAmp: v })} />
            <Slider label="波浪速度" value={store.bloomWaveSpeed} min={0.2} max={3.0} step={0.1} onChange={(v) => set({ bloomWaveSpeed: v })} />
            <Slider label="周期时长(秒)" value={store.cycleDuration} min={2} max={12} step={0.5} onChange={(v) => set({ cycleDuration: v })} />
            <Slider label="呼吸幅度" value={store.breatheAmp} min={0} max={0.02} step={0.001} onChange={(v) => set({ breatheAmp: v })} />
          </Group>

          {/* ✨ 光效 */}
          <Group title="光效" icon="✨">
            <Slider label="能量波速度" value={store.energyWaveSpeed} min={0.1} max={1.5} step={0.05} onChange={(v) => set({ energyWaveSpeed: v })} />
            <Slider label="能量波强度" value={store.energyWaveStrength} min={0} max={0.5} step={0.01} onChange={(v) => set({ energyWaveStrength: v })} />
            <Slider label="菲涅尔强度" value={store.fresnelStrength} min={0} max={1.0} step={0.02} onChange={(v) => set({ fresnelStrength: v })} />
            <Slider label="花心辉光" value={store.coreGlow} min={0} max={1.5} step={0.05} onChange={(v) => set({ coreGlow: v })} />
          </Group>

          {/* 📷 相机 */}
          <Group title="相机与交互" icon="📷">
            <Slider label="相机距离" value={store.cameraDistance} min={1.0} max={5.0} step={0.1} onChange={(v) => set({ cameraDistance: v })} />
            <Slider label="自转速度" value={store.autoRotateSpeed} min={0} max={0.1} step={0.005} onChange={(v) => set({ autoRotateSpeed: v })} />
            <Slider label="鼠标水平视差" value={store.mouseParallaxH} min={0} max={1.0} step={0.05} onChange={(v) => set({ mouseParallaxH: v })} />
            <Slider label="鼠标垂直视差" value={store.mouseParallaxV} min={0} max={0.5} step={0.02} onChange={(v) => set({ mouseParallaxV: v })} />
            <Slider label="平滑系数" value={store.smoothFactor} min={0.01} max={0.15} step={0.005} onChange={(v) => set({ smoothFactor: v })} />
          </Group>

          {/* 🌿 花茎 */}
          <Group title="花茎" icon="🌿" defaultOpen={false}>
            <Slider label="Y 位置" value={store.stemY} min={-1.0} max={0} step={0.02} onChange={(v) => set({ stemY: v })} />
            <Slider label="长度" value={store.stemLength} min={0.1} max={1.5} step={0.05} onChange={(v) => set({ stemLength: v })} />
          </Group>

          {/* 🌌 背景 */}
          <Group title="背景" icon="🌌" defaultOpen={false}>
            <Slider label="星空亮度" value={store.starBrightness} min={0} max={2.0} step={0.1} onChange={(v) => set({ starBrightness: v })} />
            <Slider label="辉光强度" value={store.bgGlowStrength} min={0} max={0.3} step={0.01} onChange={(v) => set({ bgGlowStrength: v })} />
          </Group>

          {/* 重置按钮 */}
          <button
            onClick={reset}
            style={{
              width: '100%', marginTop: 12, padding: '8px 0',
              background: 'rgba(120,100,200,0.12)', border: '1px solid rgba(120,100,200,0.2)',
              borderRadius: 8, color: '#b0a0e0', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
            }}
          >
            ↺ 重置为默认值
          </button>
        </div>
      )}
    </div>
  );
}