'use client';
import { useState } from 'react';
import { useStore, defaultParams } from '@/store';

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
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#7b68ee' }} />
    </div>
  );
}

function Group({ title, icon, children, defaultOpen = true }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        padding: '6px 0', borderBottom: '1px solid rgba(120,100,200,0.2)',
        fontSize: 13, fontWeight: 600, color: '#d4c4f4', userSelect: 'none',
      }}>
        <span>{icon}</span><span style={{ flex: 1 }}>{title}</span>
        <span style={{ fontSize: 10, color: '#8070b0' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && <div style={{ padding: '8px 0 4px' }}>{children}</div>}
    </div>
  );
}

export default function ControlPanel() {
  const s = useStore();
  const set = s.set;
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, bottom: 16, width: collapsed ? 36 : 280,
      background: 'rgba(12,10,30,0.82)', backdropFilter: 'blur(16px)', borderRadius: 14,
      border: '1px solid rgba(120,100,200,0.15)', color: '#e0d8f0',
      fontFamily: "'Inter','Segoe UI',sans-serif", zIndex: 100, transition: 'width 0.3s ease',
      overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: collapsed ? '12px 8px' : '14px 16px', borderBottom: '1px solid rgba(120,100,200,0.12)', flexShrink: 0 }}>
        {!collapsed && <span style={{ fontSize: 14, fontWeight: 700 }}>🎛️ 参数调节</span>}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          background: 'rgba(120,100,200,0.15)', border: 'none', borderRadius: 6,
          color: '#b0a0e0', cursor: 'pointer', padding: '4px 8px', fontSize: 12 }}>
          {collapsed ? '◀' : '▶'}
        </button>
      </div>
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px', overflowX: 'hidden' }}>
          <Group title="花朵造型" icon="🌸">
            <Slider label="整体缩放" value={s.petalScale} min={0.3} max={2.5} step={0.05} onChange={(v) => set({ petalScale: v })} />
            <Slider label="花瓣长度" value={s.petalLength} min={0.3} max={2.5} step={0.05} onChange={(v) => set({ petalLength: v })} />
            <Slider label="花瓣宽度" value={s.petalWidth} min={0.3} max={2.5} step={0.05} onChange={(v) => set({ petalWidth: v })} />
            <Slider label="球体半径" value={s.ballRadius} min={0.02} max={0.40} step={0.01} onChange={(v) => set({ ballRadius: v })} />
            <Slider label="展开角度" value={s.openAngleScale} min={0.2} max={2.5} step={0.05} onChange={(v) => set({ openAngleScale: v })} />
            <Slider label="花瓣卷曲" value={s.curlAmount} min={0} max={1.5} step={0.05} onChange={(v) => set({ curlAmount: v })} />
          </Group>
          <Group title="动画" icon="🎬">
            <Slider label="波浪幅度" value={s.bloomWaveAmp} min={0} max={0.5} step={0.01} onChange={(v) => set({ bloomWaveAmp: v })} />
            <Slider label="径向脉冲" value={s.radialPulse} min={0} max={0.08} step={0.002} onChange={(v) => set({ radialPulse: v })} />
            <Slider label="周期(秒)" value={s.cycleDuration} min={2} max={15} step={0.5} onChange={(v) => set({ cycleDuration: v })} />
            <Slider label="呼吸幅度" value={s.breatheAmp} min={0} max={0.03} step={0.001} onChange={(v) => set({ breatheAmp: v })} />
          </Group>
          <Group title="光效" icon="✨">
            <Slider label="能量波速度" value={s.energyWaveSpeed} min={0.05} max={2.0} step={0.05} onChange={(v) => set({ energyWaveSpeed: v })} />
            <Slider label="能量波强度" value={s.energyWaveStrength} min={0} max={1.0} step={0.02} onChange={(v) => set({ energyWaveStrength: v })} />
            <Slider label="菲涅尔强度" value={s.fresnelStrength} min={0} max={1.5} step={0.02} onChange={(v) => set({ fresnelStrength: v })} />
            <Slider label="花心辉光" value={s.coreGlow} min={0} max={2.0} step={0.05} onChange={(v) => set({ coreGlow: v })} />
            <Slider label="高光强度" value={s.specularStr} min={0} max={0.5} step={0.01} onChange={(v) => set({ specularStr: v })} />
            <Slider label="SSS散射" value={s.sssStrength} min={0} max={0.8} step={0.02} onChange={(v) => set({ sssStrength: v })} />
          </Group>
          <Group title="相机与交互" icon="📷" defaultOpen={false}>
            <Slider label="相机距离" value={s.cameraDistance} min={1.0} max={5.0} step={0.1} onChange={(v) => set({ cameraDistance: v })} />
            <Slider label="自转速度" value={s.autoRotateSpeed} min={0} max={0.1} step={0.005} onChange={(v) => set({ autoRotateSpeed: v })} />
            <Slider label="水平视差" value={s.mouseParallaxH} min={0} max={1.0} step={0.05} onChange={(v) => set({ mouseParallaxH: v })} />
            <Slider label="垂直视差" value={s.mouseParallaxV} min={0} max={0.5} step={0.02} onChange={(v) => set({ mouseParallaxV: v })} />
            <Slider label="平滑系数" value={s.smoothFactor} min={0.01} max={0.15} step={0.005} onChange={(v) => set({ smoothFactor: v })} />
          </Group>
          <Group title="花茎" icon="🌿" defaultOpen={false}>
            <Slider label="Y 位置" value={s.stemY} min={-1.0} max={0} step={0.02} onChange={(v) => set({ stemY: v })} />
            <Slider label="长度" value={s.stemLength} min={0.1} max={1.5} step={0.05} onChange={(v) => set({ stemLength: v })} />
          </Group>
          <Group title="背景" icon="🌌" defaultOpen={false}>
            <Slider label="星空亮度" value={s.starBrightness} min={0} max={3.0} step={0.1} onChange={(v) => set({ starBrightness: v })} />
            <Slider label="辉光强度" value={s.bgGlowStrength} min={0} max={0.3} step={0.01} onChange={(v) => set({ bgGlowStrength: v })} />
          </Group>
          <button onClick={s.reset} style={{ width: '100%', marginTop: 12, padding: '8px 0',
            background: 'rgba(120,100,200,0.12)', border: '1px solid rgba(120,100,200,0.2)',
            borderRadius: 8, color: '#b0a0e0', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            ↺ 重置为默认值
          </button>
        </div>
      )}
    </div>
  );
}