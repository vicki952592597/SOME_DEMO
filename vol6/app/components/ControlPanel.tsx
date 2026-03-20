'use client';
import { useState } from 'react';
import { useStore, defaultParams } from '@/app/store';

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#c0d8b0', marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: '#90b880', fontFamily: 'monospace' }}>{value.toFixed(step < 0.01 ? 3 : 2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#6ab04c' }} />
    </div>
  );
}

function ColorPicker({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: '#c0d8b0', flex: 1 }}>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: 32, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
      <span style={{ fontSize: 10, color: '#90b880', fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function SelectInput({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: '#c0d8b0', flex: 1 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ background: 'rgba(100,180,80,0.1)', border: '1px solid rgba(100,180,80,0.2)',
          borderRadius: 4, color: '#c0d8b0', fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Group({ title, icon, children, defaultOpen = true }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 6 }}>
      <div onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        padding: '5px 0', borderBottom: '1px solid rgba(100,180,80,0.15)',
        fontSize: 12, fontWeight: 600, color: '#d0e8c0', userSelect: 'none',
      }}>
        <span>{icon}</span><span style={{ flex: 1 }}>{title}</span>
        <span style={{ fontSize: 10, color: '#80a870' }}>{open ? '▾' : '▸'}</span>
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
    <div style={{ position: 'fixed', top: 12, right: 12, bottom: 12, width: collapsed ? 36 : 280,
      background: 'rgba(8,18,8,0.88)', backdropFilter: 'blur(16px)', borderRadius: 12,
      border: '1px solid rgba(100,180,80,0.12)', color: '#d0e8c0',
      fontFamily: "'Inter','Segoe UI',sans-serif", zIndex: 100, transition: 'width 0.3s ease',
      overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: collapsed ? '10px 8px' : '12px 14px', borderBottom: '1px solid rgba(100,180,80,0.1)', flexShrink: 0 }}>
        {!collapsed && <span style={{ fontSize: 13, fontWeight: 700 }}>🌷 郁金香参数</span>}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          background: 'rgba(100,180,80,0.12)', border: 'none', borderRadius: 5,
          color: '#a0c890', cursor: 'pointer', padding: '3px 7px', fontSize: 11 }}>
          {collapsed ? '◀' : '▶'}
        </button>
      </div>
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px 14px', overflowX: 'hidden' }}>

          <Group title="🌱 生长动画" icon="">
            <Slider label="周期(秒)" value={s.growthDuration} min={3} max={20} step={0.5} onChange={(v) => set({ growthDuration: v })} />
            <SelectInput label="播放模式" value={s.loopMode}
              options={[{value:'pingpong',label:'往返'},{value:'loop',label:'循环'},{value:'once',label:'单次'}]}
              onChange={(v) => set({ loopMode: v as any })} />
            <Slider label="风力" value={s.windStrength} min={0} max={3} step={0.1} onChange={(v) => set({ windStrength: v })} />
            <Slider label="风速" value={s.windSpeed} min={0} max={2} step={0.05} onChange={(v) => set({ windSpeed: v })} />
          </Group>

          <Group title="🌸 花瓣造型" icon="">
            <Slider label="花瓣数(每层)" value={s.petalCount} min={3} max={12} step={1} onChange={(v) => set({ petalCount: v })} />
            <Slider label="层数" value={s.petalLayers} min={1} max={4} step={1} onChange={(v) => set({ petalLayers: v })} />
            <Slider label="长度" value={s.petalLength} min={0.08} max={0.50} step={0.01} onChange={(v) => set({ petalLength: v })} />
            <Slider label="宽度" value={s.petalWidth} min={0.04} max={0.30} step={0.01} onChange={(v) => set({ petalWidth: v })} />
            <Slider label="厚度" value={s.petalThickness} min={0} max={0.02} step={0.001} onChange={(v) => set({ petalThickness: v })} />
            <Slider label="卷曲" value={s.petalCurl} min={0} max={1.2} step={0.05} onChange={(v) => set({ petalCurl: v })} />
            <Slider label="张开角度" value={s.petalOpenAngle} min={0} max={1.5} step={0.05} onChange={(v) => set({ petalOpenAngle: v })} />
            <Slider label="尖端外翻" value={s.petalTipBend} min={0} max={0.5} step={0.02} onChange={(v) => set({ petalTipBend: v })} />
            <Slider label="圆润度" value={s.petalRoundness} min={0.3} max={1.5} step={0.05} onChange={(v) => set({ petalRoundness: v })} />
          </Group>

          <Group title="🌿 茎" icon="" defaultOpen={false}>
            <Slider label="高度" value={s.stemHeight} min={0.1} max={1.0} step={0.02} onChange={(v) => set({ stemHeight: v })} />
            <Slider label="粗细" value={s.stemRadius} min={0.004} max={0.03} step={0.001} onChange={(v) => set({ stemRadius: v })} />
            <Slider label="弯曲" value={s.stemBend} min={0} max={0.15} step={0.005} onChange={(v) => set({ stemBend: v })} />
          </Group>

          <Group title="🍃 叶片" icon="" defaultOpen={false}>
            <Slider label="数量" value={s.leafCount} min={0} max={4} step={1} onChange={(v) => set({ leafCount: v })} />
            <Slider label="长度" value={s.leafLength} min={0.1} max={0.6} step={0.02} onChange={(v) => set({ leafLength: v })} />
            <Slider label="宽度" value={s.leafWidth} min={0.03} max={0.2} step={0.01} onChange={(v) => set({ leafWidth: v })} />
            <Slider label="下垂" value={s.leafDroop} min={0} max={0.8} step={0.02} onChange={(v) => set({ leafDroop: v })} />
            <Slider label="卷曲" value={s.leafCurl} min={0} max={0.8} step={0.02} onChange={(v) => set({ leafCurl: v })} />
          </Group>

          <Group title="🎨 颜色" icon="" defaultOpen={false}>
            <ColorPicker label="花瓣内色" value={s.petalColorInner} onChange={(v) => set({ petalColorInner: v })} />
            <ColorPicker label="花瓣外色" value={s.petalColorOuter} onChange={(v) => set({ petalColorOuter: v })} />
            <ColorPicker label="花瓣基部" value={s.petalColorBase} onChange={(v) => set({ petalColorBase: v })} />
            <ColorPicker label="茎颜色" value={s.stemColor} onChange={(v) => set({ stemColor: v })} />
            <ColorPicker label="叶颜色" value={s.leafColor} onChange={(v) => set({ leafColor: v })} />
          </Group>

          <Group title="✨ 光效" icon="" defaultOpen={false}>
            <Slider label="菲涅尔" value={s.fresnelStrength} min={0} max={1.0} step={0.02} onChange={(v) => set({ fresnelStrength: v })} />
            <Slider label="SSS散射" value={s.sssStrength} min={0} max={0.8} step={0.02} onChange={(v) => set({ sssStrength: v })} />
            <Slider label="高光" value={s.specularStr} min={0} max={0.5} step={0.01} onChange={(v) => set({ specularStr: v })} />
          </Group>

          <Group title="📷 相机" icon="" defaultOpen={false}>
            <Slider label="距离" value={s.cameraDistance} min={0.8} max={5.0} step={0.1} onChange={(v) => set({ cameraDistance: v })} />
            <Slider label="自转速度" value={s.autoRotateSpeed} min={0} max={0.05} step={0.002} onChange={(v) => set({ autoRotateSpeed: v })} />
            <Slider label="水平视差" value={s.mouseParallaxH} min={0} max={1.0} step={0.05} onChange={(v) => set({ mouseParallaxH: v })} />
            <Slider label="垂直视差" value={s.mouseParallaxV} min={0} max={0.5} step={0.02} onChange={(v) => set({ mouseParallaxV: v })} />
            <Slider label="平滑" value={s.smoothFactor} min={0.01} max={0.15} step={0.005} onChange={(v) => set({ smoothFactor: v })} />
          </Group>

          <button onClick={s.reset} style={{ width: '100%', marginTop: 10, padding: '7px 0',
            background: 'rgba(100,180,80,0.1)', border: '1px solid rgba(100,180,80,0.15)',
            borderRadius: 6, color: '#a0c890', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
            ↺ 重置为默认值
          </button>
        </div>
      )}
    </div>
  );
}