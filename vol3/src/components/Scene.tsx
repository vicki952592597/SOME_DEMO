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

function SceneContent() {
  const groupRef = useRef<THREE.Group>(null!);

  // 鼠标原始位置（归一化 -1 ~ 1）
  const mouse = useRef({ x: 0, y: 0 });
  // 平滑插值后的位置
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
    const t = clock.getElapsedTime();

    // 平滑跟随
    smooth.current.x += (mouse.current.x - smooth.current.x) * 0.04;
    smooth.current.y += (mouse.current.y - smooth.current.y) * 0.04;

    const dist = 2.2;
    const basePitch = 0.18;
    const baseAngle = t * 0.015;

    // 鼠标驱动视角偏移（3D感关键）
    const hOffset = smooth.current.x * 0.45;
    const vOffset = smooth.current.y * 0.2;

    const angle = baseAngle + hOffset;
    const pitch = basePitch + vOffset;

    camera.position.set(
      Math.sin(angle) * dist * Math.cos(pitch),
      Math.sin(pitch) * dist + 0.08,
      Math.cos(angle) * dist * Math.cos(pitch)
    );

    // lookAt 也微微偏移增加视差
    const lookX = smooth.current.x * -0.05;
    const lookY = smooth.current.y * 0.03;
    camera.lookAt(lookX, lookY, 0);
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