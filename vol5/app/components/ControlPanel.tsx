'use client';
import { useState } from 'react';
import { useStore } from '@/app/store';

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#b8d0a8', marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: '#88b078', fontFamily: 'monospace' }}>{value.toFixed(step < 0.01 ? 3 : 2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#6ab04c' }} />
    </div>
  );
}

function SelectInput({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: '#b8d0a8', flex: 1 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ background: 'rgba(80,140,60,0.15)', border: '1px solid rgba(80,140,60,0.2)',
          borderRadius: 4, color: '#b8d0a8', fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Group({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 6 }}>
      <div onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', cursor: 'pointer',
        padding: '5px 0', borderBottom: '1px solid rgba(80,140,60,0.15)',
        fontSize: 12, fontWeight: 600, color: '#c8e0b8', userSelect: 'none',
      }}>
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{ fontSize: 10, color: '#70a060' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && <div style={{ padding: '6px 0 2px' }}>{children}</div>}
    </div>
  );
}

export default function ControlPanel() {
  const s = useStore();
  const set = s.set;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ position: 'fixed', top: 12, right: 12, bottom: 12, width: collapsed ? 36 : 260,
      background: 'rgba(6,14,6,0.90)', backdropFilter: 'blur(14px)', borderRadius: 12,
      border: '1px solid rgba(80,140,60,0.12)', color: '#c8e0b8',
      fontFamily: "'Inter','Segoe UI',sans-serif", zIndex: 100, transition: 'width 0.3s ease',
      overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: collapsed ? '10px 8px' : '12px 14px', borderBottom: '1px solid rgba(80,140,60,0.1)', flexShrink: 0 }}>
        {!collapsed && <span style={{ fontSize: 13, fontWeight: 700 }}>🌷 参数调节</span>}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          background: 'rgba(80,140,60,0.12)', border: 'none', borderRadius: 5,
          color: '#90b880', cursor: 'pointer', padding: '3px 7px', fontSize: 11 }}>
          {collapsed ? '◀' : '▶'}
        </button>
      </div>
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px 14px', overflowX: 'hidden' }}>
          <Group title="🌱 生长动画">
            <Slider label="周期(秒)" value={s.growthDuration} min={3} max={25} step={0.5} onChange={(v) => set({ growthDuration: v })} />
            <SelectInput label="播放模式" value={s.loopMode}
              options={[{value:'pingpong',label:'往返'},{value:'loop',label:'循环'},{value:'once',label:'单次'}]}
              onChange={(v) => set({ loopMode: v as any })} />
          </Group>

          <Group title="🌸 花瓣">
            <Slider label="张开角度" value={s.petalOpenAngle} min={0} max={1.5} step={0.05} onChange={(v) => set({ petalOpenAngle: v })} />
            <Slider label="缩放" value={s.petalScale} min={0.3} max={2.0} step={0.05} onChange={(v) => set({ petalScale: v })} />
          </Group>

          <Group title="🍃 风效">
            <Slider label="风力" value={s.windStrength} min={0} max={4} step={0.1} onChange={(v) => set({ windStrength: v })} />
            <Slider label="风速" value={s.windSpeed} min={0} max={3} step={0.05} onChange={(v) => set({ windSpeed: v })} />
          </Group>

          <Group title="📷 相机" defaultOpen={false}>
            <Slider label="距离" value={s.cameraDistance} min={0.8} max={6.0} step={0.1} onChange={(v) => set({ cameraDistance: v })} />
            <Slider label="自转速度" value={s.autoRotateSpeed} min={0} max={0.05} step={0.002} onChange={(v) => set({ autoRotateSpeed: v })} />
            <Slider label="水平视差" value={s.mouseParallaxH} min={0} max={1.0} step={0.05} onChange={(v) => set({ mouseParallaxH: v })} />
            <Slider label="垂直视差" value={s.mouseParallaxV} min={0} max={0.5} step={0.02} onChange={(v) => set({ mouseParallaxV: v })} />
            <Slider label="平滑" value={s.smoothFactor} min={0.01} max={0.15} step={0.005} onChange={(v) => set({ smoothFactor: v })} />
          </Group>

          <button onClick={s.reset} style={{ width: '100%', marginTop: 10, padding: '7px 0',
            background: 'rgba(80,140,60,0.1)', border: '1px solid rgba(80,140,60,0.15)',
            borderRadius: 6, color: '#90b880', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
            ↺ 重置默认值
          </button>
        </div>
      )}
    </div>
  );
}