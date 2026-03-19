'use client';
/**
 * 大丽花 — 层级式宽大花瓣 + 循环生长动画
 * 花瓣一圈一圈从内到外排列，配色一比一参考图
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/store';

/* ===== 层级配置：每层一圈花瓣 ===== */
const LAYERS = [
  { n:5,  len:0.22, wid:0.16, open:0.22, curl:0.7  },
  { n:7,  len:0.32, wid:0.22, open:0.42, curl:0.55 },
  { n:9,  len:0.42, wid:0.30, open:0.62, curl:0.40 },
  { n:11, len:0.52, wid:0.38, open:0.82, curl:0.28 },
  { n:13, len:0.60, wid:0.44, open:1.02, curl:0.18 },
  { n:14, len:0.66, wid:0.48, open:1.20, curl:0.10 },
  { n:15, len:0.70, wid:0.52, open:1.38, curl:0.05 },
];
const NL = LAYERS.length;
const TOTAL = LAYERS.reduce((s, l) => s + l.n, 0); // 74 片

/* ===== 花瓣几何体（宽大匙形） ===== */
function mkGeo(): THREE.BufferGeometry {
  const sU = 18, sV = 10;
  const p: number[] = [], uv: number[] = [], ix: number[] = [];
  for (let j = 0; j <= sV; j++) {
    const v = j / sV;
    for (let i = 0; i <= sU; i++) {
      const u = i / sU;
      const wp = Math.pow(Math.sin(u * Math.PI * 0.48), 0.42) *
                 Math.pow(1 - Math.pow(u, 1.7), 0.52);
      const vn = (v - 0.5) * 2;
      const ca = 0.45 * (1 - u * 0.25);
      const cr = 0.28 * wp;
      const cx = cr * Math.sin(vn * ca);
      const cy = cr * (1 - Math.cos(vn * ca));
      const bowl = 0.04 * (1 - u * 0.4) * (1 - vn * vn);
      const arch = 0.03 * u * u;
      p.push(cx, cy + bowl + arch, u);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < sV; j++)
    for (let i = 0; i < sU; i++) {
      const a = j * (sU + 1) + i;
      ix.push(a, a + sU + 1, a + 1, a + 1, a + sU + 1, a + sU + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  g.computeVertexNormals();
  return g;
}

/* ===== Vertex Shader ===== */
const VS = /* glsl */ `
  attribute float aHeight;
  attribute float aLayer;
  uniform float uTime;
  varying vec3 vWN, vWP;
  varying vec2 vUv;
  varying float vH, vL, vFr;
  void main() {
    vUv = uv; vH = aHeight; vL = aLayer;
    vec3 pos = position;
    pos += normal * (0.004 * sin(uTime * 0.8 + aHeight * 3.0 + aLayer * 1.5));
    pos.x += 0.003 * sin(uTime * 0.3 + pos.z * 2.0) * uv.x;
    vec4 wp = modelMatrix * instanceMatrix * vec4(pos, 1.0);
    vWP = wp.xyz;
    vWN = normalize((modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);
    vec3 vd = normalize(cameraPosition - wp.xyz);
    vFr = pow(1.0 - max(dot(vWN, vd), 0.0), 2.5);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

/* ===== Fragment Shader — 参考图配色一比一 ===== */
const FS = /* glsl */ `
  uniform float uTime;
  varying vec3 vWN, vWP;
  varying vec2 vUv;
  varying float vH, vL, vFr;
  void main() {
    float u = vUv.x, v = vUv.y, lr = vL;
    vec3 N = normalize(vWN);
    vec3 V = normalize(cameraPosition - vWP);

    // 参考图配色：花心粉白 → 外层冷蓝紫
    vec3 c0 = vec3(0.94, 0.86, 0.97);
    vec3 c1 = vec3(0.74, 0.64, 0.90);
    vec3 c2 = vec3(0.50, 0.45, 0.78);
    vec3 c3 = vec3(0.34, 0.31, 0.64);
    vec3 c4 = vec3(0.23, 0.21, 0.50);

    vec3 base;
    if (lr < 0.18) base = mix(c0, c1, lr / 0.18);
    else if (lr < 0.42) base = mix(c1, c2, (lr - 0.18) / 0.24);
    else if (lr < 0.68) base = mix(c2, c3, (lr - 0.42) / 0.26);
    else base = mix(c3, c4, (lr - 0.68) / 0.32);

    base *= 0.92 + 0.08 * sin(u * 3.14);

    // 能量波浪从上到下
    float wp2 = vH - uTime * 0.4;
    float wave = pow(sin(wp2 * 6.2832) * 0.5 + 0.5, 2.5);
    vec3 eC = mix(vec3(0.65, 0.50, 0.92), c0, lr * 0.4);
    base += eC * wave * 0.22;

    // 光照
    vec3 L1 = normalize(vec3(0.15, 0.85, 0.35));
    vec3 L2 = normalize(vec3(-0.3, 0.3, -0.5));
    float w = 0.42;
    float d1 = (max(dot(N, L1), 0.0) + w) / (1.0 + w);
    float d2 = (max(dot(N, L2), 0.0) + w) / (1.0 + w);
    vec3 col = base * (0.26 + 0.10 * (1.0 - lr) + d1 * 0.50 + d2 * 0.12);

    // 高光
    vec3 H = normalize(L1 + V);
    col += vec3(0.58, 0.52, 0.85) * pow(max(dot(N, H), 0.0), 36.0) * 0.14;

    // SSS
    vec3 sD = normalize(L1 + V * 0.3);
    col += vec3(0.58, 0.45, 0.80) * pow(max(dot(-N, sD), 0.0), 2.5) * 0.25 * (1.0 - lr * 0.3);

    // 菲涅尔
    col += vec3(0.45, 0.40, 0.85) * vFr * 0.38;

    // 花心辉光
    col += c0 * pow(1.0 - lr, 2.5) * (1.0 - u * 0.5) * (0.55 + 0.03 * sin(uTime * 1.2));

    // 波浪叠加
    col += eC * wave * 0.06 * (1.0 + vFr);

    // Alpha
    float fU = smoothstep(0.0, 0.05, u) * smoothstep(1.0, 0.88, u);
    float fV = 1.0 - pow(abs(v - 0.5) * 2.0, 2.2) * 0.4;
    float a = fU * fV;
    a *= mix(0.85, 0.50, lr);
    a = max(a, vFr * 0.12);
    a = clamp(a, 0.0, 0.94);

    gl_FragColor = vec4(col, a);
  }
`;

/* ===== 组件 ===== */
export default function Dahlia() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  /* 初始矩阵 + 属性 */
  const { initMatrices, heights, layerRatios } = useMemo(() => {
    const ms: THREE.Matrix4[] = [];
    const hs: number[] = [];
    const ls: number[] = [];
    const d = new THREE.Object3D();
    let idx = 0;
    LAYERS.forEach((L, li) => {
      const lr = li / (NL - 1);
      for (let pi = 0; pi < L.n; pi++) {
        const th = (pi / L.n) * Math.PI * 2 + (li % 2 ? Math.PI / L.n : 0);
        const s1 = Math.sin(idx * 137.508 + li * 42);
        const s2 = Math.cos(idx * 73 + li * 31);
        const R = 0.02 + lr * 0.14;
        const phi = L.open + s2 * 0.04;
        const x = R * Math.sin(phi) * Math.cos(th + s1 * 0.05);
        const z = R * Math.sin(phi) * Math.sin(th + s1 * 0.05);
        const y = R * Math.cos(phi);
        d.position.set(x, y, z);
        const out = new THREE.Vector3(x, y, z).normalize();
        d.lookAt(d.position.clone().add(out));
        const sl = L.len * (1 + s1 * 0.06);
        const sw = L.wid * (1 + s2 * 0.05);
        d.scale.set(sw, sw * 0.85, sl);
        d.rotation.x += s1 * 0.05;
        d.rotation.z += s2 * 0.04;
        d.updateMatrix();
        ms.push(d.matrix.clone());
        hs.push(1 - lr);
        ls.push(lr);
        idx++;
      }
    });
    return { initMatrices: ms, heights: hs, layerRatios: ls };
  }, []);

  const geo = useMemo(() => mkGeo(), []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS,
    uniforms: {
      uTime: { value: 0 },
      uBreathAmp: { value: 0.004 },
      uEnergySpeed: { value: 0.4 },
      uEnergyStr: { value: 0.22 },
      uFresnelStr: { value: 0.38 },
      uCoreGlow: { value: 0.55 },
    },
    transparent: true, side: THREE.DoubleSide,
    depthWrite: false, depthTest: true,
  }), []);

  /* ===== 每帧动画：循环生长 ===== */
  useFrame((_, dt) => {
    const s = useStore.getState();
    mat.uniforms.uTime.value += dt;
    mat.uniforms.uBreathAmp.value = s.breatheAmp;
    mat.uniforms.uEnergySpeed.value = s.energyWaveSpeed;
    mat.uniforms.uEnergyStr.value = s.energyWaveStrength;
    mat.uniforms.uFresnelStr.value = s.fresnelStrength;
    mat.uniforms.uCoreGlow.value = s.coreGlow;
    const t = mat.uniforms.uTime.value;
    const mesh = meshRef.current;
    if (!mesh) return;

    const cycle = s.cycleDuration;
    const phase = (t % cycle) / cycle;
    let idx = 0;

    LAYERS.forEach((L, li) => {
      const lr = li / (NL - 1);
      // 波浪从内到外传播
      const lp = phase - lr * 0.35;
      const bloomWave = Math.sin(lp * Math.PI * 2) * 0.14;
      const radPulse = Math.sin(lp * Math.PI * 2) * 0.025;

      for (let pi = 0; pi < L.n; pi++) {
        const s1 = Math.sin(idx * 137.508 + li * 42);
        const s2 = Math.cos(idx * 73 + li * 31);
        const th = (pi / L.n) * Math.PI * 2 + (li % 2 ? Math.PI / L.n : 0) + s1 * 0.05;
        const R = 0.02 + lr * 0.14 + radPulse;
        const phi = L.open + s2 * 0.04 + bloomWave;
        const x = R * Math.sin(phi) * Math.cos(th);
        const z = R * Math.sin(phi) * Math.sin(th);
        const y = R * Math.cos(phi);

        dummy.position.set(x, y, z);
        const out = new THREE.Vector3(x, y, z).normalize();
        dummy.lookAt(dummy.position.clone().add(out));
        const sl = L.len * (1 + s1 * 0.06);
        const sw = L.wid * (1 + s2 * 0.05);
        dummy.scale.set(sw, sw * 0.85, sl);
        dummy.rotation.x += s1 * 0.05;
        dummy.rotation.z += s2 * 0.04;
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={(m) => {
        if (m && !meshRef.current) {
          meshRef.current = m;
          for (let i = 0; i < TOTAL; i++) m.setMatrixAt(i, initMatrices[i]);
          m.instanceMatrix.needsUpdate = true;
          m.geometry.setAttribute('aHeight',
            new THREE.InstancedBufferAttribute(new Float32Array(heights), 1));
          m.geometry.setAttribute('aLayer',
            new THREE.InstancedBufferAttribute(new Float32Array(layerRatios), 1));
        }
      }}
      args={[geo, mat, TOTAL]}
      frustumCulled={false}
    />
  );
}