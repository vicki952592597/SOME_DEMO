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
    color.flipY = true;
    color.colorSpace = THREE.SRGBColorSpace;
    color.anisotropy = maxAniso;
    color.wrapS = THREE.RepeatWrapping;
    color.wrapT = THREE.RepeatWrapping;

    const roughness = loader.load(`${BASE_PATH}/model/roughness.png`);
    roughness.flipY = true;
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

  // 第一步：原样显示模型，不做任何变换修改
  // 使用 GLB 自带的材质，仅确保 doubleSide + 贴图
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const origMat = mesh.material as THREE.MeshStandardMaterial;
        if (origMat) {
          // 保留 GLB 原始材质，只加贴图和 doubleSide
          origMat.map = textures.color;
          origMat.roughnessMap = textures.roughness;
          origMat.side = THREE.DoubleSide;
          origMat.needsUpdate = true;
        }
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
  }, [gltf, textures]);

  // 暂时不做动画，先确保模型正确显示
  useFrame(() => {
    // 仅风效微动
    const t = performance.now() * 0.001;
    const group = groupRef.current;
    if (!group) return;
    const s = useStore.getState();
    group.rotation.z = Math.sin(t * s.windSpeed * 0.4) * 0.005 * s.windStrength;
    group.rotation.x = Math.cos(t * s.windSpeed * 0.3) * 0.003 * s.windStrength;
  });

  return (
    <group ref={groupRef} position={[0, -0.15, 0]}>
      <primitive object={scene} />
    </group>
  );
}