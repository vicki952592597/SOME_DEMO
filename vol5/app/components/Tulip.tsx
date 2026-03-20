'use client';
/**
 * VOL5 郁金香 — 自然生长动画
 *
 * 分阶段、分部件：
 *  阶段1 (0~0.25): 出芽 — 茎从地面冒出，叶片紧贴茎萌发
 *  阶段2 (0.20~0.50): 拔节 — 茎快速拉长，叶片展开
 *  阶段3 (0.40~0.65): 花苞 — 花瓣从无到有，紧闭的花苞
 *  阶段4 (0.60~1.00): 绽放 — 花瓣逐片优雅展开
 *
 * 每个部件有独立的 growth offset，不是简单 Y 裁切
 */
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useStore } from '@/app/store';

const BASE_PATH = typeof window !== 'undefined' && window.location.pathname.includes('/tulip')
  ? '/SOME_DEMO/tulip' : '';

// 部件配置：每个部件的生长时间窗口
const PART_CONFIG: Record<string, {
  type: 'stem' | 'petal' | 'pistil' | 'leaf';
  growStart: number;  // 开始生长的 progress
  growEnd: number;    // 完全长好的 progress
  order?: number;     // 花瓣展开顺序
}> = {
  genjin:  { type: 'stem',   growStart: 0.00, growEnd: 0.40 },
  left1:   { type: 'leaf',   growStart: 0.08, growEnd: 0.45 },
  left2:   { type: 'leaf',   growStart: 0.12, growEnd: 0.48 },
  left3:   { type: 'leaf',   growStart: 0.15, growEnd: 0.50 },
  huarui:  { type: 'pistil', growStart: 0.35, growEnd: 0.60 },
  huaban1: { type: 'petal',  growStart: 0.40, growEnd: 0.80, order: 0 },
  huaban4: { type: 'petal',  growStart: 0.43, growEnd: 0.83, order: 1 },
  huaban2: { type: 'petal',  growStart: 0.46, growEnd: 0.86, order: 2 },
  huaban5: { type: 'petal',  growStart: 0.49, growEnd: 0.89, order: 3 },
  huaban3: { type: 'petal',  growStart: 0.52, growEnd: 0.92, order: 4 },
  huaban6: { type: 'petal',  growStart: 0.55, growEnd: 0.95, order: 5 },
};

export default function Tulip() {
  const groupRef = useRef<THREE.Group>(null!);
  const timeRef = useRef(0);
  const partsRef = useRef<Map<string, {
    mesh: THREE.Mesh;
    initPos: THREE.Vector3;
    initQuat: THREE.Quaternion;
    initScale: THREE.Vector3;
    mat: THREE.MeshStandardMaterial;
  }>>(new Map());

  const gltf = useGLTF(`${BASE_PATH}/model/tulip-split.glb`);
  const { gl } = useThree();

  const colorTex = useMemo(() => {
    const tex = new THREE.TextureLoader().load(`${BASE_PATH}/model/color.png`);
    tex.flipY = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    return tex;
  }, [gl]);

  const roughTex = useMemo(() => {
    const tex = new THREE.TextureLoader().load(`${BASE_PATH}/model/roughness.png`);
    tex.flipY = true;
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    return tex;
  }, [gl]);

  // 构建场景，使用 MeshStandardMaterial 让 Three.js 灯光正常工作
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    partsRef.current.clear();

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = new THREE.MeshStandardMaterial({
          map: colorTex,
          roughnessMap: roughTex,
          roughness: 0.55,
          metalness: 0.0,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
          envMapIntensity: 0.3,
        });
        mesh.material = mat;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        partsRef.current.set(child.name, {
          mesh,
          initPos: mesh.position.clone(),
          initQuat: mesh.quaternion.clone(),
          initScale: mesh.scale.clone(),
          mat,
        });
      }
    });
    return cloned;
  }, [gltf, colorTex, roughTex]);

  // 缓动
  function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t: number) {
    const c = 1.7;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }
  function easeOutElastic(t: number) {
    if (t === 0 || t >= 1) return Math.min(t, 1);
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * 2.094) + 1;
  }

  useFrame((_, dt) => {
    const s = useStore.getState();
    timeRef.current += dt;
    const t = timeRef.current;

    // 计算全局生长进度
    let progress: number;
    if (s.autoPlay) {
      const cycle = s.growthDuration;
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

    // 风
    const windX = Math.sin(t * s.windSpeed * 0.4) * s.windStrength;
    const windZ = Math.cos(t * s.windSpeed * 0.3 + 1.5) * s.windStrength;

    partsRef.current.forEach((data, name) => {
      const { mesh, initPos, initQuat, initScale, mat } = data;
      const cfg = PART_CONFIG[name];
      if (!cfg) return;

      // 这个部件的局部生长进度 0~1
      const localP = Math.max(0, Math.min(1,
        (progress - cfg.growStart) / (cfg.growEnd - cfg.growStart)
      ));

      if (cfg.type === 'stem') {
        // === 茎：Y方向缩放从0→1，从地面拔起 ===
        const stemP = easeOutCubic(localP);
        mesh.scale.set(
          initScale.x * (0.3 + stemP * 0.7),   // XZ稍微从细到粗
          initScale.y * Math.max(0.001, stemP),  // Y方向拔节
          initScale.z * (0.3 + stemP * 0.7)
        );
        mat.opacity = Math.min(localP * 5, 1);
        // 茎的微风
        mesh.quaternion.copy(initQuat);
        if (stemP > 0.3) {
          mesh.rotateZ(windX * 0.003 * stemP);
          mesh.rotateX(windZ * 0.002 * stemP);
        }

      } else if (cfg.type === 'leaf') {
        // === 叶片：从紧贴茎（缩小+内卷）到舒展 ===
        const leafP = easeOutBack(localP);
        // 缩放生长
        const sc = Math.max(0.001, leafP);
        mesh.scale.copy(initScale).multiplyScalar(sc);
        mat.opacity = Math.min(localP * 4, 1);
        // 叶片从卷曲到展开
        mesh.quaternion.copy(initQuat);
        const unfurl = (1 - leafP) * 0.6;
        mesh.rotateY(unfurl);
        mesh.rotateX(unfurl * 0.3);
        // 风
        if (leafP > 0.3) {
          const lw = Math.sin(t * s.windSpeed * 0.6 + mesh.id * 2) * 0.008 * s.windStrength * leafP;
          mesh.rotateZ(lw);
        }

      } else if (cfg.type === 'pistil') {
        // === 花蕊：纯 opacity 淡入，不动任何 transform ===
        mesh.scale.copy(initScale);
        mesh.quaternion.copy(initQuat);
        mesh.position.copy(initPos);
        mat.opacity = easeOutCubic(Math.min(localP * 2.5, 1));

      } else if (cfg.type === 'petal') {
        // === 花瓣：花苞闭合 → 逐片绽放展开 ===
        //
        // 新模型花瓣有 translation (pivot在花蕊附近)
        // 可以绕 pivot 旋转做花苞→绽放！
        //
        // 阶段1 (localP 0~0.4): 花瓣淡入，花苞紧闭状态
        // 阶段2 (localP 0.4~1.0): 花瓣从闭合展开到初始姿态

        const appearP = Math.min(localP * 2.5, 1);
        const bloomP = easeOutCubic(Math.max((localP - 0.3) / 0.7, 0));

        // 保持原始 scale
        mesh.scale.copy(initScale);
        mesh.position.copy(initPos);

        // opacity 淡入
        mat.opacity = easeOutCubic(appearP);

        // 花苞→绽放：旋转
        // closeAmount: 1=花苞紧闭, 0=完全展开(模型初始姿态)
        const closeAmount = 1.0 - bloomP;

        mesh.quaternion.copy(initQuat);
        if (closeAmount > 0.005) {
          // 花瓣向上合拢（绕 X 轴旋转，让花瓣尖端朝上收拢）
          const closeAngle = closeAmount * 0.5;
          const closeQ = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            closeAngle
          );
          mesh.quaternion.multiply(closeQ);
        }

        // 微风颤动（绽放后）
        if (bloomP > 0.4) {
          const intensity = (bloomP - 0.4) * 0.004;
          const tr = Math.sin(t * 1.8 + (cfg.order || 0) * 1.2);
          mesh.rotateX(tr * intensity);
          mesh.rotateZ(tr * 0.3 * intensity + windX * 0.0008);
        }
      }

      mesh.visible = localP > 0.001;
    });

    // 整体微风
    const globalGrow = Math.min(progress * 3, 1);
    group.rotation.z = windX * 0.003 * globalGrow;
    group.rotation.x = windZ * 0.002 * globalGrow;
  });

  return (
    <group ref={groupRef} position={[0, -0.15, 0]}>
      <primitive object={scene} />
    </group>
  );
}