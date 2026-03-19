'use client';
/**
 * ============================================================
 * 3D 场景组合组件
 * ============================================================
 * 组合大丽花、花茎、背景和后处理效果
 */
import { useRef } from 'react';
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

  // 相机缓慢旋转
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    const angle = t * 0.025;
    const dist = 2.0; // 更近，适配缩小后的球形花
    const pitch = 0.22;
    camera.position.set(
      Math.sin(angle) * dist * Math.cos(pitch),
      Math.sin(pitch) * dist + 0.15,
      Math.cos(angle) * dist * Math.cos(pitch)
    );
    camera.lookAt(0, 0.0, 0); // 花朵球心在原点
  });

  return (
    <>
      {/* 背景 */}
      <Background />

      {/* 花朵组 */}
      <group ref={groupRef}>
        <Dahlia />
        <Stem />
      </group>

      {/* 后处理扭曲 */}
      <DistortionPass getTexture={getFluidTexture} />
    </>
  );
}

export default SceneContent;