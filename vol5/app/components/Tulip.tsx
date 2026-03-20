'use client';
/**
 * VOL5 郁金香 — 自然生长动画
 *
 * 花瓣动画：透明度 + 旋转(闭合→展开) + 缩放 + 顶点变形(模拟弯曲生长) + 风摇
 * 不做任何位移，position 始终保持 initPos
 */
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useStore } from '@/app/store';

const BASE_PATH = typeof window !== 'undefined' && window.location.pathname.includes('/tulip')
  ? '/SOME_DEMO/tulip' : '';

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
  huaban1: { type: 'petal',  growStart: 0.38, growEnd: 0.85, order: 0 },
  huaban4: { type: 'petal',  growStart: 0.41, growEnd: 0.87, order: 1 },
  huaban2: { type: 'petal',  growStart: 0.44, growEnd: 0.89, order: 2 },
  huaban5: { type: 'petal',  growStart: 0.47, growEnd: 0.91, order: 3 },
  huaban3: { type: 'petal',  growStart: 0.50, growEnd: 0.93, order: 4 },
  huaban6: { type: 'petal',  growStart: 0.53, growEnd: 0.95, order: 5 },
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
    // 花瓣顶点变形用
    origPositions?: Float32Array;
    zMin?: number;
    zRange?: number;
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

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    partsRef.current.clear();

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const cfg = PART_CONFIG[child.name];

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

        // 花瓣：保存原始顶点位置，用于变形动画
        let origPositions: Float32Array | undefined;
        let zMin = 0, zRange = 1;
        if (cfg?.type === 'petal') {
          const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
          origPositions = new Float32Array(posAttr.array);
          // 计算 Z 范围用于变形权重
          let minZ = Infinity, maxZ = -Infinity;
          for (let i = 0; i < posAttr.count; i++) {
            const z = origPositions[i * 3 + 2];
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
          }
          zMin = minZ;
          zRange = maxZ - minZ || 1;
        }

        partsRef.current.set(child.name, {
          mesh,
          initPos: mesh.position.clone(),
          initQuat: mesh.quaternion.clone(),
          initScale: mesh.scale.clone(),
          mat,
          origPositions,
          zMin,
          zRange,
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
  function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  useFrame((_, dt) => {
    const s = useStore.getState();
    timeRef.current += dt;
    const t = timeRef.current;

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

    const windX = Math.sin(t * s.windSpeed * 0.4) * s.windStrength;
    const windZ = Math.cos(t * s.windSpeed * 0.3 + 1.5) * s.windStrength;

    partsRef.current.forEach((data, name) => {
      const { mesh, initPos, initQuat, initScale, mat, origPositions, zMin, zRange } = data;
      const cfg = PART_CONFIG[name];
      if (!cfg) return;

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
        // === 花瓣：透明度 + 缩放 + 旋转 + 顶点变形 + 风摇 ===
        // 不做任何位移！

        const ord = cfg.order || 0;

        // 还原 transform（不动 position）
        mesh.position.copy(initPos);
        mesh.quaternion.copy(initQuat);
        mesh.scale.copy(initScale);

        // ── (1) 透明度 ──
        mat.opacity = easeOutCubic(Math.min(localP * 2.5, 1));

        // ── (2) 缩放：从小到大 ──
        const scalePhase = Math.min(localP / 0.50, 1);
        const scaleEased = easeOutBack(scalePhase);
        const sc = Math.max(0.001, scaleEased);
        mesh.scale.multiplyScalar(sc);

        // ── (3) 旋转：花苞闭合→展开 ──
        // 闭合 = 花瓣向中心收拢（旋转）
        // 展开 = 逐渐回到模型原始姿态
        const bloomPhase = Math.min(Math.max((localP - 0.25) / 0.75, 0), 1);
        const bloomEased = easeOutBack(bloomPhase);
        const closeAmount = 1.0 - bloomEased;

        if (closeAmount > 0.005) {
          // 主闭合旋转：花瓣向上收拢
          mesh.rotateX(-closeAmount * 0.5);
          // 不对称微调
          mesh.rotateY(closeAmount * 0.08 * (ord % 2 === 0 ? 1 : -1));
          mesh.rotateZ(closeAmount * 0.04 * (ord % 3 === 0 ? 1 : -1));
        }

        // ── (4) 顶点变形：模拟生长弯曲 ──
        // 花瓣尖端（Z更负）弯曲更多，模拟从内到外的生长伸展
        if (origPositions) {
          const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
          const arr = posAttr.array as Float32Array;
          const deformPhase = Math.min(localP / 0.65, 1);
          const deformAmount = (1 - easeInOutCubic(deformPhase));

          // 风摇变形（生长完成后）
          const windDeform = bloomEased > 0.8
            ? (bloomEased - 0.8) * 5.0  // 0→1
            : 0;

          for (let i = 0; i < posAttr.count; i++) {
            const ox = origPositions[i * 3];
            const oy = origPositions[i * 3 + 1];
            const oz = origPositions[i * 3 + 2];

            // 顶点在花瓣上的相对位置 (0=花蕊端, 1=花瓣尖端)
            const tip = Math.max(0, Math.min(1, (oz - zMin!) / zRange!));
            // 反转：tip=0 是花蕊端（Z较大/较浅），tip=1 是花瓣尖（Z较小/更负）
            // 实际花瓣 Z 越小越远，所以 tip 已经正确

            // 生长弯曲：花瓣尖端向内卷曲（减小Z的绝对值 = 让花瓣尖端靠近花蕊）
            // 加上 X/Y 方向的微弯曲
            const curlWeight = tip * tip * deformAmount;
            const curlZ = curlWeight * 4.0;       // 花瓣尖端向花蕊卷曲
            const curlX = curlWeight * 1.5 * (ord % 2 === 0 ? 1 : -1);  // 侧向弯曲

            // 风摇变形：波浪式摇曳
            let windDx = 0, windDy = 0, windDz = 0;
            if (windDeform > 0) {
              const wt = tip * windDeform;
              const wFreq = 2.0 + ord * 0.3;
              windDx = Math.sin(t * wFreq + oz * 0.1 + ord * 1.2) * wt * 0.8 * s.windStrength;
              windDy = Math.cos(t * wFreq * 0.7 + oz * 0.08 + ord * 0.9) * wt * 0.5 * s.windStrength;
              windDz = Math.sin(t * wFreq * 0.5 + oz * 0.12 + ord * 1.5) * wt * 0.3 * s.windStrength;
            }

            arr[i * 3]     = ox + curlX + windDx;
            arr[i * 3 + 1] = oy + windDy;
            arr[i * 3 + 2] = oz + curlZ + windDz;
          }
          posAttr.needsUpdate = true;
        }

        // ── (5) 绽放后整体风摇旋转 ──
        if (bloomEased > 0.7) {
          const liveAmt = Math.min((bloomEased - 0.7) / 0.3, 1);
          const freq1 = 1.0 + ord * 0.18;
          const freq2 = 0.7 + ord * 0.13;

          mesh.rotateX(Math.sin(t * freq1 + ord * 1.5) * 0.005 * liveAmt * s.windStrength);
          mesh.rotateZ(Math.sin(t * freq2 + ord * 2.1) * 0.004 * liveAmt * s.windStrength);
          mesh.rotateY(Math.cos(t * freq1 * 0.5 + ord * 0.8) * 0.002 * liveAmt * s.windStrength);
          // 呼吸感
          const breathe = 1.0 + Math.sin(t * 0.5 + ord * 0.8) * 0.008 * liveAmt;
          mesh.scale.multiplyScalar(breathe);
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