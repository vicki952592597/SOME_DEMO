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

        // ★ DEBUG: 打印每个mesh的变换信息
        const geo = mesh.geometry;
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        console.log(`[MESH] ${child.name}`,
          `pos=(${mesh.position.x.toFixed(3)}, ${mesh.position.y.toFixed(3)}, ${mesh.position.z.toFixed(3)})`,
          `scale=(${mesh.scale.x.toFixed(3)}, ${mesh.scale.y.toFixed(3)}, ${mesh.scale.z.toFixed(3)})`,
          `quat=(${mesh.quaternion.x.toFixed(4)}, ${mesh.quaternion.y.toFixed(4)}, ${mesh.quaternion.z.toFixed(4)}, ${mesh.quaternion.w.toFixed(4)})`,
          bb ? `bbox=(${bb.min.x.toFixed(2)}~${bb.max.x.toFixed(2)}, ${bb.min.y.toFixed(2)}~${bb.max.y.toFixed(2)}, ${bb.min.z.toFixed(2)}~${bb.max.z.toFixed(2)})` : 'no bbox',
          `parent=${mesh.parent?.name || 'none'}`,
          `parentPos=(${mesh.parent?.position?.x?.toFixed(3) || 0}, ${mesh.parent?.position?.y?.toFixed(3) || 0}, ${mesh.parent?.position?.z?.toFixed(3) || 0})`
        );

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
        // === 花瓣：专业级 花苞→绽放动画 ===
        //
        // 模型结构：
        //   - 所有花瓣共享同一个 pivot 位置 [-0.379, 3.295, 0]（local空间）
        //   - 父节点 group1 有 X轴90度旋转（Z-up→Y-up）+ 0.01缩放
        //   - 花瓣自身无旋转 quat=[0,0,0,1]
        //
        // 动画策略：
        //  (1) 从小到大缩放（保持position不变，从pivot点膨胀）
        //  (2) 淡入
        //  (3) 花苞闭合→绽放（Z轴旋转，因为父级90度翻转后Z=视觉上的"向上"）
        //  (4) 呼吸脉动 + 摇曳

        const ord = cfg.order || 0;

        // 还原所有变换到初始状态
        mesh.position.copy(initPos);
        mesh.quaternion.copy(initQuat);
        mesh.scale.copy(initScale);

        // ── (1) 缩放生长 ──
        // 花瓣从 pivot 点以极小尺寸开始，均匀膨胀
        const growPhase = Math.min(localP / 0.50, 1);  // 0~0.50 → 0~1
        const growEased = easeOutCubic(growPhase);
        const sc = Math.max(0.001, growEased);
        mesh.scale.multiplyScalar(sc);

        // ── (2) 淡入 ──
        mat.opacity = easeOutCubic(Math.min(localP * 3.0, 1));

        // ── (3) 花苞闭合→绽放 ──
        // 在父节点空间中（group1 已X旋转90度），花瓣的local Z轴 = 视觉"上"方向
        // 闭合 = 花瓣绕自身local Z轴向内收拢（实际不对——要用世界空间思考）
        //
        // 实测：父节点将Z-up变成Y-up。花瓣geometry在local空间中是沿Z延伸的。
        // 闭合运动：花瓣向花蕊中心收拢 = 在local空间中绕 Z轴旋转
        // 但每片花瓣的"内"方向不同，需要利用花瓣geometry的朝向。
        //
        // 简化方案：不旋转闭合，纯缩放+opacity 生长。
        // 绽放效果改为：从紧闭到展开 = 从小缩放（花苞紧凑）到大（完全展开）
        // 加上微量旋转来模拟花瓣的弹性打开

        const bloomStart = 0.40;
        const rawBloom = Math.max((localP - bloomStart) / (1.0 - bloomStart), 0);
        const bloomP = easeOutBack(Math.min(rawBloom, 1));

        // ── (4) 绽放微弹 ──
        // 花瓣展开时，在各自local轴上加一个很小的弹性旋转，模拟"弹开"
        if (rawBloom > 0 && rawBloom < 1) {
          const elasticP = easeOutElastic(Math.min(rawBloom * 1.5, 1));
          // 极小角度的弹性旋转，每片方向略不同
          const angle = (1 - elasticP) * 0.06;
          mesh.rotateZ(angle * (ord % 2 === 0 ? 1 : -1));
          mesh.rotateX(angle * 0.3);
        }

        // ── (5) 活态摇曳 ──
        if (bloomP > 0.4) {
          const liveAmt = Math.min((bloomP - 0.4) / 0.6, 1);
          const freq1 = 1.2 + ord * 0.15;
          const freq2 = 0.8 + ord * 0.12;
          const windEffect = windX * 0.002 * liveAmt;
          const breathe = Math.sin(t * 0.6 + ord * 1.0) * 0.002 * liveAmt;

          mesh.rotateX(
            Math.sin(t * freq1 + ord * 1.5) * 0.004 * liveAmt + breathe
          );
          mesh.rotateZ(
            Math.sin(t * freq2 + ord * 2.1) * 0.003 * liveAmt + windEffect
          );
          mesh.rotateY(
            Math.cos(t * freq1 * 0.5 + ord * 0.8) * 0.001 * liveAmt
          );
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