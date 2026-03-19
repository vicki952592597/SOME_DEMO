'use client';
/**
 * 场景组合：花朵 + 花茎 + 背景 + 鼠标3D视差
 */
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Dahlia from './Dahlia';
import Stem from './Stem';
import Background from './Background';
import { useStore } from '@/store';

function SceneContent() {
  const groupRef = useRef<THREE.Group>(null!);
  const mouse = useRef({ x: 0, y: 0 });
  const smooth = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame(({ camera, clock }) => {
    const s = useStore.getState();
    const t = clock.getElapsedTime();
    smooth.current.x += (mouse.current.x - smooth.current.x) * s.smoothFactor;
    smooth.current.y += (mouse.current.y - smooth.current.y) * s.smoothFactor;

    const angle = t * s.autoRotateSpeed + smooth.current.x * s.mouseParallaxH;
    const pitch = 0.18 + smooth.current.y * s.mouseParallaxV;

    camera.position.set(
      Math.sin(angle) * s.cameraDistance * Math.cos(pitch),
      Math.sin(pitch) * s.cameraDistance + 0.08,
      Math.cos(angle) * s.cameraDistance * Math.cos(pitch)
    );
    camera.lookAt(smooth.current.x * -0.05, smooth.current.y * 0.03, 0);
  });

  return (
    <>
      <Background />
      <group ref={groupRef}>
        <Dahlia />
        <Stem />
      </group>
    </>
  );
}
export default SceneContent;