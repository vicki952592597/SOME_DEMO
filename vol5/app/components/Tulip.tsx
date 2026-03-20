'use client';
/**
 * VOL5 郁金香 — 自然生长动画
 *
 * 花瓣采用 ClipPlane 裁切法：从花蕊位置由内向外逐渐显露
 *
 * 模型数据（local 空间，父节点 group1 有 X轴90°旋转 + 0.01缩放）：
 *   花瓣 geometry: Z ∈ [-34, -24]（Z=-24 是花蕊附近，Z=-34 是花瓣尖端）
 *   花蕊 geometry: Z ∈ [-27, -25]
 *   花瓣 pivot:    pos=[-0.38, 3.30, 0]
 *
 * 裁切方向：法线 (0,0,1)，即隐藏 Z > clipZ 的部分
 *   clipZ 从 -24（只露花蕊处一点）→ -34（完全显露花瓣尖端）
 */
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useStore } from '@/app/store';

const BASE_PATH = typeof window !== 'undefined' && window.location.pathname.includes('/tulip')
  ? '/SOME_DEMO/tulip' : '';

// 花瓣 geometry 在 local Z 轴的范围
const PETAL_Z_NEAR = -24;   // 花蕊端（最先显露）
const PETAL_Z_FAR  = -35;   // 花瓣尖端（最后显露），多留1单位余量

// 部件配置：每个部件的生长时间窗口
const PART_CONFIG: Record<string, {
  type: 'stem' | 'petal' | 'pistil' | 'leaf';
  growStart: number;
  growEnd: number;
  order?: number;
}> = {
  genjin:  { type: 'stem',   growStart: 0.00, growEnd: 0.40 },
  left1:   { type: 'leaf',   growStart: 0.08, growEnd: 0.45 },
  left2:   { type: 'leaf',   growStart: 0.12, growEnd: 0.48 },
  left3:   { type: 'leaf',   growStart: 0.15, growEnd: 0.50 },
  huarui:  { type: 'pistil', growStart: 0.35, growEnd: 0.60 },
  huaban1: { type: 'petal',  growStart: 0.40, growEnd: 0.85, order: 0 },
  huaban4: { type: 'petal',  growStart: 0.43, growEnd: 0.87, order: 1 },
  huaban2: { type: 'petal',  growStart: 0.46, growEnd: 0.89, order: 2 },
  huaban5: { type: 'petal',  growStart: 0.49, growEnd: 0.91, order: 3 },
  huaban3: { type: 'petal',  growStart: 0.52, growEnd: 0.93, order: 4 },
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
    clipPlane?: THREE.Plane;
  }>>(new Map());

  const gltf = useGLTF(`${BASE_PATH}/model/tulip-split.glb`);
  const { gl } = useThree();

  // 启用 renderer 的 localClippingEnabled
  useMemo(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

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

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    partsRef.current.clear();

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const cfg = PART_CONFIG[child.name];
        const isPetal = cfg?.type === 'petal';

        // 花瓣使用 clipping plane；其他部件不使用
        const clipPlane = isPetal
          ? new THREE.Plane(new THREE.Vector3(0, 0, 1), -PETAL_Z_NEAR) // 初始：隐藏所有（clipZ = PETAL_Z_NEAR）
          : undefined;

        const mat = new THREE.MeshStandardMaterial({
          map: colorTex,
          roughnessMap: roughTex,
          roughness: 0.55,
          metalness: 0.0,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
          envMapIntensity: 0.3,
          clippingPlanes: clipPlane ? [clipPlane] : [],
          clipShadows: true,
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
          clipPlane,
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
      const { mesh, initPos, initQuat, initScale, mat, clipPlane } = data;
      const cfg = PART_CONFIG[name];
      if (!cfg) return;

      // 这个部件的局部生长进度 0~1
      const localP = Math.max(0, Math.min(1,
        (progress - cfg.growStart) / (cfg.growEnd - cfg.growStart)
      ));

      if (cfg.type === 'stem') {
        const stemP = easeOutCubic(localP);
        mesh.scale.set(
          initScale.x * (0.3 + stemP * 0.7),
          initScale.y * Math.max(0.001, stemP),
          initScale.z * (0.3 + stemP * 0.7)
        );
        mat.opacity = Math.min(localP * 5, 1);
        mesh.quaternion.copy(initQuat);
        if (stemP > 0.3) {
          mesh.rotateZ(windX * 0.003 * stemP);
          mesh.rotateX(windZ * 0.002 * stemP);
        }

      } else if (cfg.type === 'leaf') {
        const leafP = easeOutBack(localP);
        const sc = Math.max(0.001, leafP);
        mesh.scale.copy(initScale).multiplyScalar(sc);
        mat.opacity = Math.min(localP * 4, 1);
        mesh.quaternion.copy(initQuat);
        const unfurl = (1 - leafP) * 0.6;
        mesh.rotateY(unfurl);
        mesh.rotateX(unfurl * 0.3);
        if (leafP > 0.3) {
          const lw = Math.sin(t * s.windSpeed * 0.6 + mesh.id * 2) * 0.008 * s.windStrength * leafP;
          mesh.rotateZ(lw);
        }

      } else if (cfg.type === 'pistil') {
        mesh.scale.copy(initScale);
        mesh.quaternion.copy(initQuat);
        mesh.position.copy(initPos);
        mat.opacity = easeOutCubic(Math.min(localP * 2.5, 1));

      } else if (cfg.type === 'petal') {
        // === 花瓣：ClipPlane 裁切 + 绽放旋转 ===
        //
        // 阶段拆分：
        //   localP 0~0.6: 生长（clip plane 从花蕊推向花瓣尖端）
        //   localP 0.3~1.0: 绽放（旋转展开 + 弹性回弹）

        const ord = cfg.order || 0;

        // 还原变换
        mesh.position.copy(initPos);
        mesh.quaternion.copy(initQuat);
        mesh.scale.copy(initScale);

        // ── (1) ClipPlane 生长：从花蕊由内向外显露 ──
        // clipZ: PETAL_Z_NEAR(-24) → PETAL_Z_FAR(-35)
        // Plane(normal=(0,0,1), constant=-clipZ)  裁切 Z > clipZ 的区域
        const growPhase = Math.min(localP / 0.60, 1);
        const growEased = easeOutCubic(growPhase);
        const clipZ = PETAL_Z_NEAR + (PETAL_Z_FAR - PETAL_Z_NEAR) * growEased;
        if (clipPlane) {
          clipPlane.constant = -clipZ;
        }

        // ── (2) 淡入 ──
        mat.opacity = easeOutCubic(Math.min(localP * 3.0, 1));

        // ── (3) 绽放旋转 ──
        // 花瓣从初始位置（模型中已经是绽放姿态）先闭合（反向旋转），然后逐渐回到原位
        // 在 local 空间中，花瓣沿 -Z 方向延伸，花蕊在 Z=-24 附近
        // "闭合" = 花瓣绕 X 轴旋转使其竖直（向上收拢）
        const bloomStart = 0.30;
        const rawBloom = Math.max((localP - bloomStart) / (1.0 - bloomStart), 0);
        const bloomP = easeOutBack(Math.min(rawBloom, 1));
        const closeAmount = Math.max(1.0 - bloomP, 0);

        if (closeAmount > 0.003) {
          // 花瓣向内收拢：绕 local X 轴旋转（因为 geometry 沿 -Z 延伸）
          // 正角度 = 花瓣尖端向上翘（闭合）
          const closeAngle = closeAmount * 0.45;
          mesh.rotateX(-closeAngle);  // 负方向收拢

          // 每片花瓣微小不对称
          const sideAngle = closeAmount * 0.06 * (ord % 2 === 0 ? 1 : -1);
          mesh.rotateY(sideAngle);
        }

        // ── (4) 绽放弹性微颤 ──
        if (rawBloom > 0.05 && rawBloom < 0.95) {
          const elasticP = easeOutElastic(Math.min(rawBloom * 1.3, 1));
          const tremble = (1 - elasticP) * 0.03;
          mesh.rotateX(Math.sin(rawBloom * 15 + ord * 2) * tremble);
          mesh.rotateY(Math.cos(rawBloom * 10 + ord * 1.5) * tremble * 0.5);
        }

        // ── (5) 活态摇曳 ──
        if (bloomP > 0.5) {
          const liveAmt = Math.min((bloomP - 0.5) / 0.5, 1);
          const freq1 = 1.2 + ord * 0.15;
          const freq2 = 0.8 + ord * 0.12;
          const windEffect = windX * 0.002 * liveAmt;
          const breathe = Math.sin(t * 0.6 + ord * 1.0) * 0.002 * liveAmt;

          mesh.rotateX(Math.sin(t * freq1 + ord * 1.5) * 0.004 * liveAmt + breathe);
          mesh.rotateZ(Math.sin(t * freq2 + ord * 2.1) * 0.003 * liveAmt + windEffect);
          mesh.rotateY(Math.cos(t * freq1 * 0.5 + ord * 0.8) * 0.001 * liveAmt);
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