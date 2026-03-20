'use client';
/**
 * VOL5 郁金香 — 拆分 GLB + 专业级生长动画
 *
 * 生长时间轴 (progress 0→1):
 *  0.00~0.08  种子萌发 — 整体从地面冒出
 *  0.05~0.40  茎拔节生长 — 从底部向上逐段伸展
 *  0.10~0.50  叶片依次展开 — 从卷曲到舒展
 *  0.30~0.55  花苞形成 — 花瓣从无到有，闭门状态
 *  0.50~0.90  花朵绽放 — 花瓣逐片优雅展开
 *  0.85~1.00  完全盛开 — 花蕊显露，微微颤动
 */
import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useStore } from '@/app/store';

const BASE_PATH = typeof window !== 'undefined' && window.location.pathname.includes('/tulip')
  ? '/SOME_DEMO/tulip' : '';

// 部件名 → 类型映射
const PART_TYPE: Record<string, 'stem' | 'petal' | 'pistil' | 'leaf'> = {
  genjin: 'stem',
  huaban1: 'petal', huaban2: 'petal', huaban3: 'petal',
  huaban4: 'petal', huaban5: 'petal', huaban6: 'petal',
  huarui: 'pistil',
  left1: 'leaf', left2: 'leaf', left3: 'leaf',
};

// 花瓣展开顺序(交替绽放) + 个性参数
const PETAL_CONFIG: Record<string, { order: number; openAxis: THREE.Vector3; openAngle: number; delay: number }> = {
  huaban1: { order: 0, openAxis: new THREE.Vector3(1, 0, 0.3).normalize(), openAngle: 0.65, delay: 0.0 },
  huaban4: { order: 1, openAxis: new THREE.Vector3(-0.8, 0, 0.5).normalize(), openAngle: 0.58, delay: 0.06 },
  huaban2: { order: 2, openAxis: new THREE.Vector3(0.5, 0, -0.8).normalize(), openAngle: 0.52, delay: 0.12 },
  huaban5: { order: 3, openAxis: new THREE.Vector3(-0.3, 0, -0.9).normalize(), openAngle: 0.60, delay: 0.18 },
  huaban3: { order: 4, openAxis: new THREE.Vector3(0.9, 0, 0.1).normalize(), openAngle: 0.55, delay: 0.24 },
  huaban6: { order: 5, openAxis: new THREE.Vector3(-0.6, 0, 0.7).normalize(), openAngle: 0.62, delay: 0.30 },
};

const LEAF_CONFIG: Record<string, { delay: number }> = {
  left1: { delay: 0.0 },
  left2: { delay: 0.08 },
  left3: { delay: 0.15 },
};

// 缓动函数
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 加载贴图
function useTextures() {
  const { gl } = useThree();
  return useMemo(() => {
    const loader = new THREE.TextureLoader();
    const maxAniso = gl.capabilities.getMaxAnisotropy();

    const color = loader.load(`${BASE_PATH}/model/color.png`);
    // GLB 内部贴图默认 flipY=false, 但外部 PNG 加载默认 flipY=true
    // 需要跟原始 GLB 的 UV 匹配 — 试两种，如果不对就反转
    color.flipY = false;
    color.colorSpace = THREE.SRGBColorSpace;
    color.anisotropy = maxAniso;
    color.wrapS = THREE.RepeatWrapping;
    color.wrapT = THREE.RepeatWrapping;

    const roughness = loader.load(`${BASE_PATH}/model/roughness.png`);
    roughness.flipY = false;
    roughness.anisotropy = maxAniso;
    roughness.wrapS = THREE.RepeatWrapping;
    roughness.wrapT = THREE.RepeatWrapping;

    return { color, roughness };
  }, [gl]);
}

export default function Tulip() {
  const groupRef = useRef<THREE.Group>(null!);
  const timeRef = useRef(0);
  const partsRef = useRef<Map<string, {
    mesh: THREE.Mesh;
    initPos: THREE.Vector3;
    initQuat: THREE.Quaternion;
    initScale: THREE.Vector3;
  }>>(new Map());

  const gltf = useGLTF(`${BASE_PATH}/model/tulip-split.glb`);
  const textures = useTextures();

  // 自定义材质 — 带贴图 + SSS + Fresnel
  const flowerMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vWN, vWP;
      varying vec2 vUv;
      varying float vFresnel;

      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        vWN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec3 V = normalize(cameraPosition - wp.xyz);
        vFresnel = pow(1.0 - max(dot(vWN, V), 0.0), 3.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uColorMap;
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vWN, vWP;
      varying vec2 vUv;
      varying float vFresnel;

      void main() {
        vec4 texCol = texture2D(uColorMap, vUv);
        vec3 col = texCol.rgb;
        vec3 N = normalize(vWN);
        vec3 V = normalize(cameraPosition - vWP);

        // 主光
        vec3 L1 = normalize(vec3(0.3, 1.0, 0.4));
        vec3 L2 = normalize(vec3(-0.5, 0.4, -0.3));
        float wrap = 0.35;
        float d1 = (max(dot(N, L1), 0.0) + wrap) / (1.0 + wrap);
        float d2 = (max(dot(N, L2), 0.0) + wrap) / (1.0 + wrap);

        vec3 lit = col * (0.22 + d1 * 0.58 + d2 * 0.15);

        // SSS
        float sss = pow(max(dot(-N, L1), 0.0), 2.5);
        lit += col * sss * 0.18;

        // 高光
        vec3 H = normalize(L1 + V);
        lit += vec3(1.0, 0.98, 0.95) * pow(max(dot(N, H), 0.0), 80.0) * 0.12;

        // Fresnel 边缘光
        lit += vec3(0.85, 0.80, 0.95) * vFresnel * 0.20;

        // 柔和微光 
        lit += col * 0.03 * sin(uTime * 0.8 + vWP.y * 4.0) * vFresnel;

        float alpha = texCol.a * uOpacity;
        gl_FragColor = vec4(lit, alpha);
      }
    `,
    uniforms: {
      uColorMap: { value: textures.color },
      uTime: { value: 0 },
      uOpacity: { value: 1.0 },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
  }), [textures]);

  // 初始化：遍历场景，给每个部件替换材质 + 记录初始变换
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = flowerMat;
        // 记录初始变换
        partsRef.current.set(child.name, {
          mesh,
          initPos: mesh.position.clone(),
          initQuat: mesh.quaternion.clone(),
          initScale: mesh.scale.clone(),
        });
      }
    });
    return cloned;
  }, [gltf, flowerMat]);

  /* ===== 每帧驱动生长动画 ===== */
  useFrame((_, dt) => {
    const s = useStore.getState();
    timeRef.current += dt;
    const t = timeRef.current;

    flowerMat.uniforms.uTime.value = t;

    // 计算生长进度
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

    // ===== 全局 =====
    const emerge = THREE.MathUtils.smoothstep(progress, 0.0, 0.08);
    group.visible = emerge > 0.001;

    // 风
    const windX = Math.sin(t * s.windSpeed * 0.4) * 0.012 * s.windStrength;
    const windZ = Math.cos(t * s.windSpeed * 0.3 + 1.5) * 0.006 * s.windStrength;

    partsRef.current.forEach((data, name) => {
      const { mesh, initPos, initQuat, initScale } = data;
      const type = PART_TYPE[name];

      if (type === 'stem') {
        // ===== 茎 — 从下向上逐段拔高 =====
        const stemGrow = THREE.MathUtils.smoothstep(progress, 0.04, 0.42);
        const easedStem = easeOutBack(stemGrow);

        mesh.scale.copy(initScale);
        mesh.scale.y = Math.max(0.001, easedStem) * initScale.y;
        mesh.position.copy(initPos);
        // 茎底部固定，向上生长
        mesh.position.y = initPos.y * easedStem;

        // 整体不透明度
        flowerMat.uniforms.uOpacity.value = THREE.MathUtils.clamp(emerge * 5, 0, 1);

        // 茎的微微摇摆
        mesh.rotation.z = windX * easedStem;
        mesh.rotation.x = windZ * easedStem;

      } else if (type === 'petal') {
        // ===== 花瓣 — 逐片绽放 =====
        const cfg = PETAL_CONFIG[name];
        if (!cfg) return;

        // 花苞形成
        const budStart = 0.30;
        const budEnd = 0.52;
        const budForm = THREE.MathUtils.smoothstep(progress, budStart, budEnd);
        const easedBud = easeInOutCubic(budForm);

        // 花瓣绽放（带个体延迟）
        const bloomStart = 0.50 + cfg.delay;
        const bloomEnd = 0.88 + cfg.delay * 0.5;
        const bloom = THREE.MathUtils.smoothstep(progress, bloomStart, Math.min(bloomEnd, 0.98));
        const easedBloom = easeOutElastic(Math.min(bloom, 1));

        // 缩放：从 0 → 花苞大小 → 完全展开
        const sc = easedBud * (0.4 + easedBloom * 0.6);
        mesh.scale.copy(initScale).multiplyScalar(Math.max(0.001, sc));

        // 展开旋转
        const openAngle = cfg.openAngle * easedBloom;
        mesh.quaternion.copy(initQuat);
        const rotQ = new THREE.Quaternion().setFromAxisAngle(cfg.openAxis, openAngle);
        mesh.quaternion.premultiply(rotQ);

        // 花瓣微颤
        if (bloom > 0.1) {
          const tremble = Math.sin(t * 3.5 + cfg.order * 1.2) * 0.008 * (1 - bloom * 0.5);
          mesh.rotation.x += tremble;
          mesh.rotation.z += tremble * 0.6;
        }

        // 风中摇曳
        mesh.rotation.z += windX * 0.5 * sc;

        mesh.visible = budForm > 0.01;

      } else if (type === 'pistil') {
        // ===== 花蕊 — 花瓣展开后才显露 =====
        const pistilShow = THREE.MathUtils.smoothstep(progress, 0.65, 0.85);
        const easedPistil = easeOutBack(pistilShow);
        mesh.scale.copy(initScale).multiplyScalar(Math.max(0.001, easedPistil));
        mesh.visible = pistilShow > 0.01;

        // 花蕊微微颤动
        if (pistilShow > 0.5) {
          mesh.rotation.x = Math.sin(t * 2.0) * 0.005;
          mesh.rotation.z = Math.cos(t * 1.7) * 0.005;
        }

      } else if (type === 'leaf') {
        // ===== 叶片 — 从紧贴茎到舒展 =====
        const cfg = LEAF_CONFIG[name] || { delay: 0 };
        const leafStart = 0.10 + cfg.delay;
        const leafEnd = 0.50 + cfg.delay;
        const leafGrow = THREE.MathUtils.smoothstep(progress, leafStart, leafEnd);
        const easedLeaf = easeOutBack(leafGrow);

        // 缩放生长
        mesh.scale.copy(initScale);
        mesh.scale.multiplyScalar(Math.max(0.001, easedLeaf));

        // 叶片从紧贴茎(卷曲)到展开 — 绕叶片基部外旋
        const unfurlAngle = (1 - easedLeaf) * 0.4; // 未展开时贴合
        mesh.quaternion.copy(initQuat);
        // 在初始旋转基础上叠加卷曲
        const leafQ = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0), unfurlAngle
        );
        mesh.quaternion.multiply(leafQ);

        // 风吹叶动
        const leafWind = Math.sin(t * s.windSpeed * 0.6 + cfg.delay * 10) * 0.02 * s.windStrength * easedLeaf;
        mesh.rotation.z += leafWind;
        mesh.rotation.x += leafWind * 0.4;

        mesh.visible = leafGrow > 0.01;
      }
    });

    // 整体风摇
    group.rotation.z = windX * emerge;
    group.rotation.x = windZ * emerge;
  });

  return (
    <group ref={groupRef} position={[0, -0.15, 0]}>
      <primitive object={scene} />
    </group>
  );
}