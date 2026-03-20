'use client';
/**
 * VOL5 郁金香 — Vertex Shader 驱动的专业级生长动画
 *
 * 核心原理：不修改任何节点 transform，通过 Vertex Shader
 * 根据每个顶点的世界空间 Y 坐标，用 uGrowth (0→1) uniform
 * 控制"生长前沿"从底部向上推进。
 *
 * 前沿以下：正常显示
 * 前沿处：顶点向中心轴收缩 + 向下压缩（模拟刚长出）
 * 前沿以上：缩到0（不可见）
 *
 * 生长时间轴 (uGrowth 0→1):
 *  0.00~0.30  茎从地面向上拔节
 *  0.15~0.50  叶片从茎上冒出并展开
 *  0.35~0.65  花苞在茎顶部膨大
 *  0.55~1.00  花瓣逐片舒展绽放
 */
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useStore } from '@/app/store';

const BASE_PATH = typeof window !== 'undefined' && window.location.pathname.includes('/tulip')
  ? '/SOME_DEMO/tulip' : '';

/* ===== 生长 Vertex Shader ===== */
const GROWTH_VS = /* glsl */ `
  uniform float uGrowth;    // 0~1 生长进度
  uniform float uTime;
  uniform float uWindStr;
  uniform float uWindSpd;
  uniform float uYMin;      // 模型世界空间 Y 最小值
  uniform float uYMax;      // 模型世界空间 Y 最大值

  varying vec3 vWN, vWP;
  varying vec2 vUv;
  varying float vFresnel;
  varying float vVisibility;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // 先算出这个顶点在世界空间的 Y（经过所有父变换）
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    float yNorm = clamp((worldPos.y - uYMin) / (uYMax - uYMin + 0.001), 0.0, 1.0);

    // 生长前沿位置
    float growFront = uGrowth;
    // 前沿宽度（过渡带）
    float edgeWidth = 0.08;

    // 可见性：在前沿以下完全可见，前沿处过渡，以上不可见
    vVisibility = 1.0 - smoothstep(growFront - edgeWidth * 0.5, growFront + edgeWidth * 0.5, yNorm);

    // 在前沿区域：顶点向中心轴（X=0, Z=0方向）收缩 + 微微下压
    // 模拟植物组织刚生长出来时紧凑的状态
    float inEdge = smoothstep(growFront - edgeWidth, growFront + edgeWidth * 0.3, yNorm);
    float shrink = inEdge * (1.0 - smoothstep(growFront, growFront + edgeWidth * 2.0, yNorm));

    // 向中心收缩
    vec3 centerDir = vec3(worldPos.x, 0.0, worldPos.z);
    float distFromCenter = length(centerDir);
    if (distFromCenter > 0.001) {
      pos -= (inverse(modelMatrix) * vec4(normalize(centerDir) * distFromCenter * shrink * 0.6, 0.0)).xyz;
    }
    // 向下压
    pos.y -= shrink * 0.3 * (inverse(modelMatrix) * vec4(0.0, 1.0, 0.0, 0.0)).y;

    // 前沿以上的顶点直接缩到前沿位置（压扁）
    float aboveFront = step(growFront + edgeWidth * 0.5, yNorm);
    if (aboveFront > 0.5) {
      // 将超出前沿的顶点压到前沿位置
      vec4 frontWorld = vec4(0.0, uYMin + growFront * (uYMax - uYMin), 0.0, 1.0);
      float excess = worldPos.y - frontWorld.y;
      pos -= (inverse(modelMatrix) * vec4(0.0, excess, 0.0, 0.0)).xyz;
      // 同时向中心收缩
      if (distFromCenter > 0.001) {
        pos -= (inverse(modelMatrix) * vec4(normalize(centerDir) * distFromCenter * 0.95, 0.0)).xyz;
      }
    }

    // 微风摇摆（只对已生长部分）
    float windMask = (1.0 - aboveFront) * yNorm;
    pos.x += sin(uTime * uWindSpd * 0.4 + worldPos.y * 8.0) * 0.15 * uWindStr * windMask;
    pos.z += cos(uTime * uWindSpd * 0.3 + worldPos.y * 6.0 + 1.5) * 0.08 * uWindStr * windMask;

    vec4 finalWorld = modelMatrix * vec4(pos, 1.0);
    vWP = finalWorld.xyz;
    vWN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    vec3 V = normalize(cameraPosition - finalWorld.xyz);
    vFresnel = pow(1.0 - max(dot(vWN, V), 0.0), 3.0);

    gl_Position = projectionMatrix * viewMatrix * finalWorld;
  }
`;

/* ===== Fragment Shader — 贴图 + 光照 + SSS + Fresnel ===== */
const GROWTH_FS = /* glsl */ `
  uniform sampler2D uColorMap;
  uniform float uTime;
  varying vec3 vWN, vWP;
  varying vec2 vUv;
  varying float vFresnel;
  varying float vVisibility;

  void main() {
    if (vVisibility < 0.01) discard;

    vec4 texCol = texture2D(uColorMap, vUv);
    vec3 col = texCol.rgb;
    vec3 N = normalize(vWN);
    vec3 V = normalize(cameraPosition - vWP);

    // 双光源
    vec3 L1 = normalize(vec3(0.3, 1.0, 0.4));
    vec3 L2 = normalize(vec3(-0.5, 0.4, -0.3));
    float wrap = 0.35;
    float d1 = (max(dot(N, L1), 0.0) + wrap) / (1.0 + wrap);
    float d2 = (max(dot(N, L2), 0.0) + wrap) / (1.0 + wrap);
    vec3 lit = col * (0.25 + d1 * 0.55 + d2 * 0.15);

    // SSS 次表面散射
    float sss = pow(max(dot(-N, L1), 0.0), 2.5);
    lit += col * sss * 0.20;

    // 高光
    vec3 H = normalize(L1 + V);
    lit += vec3(1.0, 0.97, 0.93) * pow(max(dot(N, H), 0.0), 60.0) * 0.15;

    // Fresnel
    lit += vec3(0.80, 0.75, 0.90) * vFresnel * 0.22;

    // 前沿处微微泛绿光（新生组织）
    float edgeGlow = (1.0 - vVisibility) * vVisibility * 4.0;
    lit += vec3(0.1, 0.3, 0.05) * edgeGlow * 0.3;

    float alpha = texCol.a * vVisibility;
    gl_FragColor = vec4(lit, alpha);
  }
`;

/* ===== 主组件 ===== */
export default function Tulip() {
  const groupRef = useRef<THREE.Group>(null!);
  const timeRef = useRef(0);
  const matsRef = useRef<THREE.ShaderMaterial[]>([]);

  const gltf = useGLTF(`${BASE_PATH}/model/tulip-split.glb`);

  // 加载贴图
  const { gl } = useThree();
  const colorTex = useMemo(() => {
    const tex = new THREE.TextureLoader().load(`${BASE_PATH}/model/color.png`);
    tex.flipY = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    return tex;
  }, [gl]);

  // 构建场景 + 替换材质为生长 Shader
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    matsRef.current = [];

    // 先计算整体包围盒
    const box = new THREE.Box3().setFromObject(cloned);

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = new THREE.ShaderMaterial({
          vertexShader: GROWTH_VS,
          fragmentShader: GROWTH_FS,
          uniforms: {
            uGrowth: { value: 0.0 },
            uTime: { value: 0.0 },
            uWindStr: { value: 1.0 },
            uWindSpd: { value: 0.5 },
            uYMin: { value: box.min.y },
            uYMax: { value: box.max.y },
            uColorMap: { value: colorTex },
          },
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: true,
        });
        mesh.material = mat;
        matsRef.current.push(mat);
      }
    });
    return cloned;
  }, [gltf, colorTex]);

  /* ===== 每帧更新 ===== */
  useFrame((_, dt) => {
    const s = useStore.getState();
    timeRef.current += dt;
    const t = timeRef.current;

    // 计算生长进度
    let growth: number;
    if (s.autoPlay) {
      const cycle = s.growthDuration;
      if (s.loopMode === 'loop') {
        growth = (t % cycle) / cycle;
      } else if (s.loopMode === 'pingpong') {
        const phase = (t % (cycle * 2)) / cycle;
        growth = phase <= 1 ? phase : 2 - phase;
      } else {
        growth = Math.min(t / cycle, 1);
      }
    } else {
      growth = Math.max(0, Math.min(1, s.growthProgress));
    }

    // 用缓动让生长更自然（先快后慢）
    const easedGrowth = 1 - Math.pow(1 - growth, 2.2);

    // 更新所有材质的 uniform
    matsRef.current.forEach((mat) => {
      mat.uniforms.uGrowth.value = easedGrowth;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uWindStr.value = s.windStrength;
      mat.uniforms.uWindSpd.value = s.windSpeed;
    });
  });

  return (
    <group ref={groupRef} position={[0, -0.15, 0]}>
      <primitive object={scene} />
    </group>
  );
}