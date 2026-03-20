'use client';
/**
 * VOL5 郁金香 — 6种动画效果
 * Tab1: 生长  Tab2: 绽放  Tab3: 风动  Tab4: 发光  Tab5: 旋转  Tab6: 凋零
 *
 * 花瓣动画：透明度 + 旋转 + 缩放 + 对称顶点变形 + 风摇
 * 不做任何位移，不做非对称curlX偏移
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

// 缓动函数
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
function easeInCubic(t: number) { return t * t * t; }
function easeOutQuad(t: number) { return 1 - (1 - t) * (1 - t); }

interface PartData {
  mesh: THREE.Mesh;
  initPos: THREE.Vector3;
  initQuat: THREE.Quaternion;
  initScale: THREE.Vector3;
  mat: THREE.MeshStandardMaterial;
  origPositions?: Float32Array;
  zMin?: number;
  zMax?: number;
  zRange?: number;
}

export default function Tulip() {
  const groupRef = useRef<THREE.Group>(null!);
  const timeRef = useRef(0);
  const partsRef = useRef<Map<string, PartData>>(new Map());

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
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const cfg = PART_CONFIG[child.name];
      const mat = new THREE.MeshStandardMaterial({
        map: colorTex, roughnessMap: roughTex,
        roughness: 0.55, metalness: 0.0,
        side: THREE.DoubleSide, transparent: true, opacity: 0,
        envMapIntensity: 0.3,
      });
      mesh.material = mat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      let origPositions: Float32Array | undefined;
      let zMin = 0, zMax = 0, zRange = 1;
      if (cfg?.type === 'petal' || cfg?.type === 'leaf') {
        const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        origPositions = new Float32Array(posAttr.array);
        let mnZ = Infinity, mxZ = -Infinity;
        for (let i = 0; i < posAttr.count; i++) {
          const z = origPositions[i * 3 + 2];
          if (z < mnZ) mnZ = z;
          if (z > mxZ) mxZ = z;
        }
        zMin = mnZ; zMax = mxZ; zRange = mxZ - mnZ || 1;
      }

      partsRef.current.set(child.name, {
        mesh, initPos: mesh.position.clone(),
        initQuat: mesh.quaternion.clone(),
        initScale: mesh.scale.clone(),
        mat, origPositions, zMin, zMax, zRange,
      });
    });
    return cloned;
  }, [gltf, colorTex, roughTex]);

  // ========== 动画主循环 ==========
  useFrame((_, dt) => {
    const s = useStore.getState();
    timeRef.current += dt;
    const t = timeRef.current;
    const tab = s.activeTab;

    // 全局进度
    let progress: number;
    if (s.autoPlay) {
      const cycle = s.growthDuration;
      if (s.loopMode === 'loop') progress = (t % cycle) / cycle;
      else if (s.loopMode === 'pingpong') {
        const ph = (t % (cycle * 2)) / cycle;
        progress = ph <= 1 ? ph : 2 - ph;
      } else progress = Math.min(t / cycle, 1);
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
        (progress - cfg.growStart) / (cfg.growEnd - cfg.growStart)));
      const ord = cfg.order || 0;

      // 每帧还原
      mesh.position.copy(initPos);
      mesh.quaternion.copy(initQuat);
      mesh.scale.copy(initScale);
      // 还原顶点
      if (origPositions) {
        const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        (posAttr.array as Float32Array).set(origPositions);
        posAttr.needsUpdate = true;
      }

      if (tab === 1) animGrowth(mesh, mat, cfg, localP, ord, t, windX, windZ, s, origPositions, zMin!, zRange!);
      else if (tab === 2) animBloom(mesh, mat, cfg, localP, ord, t, s, origPositions, zMin!, zRange!);
      else if (tab === 3) animWind(mesh, mat, cfg, ord, t, s, origPositions, zMin!, zRange!);
      else if (tab === 4) animGlow(mesh, mat, cfg, localP, ord, t, s);
      else if (tab === 5) animSpin(mesh, mat, cfg, ord, t, progress, s);
      else if (tab === 6) animWilt(mesh, mat, cfg, localP, ord, t, s, origPositions, zMin!, zRange!);

      mesh.visible = tab === 3 || tab === 4 || tab === 5 ? true : localP > 0.001;
    });

    // 整体
    const gGrow = Math.min(progress * 3, 1);
    if (tab === 5) {
      group.rotation.y = t * 0.3;
      group.rotation.z = 0; group.rotation.x = 0;
    } else {
      group.rotation.y = 0;
      group.rotation.z = windX * 0.003 * gGrow;
      group.rotation.x = windZ * 0.002 * gGrow;
    }
  });

  // ===== Tab1: 生长 =====
  function animGrowth(
    mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial,
    cfg: typeof PART_CONFIG[string], localP: number, ord: number,
    t: number, windX: number, windZ: number, s: any,
    origPos?: Float32Array, zMin?: number, zRange?: number,
  ) {
    if (cfg.type === 'stem') {
      const p = easeOutCubic(localP);
      mesh.scale.set(
        mesh.scale.x * (0.3 + p * 0.7),
        mesh.scale.y * Math.max(0.001, p),
        mesh.scale.z * (0.3 + p * 0.7));
      mat.opacity = Math.min(localP * 5, 1);
      if (p > 0.3) { mesh.rotateZ(windX * 0.003 * p); mesh.rotateX(windZ * 0.002 * p); }
    } else if (cfg.type === 'leaf') {
      const p = easeOutBack(localP);
      mesh.scale.multiplyScalar(Math.max(0.001, p));
      mat.opacity = Math.min(localP * 4, 1);
      mesh.rotateY((1 - p) * 0.6);
      mesh.rotateX((1 - p) * 0.18);
      if (p > 0.3) mesh.rotateZ(Math.sin(t * s.windSpeed * 0.6 + mesh.id * 2) * 0.008 * s.windStrength * p);
    } else if (cfg.type === 'pistil') {
      mat.opacity = easeOutCubic(Math.min(localP * 2.5, 1));
    } else if (cfg.type === 'petal') {
      // 透明度
      mat.opacity = easeOutCubic(Math.min(localP * 2.5, 1));
      // 缩放
      const sc = Math.max(0.001, easeOutBack(Math.min(localP / 0.50, 1)));
      mesh.scale.multiplyScalar(sc);
      // 旋转闭合→展开
      const bloom = easeOutBack(Math.min(Math.max((localP - 0.25) / 0.75, 0), 1));
      const close = 1.0 - bloom;
      if (close > 0.005) {
        mesh.rotateX(-close * 0.5);
        mesh.rotateY(close * 0.08 * (ord % 2 === 0 ? 1 : -1));
      }
      // 顶点变形：仅Z方向对称压缩（不做X偏移！）
      if (origPos && zRange) {
        const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const deform = 1 - easeInOutCubic(Math.min(localP / 0.65, 1));
        for (let i = 0; i < posAttr.count; i++) {
          const oz = origPos[i * 3 + 2];
          const tip = (oz - zMin!) / zRange!;
          // 仅Z向压缩：花瓣尖端向花蕊端收缩
          arr[i * 3 + 2] = oz + tip * tip * deform * 3.5;
        }
        posAttr.needsUpdate = true;
      }
      // 绽放后风摇
      if (bloom > 0.7) {
        const live = (bloom - 0.7) / 0.3;
        mesh.rotateX(Math.sin(t * (1.0 + ord * 0.18) + ord * 1.5) * 0.005 * live * s.windStrength);
        mesh.rotateZ(Math.sin(t * (0.7 + ord * 0.13) + ord * 2.1) * 0.004 * live * s.windStrength);
      }
    }
  }

  // ===== Tab2: 绽放 — 花朵已长好，循环做绽放+收拢 =====
  function animBloom(
    mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial,
    cfg: typeof PART_CONFIG[string], localP: number, ord: number,
    t: number, s: any,
    origPos?: Float32Array, zMin?: number, zRange?: number,
  ) {
    mat.opacity = 1;
    if (cfg.type !== 'petal') return;
    // 绽放用 progress 做循环开合
    const cycle = Math.sin(t * 0.4 + ord * 0.3) * 0.5 + 0.5; // 0~1 循环
    const bloom = easeOutElastic(cycle);
    const close = 1 - bloom;
    // 旋转开合
    mesh.rotateX(-close * 0.6);
    mesh.rotateY(close * 0.1 * (ord % 2 === 0 ? 1 : -1));
    // 缩放呼吸
    const breathe = 1.0 + Math.sin(t * 0.8 + ord * 0.5) * 0.02;
    mesh.scale.multiplyScalar(breathe);
    // 顶点变形：花瓣尖端随开合弯曲
    if (origPos && zRange) {
      const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < posAttr.count; i++) {
        const oz = origPos[i * 3 + 2];
        const tip = (oz - zMin!) / zRange!;
        arr[i * 3 + 2] = oz + tip * tip * close * 2.5;
      }
      posAttr.needsUpdate = true;
    }
  }

  // ===== Tab3: 风动 — 全部件显示，强风摇摆 =====
  function animWind(
    mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial,
    cfg: typeof PART_CONFIG[string], ord: number,
    t: number, s: any,
    origPos?: Float32Array, zMin?: number, zRange?: number,
  ) {
    mat.opacity = 1;
    const ws = s.windStrength * 2.5;
    const spd = s.windSpeed * 1.5;
    if (cfg.type === 'stem') {
      mesh.rotateZ(Math.sin(t * spd * 0.5) * 0.015 * ws);
      mesh.rotateX(Math.cos(t * spd * 0.4 + 1) * 0.010 * ws);
    } else if (cfg.type === 'leaf') {
      const f = 0.8 + ord * 0.2;
      mesh.rotateZ(Math.sin(t * spd * f) * 0.025 * ws);
      mesh.rotateX(Math.cos(t * spd * f * 0.7 + ord) * 0.015 * ws);
      mesh.rotateY(Math.sin(t * spd * f * 0.3 + ord * 2) * 0.008 * ws);
      // 叶片顶点波浪
      if (origPos && zRange) {
        const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < posAttr.count; i++) {
          const oy = origPos[i * 3 + 1];
          const w = oy / 30;
          arr[i * 3] = origPos[i * 3] + Math.sin(t * spd + oy * 0.15) * w * 1.2 * ws;
          arr[i * 3 + 2] = origPos[i * 3 + 2] + Math.cos(t * spd * 0.8 + oy * 0.1) * w * 0.6 * ws;
        }
        posAttr.needsUpdate = true;
      }
    } else if (cfg.type === 'petal') {
      const f = 1.0 + ord * 0.15;
      mesh.rotateX(Math.sin(t * spd * f + ord * 1.2) * 0.012 * ws);
      mesh.rotateZ(Math.cos(t * spd * f * 0.8 + ord * 2) * 0.010 * ws);
      mesh.rotateY(Math.sin(t * spd * f * 0.4 + ord * 0.8) * 0.005 * ws);
      // 花瓣顶点风浪
      if (origPos && zRange) {
        const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < posAttr.count; i++) {
          const oz = origPos[i * 3 + 2];
          const tip = (oz - zMin!) / zRange!;
          const w = tip * tip;
          arr[i * 3] = origPos[i * 3] + Math.sin(t * spd * 1.2 + oz * 0.08 + ord) * w * 0.8 * ws;
          arr[i * 3 + 1] = origPos[i * 3 + 1] + Math.cos(t * spd * 0.9 + oz * 0.06 + ord * 1.5) * w * 0.5 * ws;
        }
        posAttr.needsUpdate = true;
      }
    }
  }

  // ===== Tab4: 发光 — 脉冲发光+辉光色变 =====
  function animGlow(
    mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial,
    cfg: typeof PART_CONFIG[string], localP: number, ord: number,
    t: number, s: any,
  ) {
    mat.opacity = 1;
    // 全局脉冲
    const pulse = Math.sin(t * 1.5) * 0.5 + 0.5;
    const glow = easeOutQuad(pulse);
    // 发光颜色：从暖白→金黄→橙红循环
    const hue = (t * 0.05 + ord * 0.1) % 1;
    const emC = new THREE.Color().setHSL(hue * 0.12 + 0.08, 0.9, 0.3 + glow * 0.4);
    mat.emissive = emC;
    mat.emissiveIntensity = 0.3 + glow * 1.5;
    // 花瓣特殊处理：逐片延迟脉冲
    if (cfg.type === 'petal') {
      const petalPulse = Math.sin(t * 2.0 + ord * 0.8) * 0.5 + 0.5;
      mat.emissiveIntensity = 0.5 + easeOutQuad(petalPulse) * 2.0;
      // 微缩放呼吸
      const b = 1.0 + Math.sin(t * 1.2 + ord * 0.6) * 0.015;
      mesh.scale.multiplyScalar(b);
    }
    // 微风摇
    mesh.rotateZ(Math.sin(t * 0.5 + ord) * 0.003);
    mesh.rotateX(Math.cos(t * 0.4 + ord) * 0.002);
  }

  // ===== Tab5: 旋转 — 展示台旋转+花瓣微动 =====
  function animSpin(
    mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial,
    cfg: typeof PART_CONFIG[string], ord: number,
    t: number, progress: number, s: any,
  ) {
    mat.opacity = 1;
    mat.emissive = new THREE.Color(0x000000);
    mat.emissiveIntensity = 0;
    // 花瓣微摇
    if (cfg.type === 'petal') {
      mesh.rotateX(Math.sin(t * 0.8 + ord * 1.2) * 0.006);
      mesh.rotateY(Math.cos(t * 0.6 + ord * 0.9) * 0.004);
      const b = 1 + Math.sin(t * 0.4 + ord * 0.5) * 0.008;
      mesh.scale.multiplyScalar(b);
    } else if (cfg.type === 'leaf') {
      mesh.rotateZ(Math.sin(t * 0.6 + mesh.id) * 0.008);
    }
  }

  // ===== Tab6: 凋零 — 花瓣枯萎下垂+变色+脱落 =====
  function animWilt(
    mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial,
    cfg: typeof PART_CONFIG[string], localP: number, ord: number,
    t: number, s: any,
    origPos?: Float32Array, zMin?: number, zRange?: number,
  ) {
    // progress 控制凋零程度
    const wilt = easeInCubic(Math.min(localP * 1.2, 1));
    if (cfg.type === 'petal') {
      mat.opacity = Math.max(1.0 - wilt * 0.8, 0.15);
      // 颜色变暗变黄
      const decay = wilt;
      mat.color = new THREE.Color().setHSL(
        0.08 + decay * 0.04,
        Math.max(0.2, 0.6 - decay * 0.5),
        Math.max(0.25, 0.5 - decay * 0.3)
      );
      // 花瓣下垂
      mesh.rotateX(wilt * 0.8);
      mesh.rotateZ(wilt * 0.15 * (ord % 2 === 0 ? 1 : -1));
      // 缩放收缩
      mesh.scale.multiplyScalar(1.0 - wilt * 0.25);
      // 顶点变形：花瓣尖端严重下垂
      if (origPos && zRange) {
        const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < posAttr.count; i++) {
          const oy = origPos[i * 3 + 1];
          const oz = origPos[i * 3 + 2];
          const tip = (oz - zMin!) / zRange!;
          const droopW = tip * tip * wilt;
          arr[i * 3 + 1] = oy - droopW * 5.0;
          arr[i * 3 + 2] = oz + droopW * 2.0;
        }
        posAttr.needsUpdate = true;
      }
    } else if (cfg.type === 'leaf') {
      mat.opacity = Math.max(1.0 - wilt * 0.6, 0.3);
      mat.color = new THREE.Color().setHSL(0.12, Math.max(0.15, 0.5 - wilt * 0.4), Math.max(0.2, 0.45 - wilt * 0.2));
      mesh.rotateX(wilt * 0.4);
      mesh.rotateZ(wilt * 0.2 * (ord % 2 === 0 ? 1 : -1));
    } else if (cfg.type === 'stem') {
      mat.opacity = 1;
      mat.color = new THREE.Color().setHSL(0.10, Math.max(0.1, 0.4 - wilt * 0.3), Math.max(0.2, 0.4 - wilt * 0.15));
      mesh.rotateZ(wilt * 0.08);
    } else {
      mat.opacity = Math.max(1 - wilt, 0.2);
    }
  }

  return (
    <group ref={groupRef} position={[0, -0.15, 0]}>
      <primitive object={scene} />
    </group>
  );
}