'use client';
/**
 * 场景组合：花朵 + 花茎 + 背景 + 鼠标视角交互 + 后处理
 */
import { useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Dahlia from './Dahlia';
import Stem from './Stem';
import Background from './Background';
import { useFluidTexture, DistortionPass } from './FluidDistortion';

function SceneContent() {
  const groupRef = useRef<THREE.Group>(null!);

  // 流体扭曲纹理
  const getFluidTexture = useFluidTexture();

  // 鼠标位置（归一化 -1 ~ 1）
  const mouse = useRef({ x: 0, y: 0 });
  // 平滑后的鼠标位置（用于 lerp）
  const smoothMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // 相机：缓慢自转 + 鼠标跟随偏移（3D 视差感）
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();

    // 平滑鼠标跟随
    smoothMouse.current.x += (mouse.current.x - smoothMouse.current.x) * 0.05;
    smoothMouse.current.y += (mouse.current.y - smoothMouse.current.y) * 0.05;

    // 基础缓慢旋转
    const baseAngle = t * 0.02;
    const dist = 2.2;
    const pitch = 0.2;

    // 鼠标偏移角度（左右±0.3rad，上下±0.15rad）
    const mouseOffsetX = smoothMouse.current.x * 0.3;
    const mouseOffsetY = smoothMouse.current.y * 0.15;

    const angle = baseAngle + mouseOffsetX;
    const camPitch = pitch + mouseOffsetY;

    camera.position.set(
      Math.sin(angle) * dist * Math.cos(camPitch),
      Math.sin(camPitch) * dist + 0.1,
      Math.cos(angle) * dist * Math.cos(camPitch)
    );
    camera.lookAt(0, 0.0, 0);
  });

  return (
    <>
      <Background />
      <group ref={groupRef}>
        <Dahlia />
        <Stem />
      </group>
      <DistortionPass getTexture={getFluidTexture} />
    </>
  );
}

export default SceneContent;