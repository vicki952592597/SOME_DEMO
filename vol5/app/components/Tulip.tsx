'use client';
/**
 * VOL5 郁金香 — 加载 GLB 模型 + 程序化生长动画
 * 
 * 生长阶段（0→1）:
 * 0.00~0.15: 种子/芽 — 从地面冒出，极小缩放
 * 0.15~0.45: 茎生长 — 茎从下往上拉伸，叶片展开
 * 0.45~0.70: 花苞形成 — 花苞从茎顶冒出并膨大
 * 0.70~1.00: 花朵绽放 — 花瓣逐片展开
 */
import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useStore } from '@/app/store';

const BASE_PATH = process.env.NODE_ENV === 'production' ? '/SOME_DEMO/tulip' : '';

export default function Tulip() {
  const groupRef = useRef<THREE.Group>(null!);
  const timeRef = useRef(0);
  const gltf = useLoader(GLTFLoader, `${BASE_PATH}/model/flower.glb`);

  // 克隆场景以免重复使用问题
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    // 遍历所有 mesh，启用双面渲染和透明
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.side = THREE.DoubleSide;
          mat.transparent = true;
          mat.depthWrite = true;
          mat.needsUpdate = true;
        }
      }
    });
    return cloned;
  }, [gltf]);

  // 收集所有 mesh 的初始变换，用于生长动画基准
  const meshData = useMemo(() => {
    const data: Array<{
      mesh: THREE.Mesh;
      initPos: THREE.Vector3;
      initScale: THREE.Vector3;
      initQuat: THREE.Quaternion;
      yNorm: number; // 归一化 Y 位置 (0=底部, 1=顶部)
      type: 'petal' | 'leaf' | 'stem' | 'other';
    }> = [];

    // 先算包围盒
    const box = new THREE.Box3().setFromObject(scene);
    const minY = box.min.y;
    const maxY = box.max.y;
    const rangeY = maxY - minY || 1;

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        // 通过世界坐标获取 Y 位置
        const wp = new THREE.Vector3();
        mesh.getWorldPosition(wp);
        const yNorm = (wp.y - minY) / rangeY;

        // 基于 UV/位置 猜测类型 (单一 mesh 情况下，基于 Y 高度区分)
        let type: 'petal' | 'leaf' | 'stem' | 'other' = 'other';
        if (yNorm > 0.6) type = 'petal';
        else if (yNorm > 0.1 && yNorm < 0.5) type = 'leaf';
        else if (yNorm <= 0.5) type = 'stem';

        data.push({
          mesh,
          initPos: mesh.position.clone(),
          initScale: mesh.scale.clone(),
          initQuat: mesh.quaternion.clone(),
          yNorm,
          type,
        });
      }
    });
    return data;
  }, [scene]);

  /* ===== 每帧驱动生长动画 ===== */
  useFrame((state, dt) => {
    const s = useStore.getState();
    timeRef.current += dt;

    // 计算生长进度
    let progress: number;
    if (s.autoPlay) {
      const cycle = s.growthDuration;
      const t = timeRef.current;
      if (s.loopMode === 'loop') {
        progress = (t % cycle) / cycle;
      } else if (s.loopMode === 'pingpong') {
        const phase = (t % (cycle * 2)) / cycle;
        progress = phase <= 1 ? phase : 2 - phase;
      } else {
        progress = Math.min(t / cycle, 1);
      }
    } else {
      progress = Math.max(0, Math.min(1, s.growthProgress));
    }

    const group = groupRef.current;
    if (!group) return;

    // 整体生长缩放：从0到1
    // 阶段 1: 0~0.15 从地面冒出
    const emergeFactor = THREE.MathUtils.smoothstep(progress, 0.0, 0.15);
    // 阶段 2: 0.15~0.5 茎拉长
    const stemGrow = THREE.MathUtils.smoothstep(progress, 0.1, 0.5);
    // 阶段 3: 0.45~1.0 花朵绽放
    const bloomFactor = THREE.MathUtils.smoothstep(progress, 0.45, 1.0);

    // 整体 Y 缩放模拟茎生长
    const scaleY = 0.01 + emergeFactor * 0.2 + stemGrow * 0.8;
    const scaleXZ = 0.01 + emergeFactor * 0.3 + stemGrow * 0.7;

    group.scale.set(
      scaleXZ * s.petalScale,
      scaleY * s.stemHeight,
      scaleXZ * s.petalScale
    );

    // 花朵顶部 — 用 vertex shader 或直接操作 mesh
    // 由于是单个 mesh，我们通过 material uniform 控制
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          // 透明度跟随生长进度
          mat.opacity = THREE.MathUtils.clamp(emergeFactor * 3, 0, 1);
        }
      }
    });

    // 微微摇摆 (风)
    const windAngle = Math.sin(timeRef.current * 0.5) * 0.02 * s.stemBend;
    group.rotation.z = windAngle;
    group.rotation.x = Math.sin(timeRef.current * 0.3) * 0.01 * s.stemBend;
  });

  return (
    <group ref={groupRef} position={[0, -0.5, 0]}>
      <primitive object={scene} />
    </group>
  );
}