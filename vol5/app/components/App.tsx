'use client';
import { Canvas } from '@react-three/fiber';
import Scene from './Scene';
import ControlPanel from './ControlPanel';

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a1a' }}>
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 100, position: [0, 0.2, 3.5] }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: 0 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene />
      </Canvas>
      <ControlPanel />
    </div>
  );
}