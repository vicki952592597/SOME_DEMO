'use client';
/**
 * VOL4 大丽花 — 宽大舒展花瓣 + 参考图一比一造型
 * 花瓣宽圆、外层大角度展开、半透明透光、层次分明
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/store';

/* ===== 层级配置 ===== */
const LAYERS = [
  // n=每层花瓣数, len=长度, wid=宽度, open=张开角(rad), tilt=外倾
  { n: 5,  len: 0.10, wid: 0.09, open: 0.15 },   // 花心 - 几乎直立
  { n: 7,  len: 0.18, wid: 0.15, open: 0.35 },
  { n: 9,  len: 0.28, wid: 0.24, open: 0.58 },
  { n: 11, len: 0.38, wid: 0.33, open: 0.82 },
  { n: 13, len: 0.48, wid: 0.42, open: 1.05 },
  { n: 14, len: 0.56, wid: 0.50, open: 1.25 },   // 中外层 - 大幅展开
  { n: 15, len: 0.62, wid: 0.56, open: 1.42 },
  { n: 15, len: 0.66, wid: 0.60, open: 1.55 },   // 最外层 - 几乎水平
];
const NL = LAYERS.length;
const TOTAL = LAYERS.reduce((s, l) => s + l.n, 0);

/* ===== 花瓣几何体 — 宽圆椭圆形，边缘柔和 ===== */
function mkPetalGeo(): THREE.BufferGeometry {
  const segU = 20, segV = 12; // 沿花瓣长度 / 宽度
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [];

  for (let j = 0; j <= segV; j++) {
    const v = j / segV;           // 0~1 横向
    const vn = (v - 0.5) * 2;    // -1~1 中心化
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;         // 0=基部 1=尖端

      // 宽度轮廓：宽圆椭圆 (最宽处在 u=0.35 左右)
      const widthProfile = Math.pow(Math.sin(u * Math.PI * 0.52), 0.55)
                         * Math.pow(1.0 - Math.pow(u, 2.2), 0.45);

      // 横截面弧度 — 花瓣不是平的，有碗状弧度
      const curlAngle = 0.55 * (1.0 - u * 0.3);  // 基部弧度大，尖端减小
      const halfW = widthProfile * 0.5;
      const arcR = halfW / Math.max(Math.sin(curlAngle * 0.5), 0.01);
      const theta = vn * curlAngle;
      const localX = arcR * Math.sin(theta);
      const localY = arcR * (1.0 - Math.cos(theta));

      // 纵向拱起 — 花瓣中间略微隆起
      const archY = 0.04 * u * (1.0 - u) * (1.0 - vn * vn * 0.6);
      // 尖端微微向上翘
      const tipCurl = 0.025 * Math.pow(u, 3.0) * (1.0 - Math.abs(vn) * 0.5);

      pos.push(localX, localY + archY + tipCurl, u);
      uvs.push(u, v);
    }
  }

  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i;
      idx.push(a, a + segU + 1, a + 1);
      idx.push(a + 1, a + segU + 1, a + segU + 2);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ===== Vertex Shader ===== */
const VS = /* glsl */ `
  attribute float aLayer;
  uniform float uTime;
  uniform float uBreathAmp;
  varying vec3 vWN, vWP;
  varying vec2 vUv;
  varying float vL, vFr;

  void main() {
    vUv = uv;
    vL = aLayer;
    vec3 pos = position;

    // 微风呼吸
    pos += normal * (uBreathAmp * sin(uTime * 0.8 + aLayer * 4.0 + position.z * 3.0));
    pos.x += 0.003 * sin(uTime * 0.25 + pos.z * 2.5) * uv.x;

    vec4 wp = modelMatrix * instanceMatrix * vec4(pos, 1.0);
    vWP = wp.xyz;
    vWN = normalize((modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);
    vec3 vd = normalize(cameraPosition - wp.xyz);
    vFr = pow(1.0 - max(dot(vWN, vd), 0.0), 2.8);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

/* ===== Fragment Shader — 所有光效参数由 uniform 控制 ===== */
const FS = /* glsl */ `
  uniform float uTime;
  uniform float uEnergySpeed;
  uniform float uEnergyStr;
  uniform float uFresnelStr;
  uniform float uCoreGlow;
  uniform float uSpecularStr;
  uniform float uSSSStr;

  varying vec3 vWN, vWP;
  varying vec2 vUv;
  varying float vL, vFr;

  void main() {
    float u = vUv.x, v = vUv.y, lr = vL;
    vec3 N = normalize(vWN);
    vec3 V = normalize(cameraPosition - vWP);

    // 配色梯度：花心粉白 → 外层冷蓝紫
    vec3 c0 = vec3(0.95, 0.88, 0.98);   // 花心粉白
    vec3 c1 = vec3(0.78, 0.68, 0.93);   // 内层淡紫
    vec3 c2 = vec3(0.58, 0.52, 0.85);   // 中层蓝紫
    vec3 c3 = vec3(0.42, 0.38, 0.72);   // 中外层
    vec3 c4 = vec3(0.30, 0.28, 0.60);   // 外层深紫

    vec3 base;
    if (lr < 0.15) base = mix(c0, c1, lr / 0.15);
    else if (lr < 0.35) base = mix(c1, c2, (lr - 0.15) / 0.20);
    else if (lr < 0.60) base = mix(c2, c3, (lr - 0.35) / 0.25);
    else base = mix(c3, c4, (lr - 0.60) / 0.40);

    // 花瓣内部颜色变化（基部略深）
    base *= 0.90 + 0.10 * sin(u * 3.14);

    // 能量波浪（从内到外流动）
    float wp2 = (1.0 - lr) - uTime * uEnergySpeed;
    float wave = pow(sin(wp2 * 6.2832) * 0.5 + 0.5, 2.8);
    vec3 eC = mix(vec3(0.70, 0.55, 0.95), c0, lr * 0.5);
    base += eC * wave * uEnergyStr;

    // 光照
    vec3 L1 = normalize(vec3(0.15, 0.85, 0.35));
    vec3 L2 = normalize(vec3(-0.3, 0.3, -0.5));
    float wrap = 0.45;
    float d1 = (max(dot(N, L1), 0.0) + wrap) / (1.0 + wrap);
    float d2 = (max(dot(N, L2), 0.0) + wrap) / (1.0 + wrap);
    vec3 col = base * (0.28 + 0.10 * (1.0 - lr) + d1 * 0.48 + d2 * 0.12);

    // 高光
    vec3 H = normalize(L1 + V);
    col += vec3(0.60, 0.55, 0.88) * pow(max(dot(N, H), 0.0), 40.0) * uSpecularStr;

    // SSS 次表面散射
    vec3 sD = normalize(L1 + V * 0.3);
    float sss = pow(max(dot(-N, sD), 0.0), 2.5);
    col += vec3(0.62, 0.50, 0.85) * sss * uSSSStr * (1.0 - lr * 0.3);

    // 菲涅尔边缘光
    col += vec3(0.50, 0.45, 0.90) * vFr * uFresnelStr;

    // 花心辉光
    col += c0 * pow(1.0 - lr, 3.0) * (1.0 - u * 0.5) * uCoreGlow * (1.0 + 0.05 * sin(uTime * 1.2));

    // 波浪额外叠加
    col += eC * wave * 0.04 * (1.0 + vFr);

    // Alpha — 花瓣半透明
    float fU = smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.85, u);
    float fV = 1.0 - pow(abs(v - 0.5) * 2.0, 2.5) * 0.35;
    float a = fU * fV;
    // 外层更透明，整体偏半透明
    a *= mix(0.88, 0.42, lr);
    a = max(a, vFr * 0.10);
    a = clamp(a, 0.0, 0.92);

    gl_FragColor = vec4(col, a);
  }
`;

/* ===== 组件 ===== */
export default function Dahlia() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  /* 预计算初始矩阵 + layer 属性 */
  const { initMatrices, layerRatios } = useMemo(() => {
    const ms: THREE.Matrix4[] = [];
    const ls: number[] = [];
    const d = new THREE.Object3D();
    let idx = 0;
    LAYERS.forEach((L, li) => {
      const lr = li / (NL - 1);
      for (let pi = 0; pi < L.n; pi++) {
        const th = (pi / L.n) * Math.PI * 2 + (li % 2 ? Math.PI / L.n : 0);
        const jitter1 = Math.sin(idx * 137.508 + li * 42) * 0.06;
        const jitter2 = Math.cos(idx * 73 + li * 31) * 0.04;
        const R = 0.02 + lr * 0.14;
        const phi = L.open + jitter2;
        const x = R * Math.sin(phi) * Math.cos(th + jitter1);
        const z = R * Math.sin(phi) * Math.sin(th + jitter1);
        const y = R * Math.cos(phi);
        d.position.set(x, y, z);
        const out = new THREE.Vector3(x, y, z).normalize();
        d.lookAt(d.position.clone().add(out));
        d.scale.set(L.wid, L.wid * 0.85, L.len);
        d.rotation.x += jitter1 * 0.3;
        d.rotation.z += jitter2 * 0.3;
        d.updateMatrix();
        ms.push(d.matrix.clone());
        ls.push(lr);
        idx++;
      }
    });
    return { initMatrices: ms, layerRatios: ls };
  }, []);

  const geo = useMemo(() => mkPetalGeo(), []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VS,
    fragmentShader: FS,
    uniforms: {
      uTime:        { value: 0 },
      uBreathAmp:   { value: 0.004 },
      uEnergySpeed: { value: 0.4 },
      uEnergyStr:   { value: 0.22 },
      uFresnelStr:  { value: 0.38 },
      uCoreGlow:    { value: 0.55 },
      uSpecularStr: { value: 0.14 },
      uSSSStr:      { value: 0.25 },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
  }), []);

  /* ===== 每帧动画 ===== */
  useFrame((_, dt) => {
    const s = useStore.getState();
    const u = mat.uniforms;
    u.uTime.value += dt;
    u.uBreathAmp.value   = s.breatheAmp;
    u.uEnergySpeed.value = s.energyWaveSpeed;
    u.uEnergyStr.value   = s.energyWaveStrength;
    u.uFresnelStr.value  = s.fresnelStrength;
    u.uCoreGlow.value    = s.coreGlow;
    u.uSpecularStr.value = s.specularStr;
    u.uSSSStr.value      = s.sssStrength;

    const mesh = meshRef.current;
    if (!mesh) return;

    const t = u.uTime.value;
    const cycle = s.cycleDuration;
    const phase = (t % cycle) / cycle;
    const pScale = s.petalScale;
    const pLen = s.petalLength;
    const pWid = s.petalWidth;
    const bRadius = s.ballRadius;
    const oaScale = s.openAngleScale;
    const waveAmp = s.bloomWaveAmp;
    const rPulse = s.radialPulse;

    let idx = 0;
    LAYERS.forEach((L, li) => {
      const lr = li / (NL - 1);
      const lp = phase - lr * 0.35;
      const bloomWave = Math.sin(lp * Math.PI * 2) * waveAmp;
      const radPulse = Math.sin(lp * Math.PI * 2) * rPulse;

      for (let pi = 0; pi < L.n; pi++) {
        const j1 = Math.sin(idx * 137.508 + li * 42);
        const j2 = Math.cos(idx * 73 + li * 31);
        const th = (pi / L.n) * Math.PI * 2 + (li % 2 ? Math.PI / L.n : 0) + j1 * 0.06;
        const R = (0.02 + lr * bRadius + radPulse) * pScale;
        const phi = (L.open * oaScale + j2 * 0.04 + bloomWave);
        const x = R * Math.sin(phi) * Math.cos(th);
        const z = R * Math.sin(phi) * Math.sin(th);
        const y = R * Math.cos(phi);

        dummy.position.set(x, y, z);
        const out = new THREE.Vector3(x, y, z).normalize();
        dummy.lookAt(dummy.position.clone().add(out));

        const sl = L.len * pLen * pScale * (1 + j1 * 0.06);
        const sw = L.wid * pWid * pScale * (1 + j2 * 0.05);
        dummy.scale.set(sw, sw * 0.85, sl);
        dummy.rotation.x += j1 * 0.04;
        dummy.rotation.z += j2 * 0.03;
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
          m.geometry.setAttribute('aLayer',
            new THREE.InstancedBufferAttribute(new Float32Array(layerRatios), 1));
        }
      }}
      args={[geo, mat, TOTAL]}
      frustumCulled={false}
    />
  );
}