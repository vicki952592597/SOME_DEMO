'use client';
/**
 * VOL6 郁金香 — 纯代码复刻 GLB 模型
 * 程序化生成：花瓣 + 茎 + 叶片 + 花萼 + 生长动画
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/app/store';

/* ===== 花瓣几何体 ===== */
function createPetalGeometry(
  length: number, width: number, curl: number,
  tipBend: number, roundness: number, thickness: number
): THREE.BufferGeometry {
  const segU = 18, segV = 10;
  const pos: number[] = [], uvs: number[] = [], norms: number[] = [];
  const idx: number[] = [];

  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    const vn = (v - 0.5) * 2; // -1~1
    for (let i = 0; i <= segU; i++) {
      const u = i / segU; // 0=base, 1=tip

      // 宽度轮廓 — 郁金香花瓣是卵形，最宽在 u≈0.4
      const widthScale = Math.pow(Math.sin(u * Math.PI * 0.55), roundness)
                       * Math.pow(1.0 - Math.pow(u, 2.5), 0.5);
      const hw = width * widthScale * 0.5;

      // 横截面弧度（碗状）
      const curlAngle = curl * (1.0 - u * 0.4);
      const arcTheta = vn * curlAngle;
      const localX = hw * Math.sin(arcTheta) / Math.max(Math.sin(curlAngle * 0.5), 0.01) * Math.sin(curlAngle * 0.5);

      // 纵向弧度 + 花瓣向上弯曲
      const bendY = length * u;
      const bendBack = tipBend * Math.pow(u, 2.5); // 尖端外翻

      // 厚度
      const th = thickness * (1.0 - u * 0.6) * (1.0 - Math.abs(vn) * 0.4);

      const x = hw * vn;
      const y = bendY;
      const z = -curlAngle * hw * vn * vn * 0.5 + th + bendBack * 0.1;

      pos.push(x, y, z);
      uvs.push(u, v);
      // 简单法线（后面用 computeVertexNormals）
      norms.push(0, 0, 1);
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
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ===== 叶片几何体 ===== */
function createLeafGeometry(length: number, width: number): THREE.BufferGeometry {
  const segU = 16, segV = 8;
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [];

  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    const vn = (v - 0.5) * 2;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      // 叶片轮廓 — 尖头椭圆
      const ws = Math.pow(Math.sin(u * Math.PI), 0.6) * (1.0 - Math.pow(u, 3));
      const x = width * ws * vn * 0.5;
      const y = length * u;
      // 叶片中脉隆起
      const midRidge = 0.008 * (1.0 - Math.abs(vn)) * Math.sin(u * Math.PI);
      const z = midRidge;
      pos.push(x, y, z);
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

/* ===== 花瓣 Shader ===== */
const PETAL_VS = /* glsl */ `
  varying vec3 vWN, vWP;
  varying vec2 vUv;
  varying float vFr;
  uniform float uTime;
  uniform float uWindStr;
  uniform float uWindSpd;
  void main() {
    vUv = uv;
    vec3 p = position;
    // 微风
    p.x += sin(uTime * uWindSpd + p.y * 5.0) * 0.002 * uWindStr * uv.x;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWP = wp.xyz;
    vWN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec3 V = normalize(cameraPosition - wp.xyz);
    vFr = pow(1.0 - max(dot(vWN, V), 0.0), 3.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const PETAL_FS = /* glsl */ `
  uniform vec3 uColorInner, uColorOuter, uColorBase;
  uniform float uFresnelStr, uSSSStr, uSpecStr;
  uniform float uTime;
  varying vec3 vWN, vWP;
  varying vec2 vUv;
  varying float vFr;
  void main() {
    float u = vUv.x, v = vUv.y;
    vec3 N = normalize(vWN);
    vec3 V = normalize(cameraPosition - vWP);

    // 颜色梯度：基部白 → 中粉 → 外深粉
    vec3 col = mix(uColorBase, uColorInner, smoothstep(0.0, 0.3, u));
    col = mix(col, uColorOuter, smoothstep(0.3, 0.9, u));
    // 中脉白线
    float veinMask = exp(-pow((v - 0.5) * 8.0, 2.0)) * 0.15;
    col += vec3(1.0) * veinMask * (1.0 - u * 0.5);

    // 光照
    vec3 L = normalize(vec3(0.2, 0.9, 0.3));
    float wrap = 0.4;
    float diff = (max(dot(N, L), 0.0) + wrap) / (1.0 + wrap);
    col *= 0.3 + diff * 0.7;

    // 高光
    vec3 H = normalize(L + V);
    col += vec3(1.0, 0.95, 0.9) * pow(max(dot(N, H), 0.0), 60.0) * uSpecStr;

    // SSS
    float sss = pow(max(dot(-N, L), 0.0), 2.0);
    col += uColorInner * sss * uSSSStr;

    // Fresnel
    col += vec3(0.9, 0.85, 0.95) * vFr * uFresnelStr;

    // 边缘柔化 alpha
    float edgeAlpha = smoothstep(0.0, 0.04, u) * smoothstep(1.0, 0.92, u);
    float sideAlpha = 1.0 - pow(abs(v - 0.5) * 2.0, 3.0) * 0.3;
    float alpha = edgeAlpha * sideAlpha * 0.92;

    gl_FragColor = vec4(col, alpha);
  }
`;

/* ===== 叶片 Shader ===== */
const LEAF_VS = /* glsl */ `
  varying vec3 vWN, vWP;
  varying vec2 vUv;
  uniform float uTime, uWindStr, uWindSpd;
  uniform float uDroop, uCurl;
  void main() {
    vUv = uv;
    vec3 p = position;
    // 下垂
    p.z -= uDroop * uv.x * uv.x;
    // 纵向卷曲
    float cv = (uv.y - 0.5) * uCurl * uv.x;
    p.z += cv * cv * 0.5;
    // 风
    p.x += sin(uTime * uWindSpd * 0.7 + p.y * 3.0) * 0.004 * uWindStr;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWP = wp.xyz;
    vWN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const LEAF_FS = /* glsl */ `
  uniform vec3 uLeafColor;
  uniform float uTime;
  varying vec3 vWN, vWP;
  varying vec2 vUv;
  void main() {
    vec3 N = normalize(vWN);
    vec3 V = normalize(cameraPosition - vWP);
    vec3 L = normalize(vec3(0.2, 0.9, 0.3));

    vec3 col = uLeafColor;
    // 中脉亮线
    float vein = exp(-pow((vUv.y - 0.5) * 12.0, 2.0)) * 0.08;
    col += vec3(0.15, 0.25, 0.05) * vein;

    float diff = (max(dot(N, L), 0.0) + 0.3) / 1.3;
    col *= 0.25 + diff * 0.75;

    // SSS
    float sss = pow(max(dot(-N, L), 0.0), 2.5);
    col += vec3(0.1, 0.2, 0.02) * sss * 0.3;

    float alpha = smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x);
    alpha *= 1.0 - pow(abs(vUv.y - 0.5) * 2.0, 4.0) * 0.4;
    gl_FragColor = vec4(col, alpha * 0.95);
  }
`;

/* ===== 主组件 ===== */
export default function Tulip() {
  const groupRef = useRef<THREE.Group>(null!);
  const petalsRef = useRef<THREE.Group>(null!);
  const leavesRef = useRef<THREE.Group>(null!);
  const stemRef = useRef<THREE.Mesh>(null!);
  const timeRef = useRef(0);

  // 花瓣材质
  const petalMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: PETAL_VS,
    fragmentShader: PETAL_FS,
    uniforms: {
      uTime: { value: 0 },
      uColorInner: { value: new THREE.Color('#f8b4c8') },
      uColorOuter: { value: new THREE.Color('#e8708a') },
      uColorBase: { value: new THREE.Color('#f0e8d8') },
      uFresnelStr: { value: 0.3 },
      uSSSStr: { value: 0.25 },
      uSpecStr: { value: 0.15 },
      uWindStr: { value: 1.0 },
      uWindSpd: { value: 0.5 },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  // 叶片材质
  const leafMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: LEAF_VS,
    fragmentShader: LEAF_FS,
    uniforms: {
      uTime: { value: 0 },
      uLeafColor: { value: new THREE.Color('#2d5a1e') },
      uWindStr: { value: 1.0 },
      uWindSpd: { value: 0.5 },
      uDroop: { value: 0.3 },
      uCurl: { value: 0.2 },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  // 茎材质
  const stemMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#3a6b2a',
    roughness: 0.7,
    metalness: 0.0,
  }), []);

  /* ===== 每帧动画 ===== */
  useFrame((_, dt) => {
    const s = useStore.getState();
    timeRef.current += dt;
    const t = timeRef.current;

    // 更新 uniforms
    petalMat.uniforms.uTime.value = t;
    petalMat.uniforms.uColorInner.value.set(s.petalColorInner);
    petalMat.uniforms.uColorOuter.value.set(s.petalColorOuter);
    petalMat.uniforms.uColorBase.value.set(s.petalColorBase);
    petalMat.uniforms.uFresnelStr.value = s.fresnelStrength;
    petalMat.uniforms.uSSSStr.value = s.sssStrength;
    petalMat.uniforms.uSpecStr.value = s.specularStr;
    petalMat.uniforms.uWindStr.value = s.windStrength;
    petalMat.uniforms.uWindSpd.value = s.windSpeed;

    leafMat.uniforms.uTime.value = t;
    leafMat.uniforms.uLeafColor.value.set(s.leafColor);
    leafMat.uniforms.uWindStr.value = s.windStrength;
    leafMat.uniforms.uWindSpd.value = s.windSpeed;
    leafMat.uniforms.uDroop.value = s.leafDroop;
    leafMat.uniforms.uCurl.value = s.leafCurl;

    stemMat.color.set(s.stemColor);

    // 生长进度
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

    // 生长阶段
    const emerge = THREE.MathUtils.smoothstep(progress, 0.0, 0.12);
    const stemGrow = THREE.MathUtils.smoothstep(progress, 0.08, 0.45);
    const leafGrow = THREE.MathUtils.smoothstep(progress, 0.15, 0.55);
    const budForm = THREE.MathUtils.smoothstep(progress, 0.35, 0.60);
    const bloom = THREE.MathUtils.smoothstep(progress, 0.55, 0.95);

    // 茎高度
    if (stemRef.current) {
      const h = s.stemHeight * stemGrow;
      stemRef.current.scale.set(1, Math.max(0.01, stemGrow), 1);
      stemRef.current.position.y = h * 0.5;
    }

    // 花瓣组
    if (petalsRef.current) {
      const petalY = s.stemHeight * stemGrow;
      petalsRef.current.position.y = petalY;

      // 花瓣张开
      const totalPetals = s.petalCount * s.petalLayers;
      petalsRef.current.children.forEach((child, i) => {
        const layer = Math.floor(i / s.petalCount);
        const idx = i % s.petalCount;
        const layerRatio = layer / Math.max(s.petalLayers - 1, 1);

        // 内层先开，外层后开
        const layerDelay = layerRatio * 0.15;
        const localBloom = THREE.MathUtils.smoothstep(bloom, layerDelay, layerDelay + 0.7);

        // 缩放：从 0 到 1
        const sc = budForm * (0.3 + localBloom * 0.7);
        child.scale.setScalar(Math.max(0.001, sc));

        // 张开角度
        const baseAngle = s.petalOpenAngle * (1 + layerRatio * 0.3);
        const openAngle = baseAngle * localBloom;
        // 花瓣绕自身基部外倾
        child.rotation.x = -openAngle;

        // 可见性
        child.visible = budForm > 0.01;
      });
    }

    // 叶片组
    if (leavesRef.current) {
      leavesRef.current.children.forEach((child, i) => {
        const sc = leafGrow;
        child.scale.setScalar(Math.max(0.001, sc));
        child.visible = leafGrow > 0.01;
      });
    }

    // 整体可见性
    group.visible = emerge > 0.001;
    // 风摇摆
    group.rotation.z = Math.sin(t * s.windSpeed * 0.5) * 0.015 * s.windStrength * stemGrow;
    group.rotation.x = Math.cos(t * s.windSpeed * 0.3) * 0.008 * s.windStrength * stemGrow;
  });

  // 初始构建几何体
  const petalGeo = useMemo(() => {
    const s = useStore.getState();
    return createPetalGeometry(s.petalLength, s.petalWidth, s.petalCurl, s.petalTipBend, s.petalRoundness, s.petalThickness);
  }, []);

  const leafGeo = useMemo(() => {
    const s = useStore.getState();
    return createLeafGeometry(s.leafLength, s.leafWidth);
  }, []);

  // 花瓣初始分布
  const petalTransforms = useMemo(() => {
    const s = useStore.getState();
    const transforms: Array<{ rotY: number; rotX: number; layer: number }> = [];
    for (let layer = 0; layer < s.petalLayers; layer++) {
      const offset = layer * (Math.PI / s.petalCount); // 层间错开
      for (let i = 0; i < s.petalCount; i++) {
        const angle = (i / s.petalCount) * Math.PI * 2 + offset;
        transforms.push({ rotY: angle, rotX: 0, layer });
      }
    }
    return transforms;
  }, []);

  const s = useStore.getState();

  return (
    <group ref={groupRef} position={[0, -0.25, 0]}>
      {/* 茎 */}
      <mesh ref={stemRef} material={stemMat}>
        <cylinderGeometry args={[s.stemRadius * 0.8, s.stemRadius, s.stemHeight, 8, s.stemSegments]} />
      </mesh>

      {/* 花瓣组 */}
      <group ref={petalsRef}>
        {petalTransforms.map((tr, i) => (
          <mesh
            key={`petal-${i}`}
            geometry={petalGeo}
            material={petalMat}
            rotation={[0, tr.rotY, 0]}
          />
        ))}
      </group>

      {/* 叶片组 */}
      <group ref={leavesRef}>
        {Array.from({ length: s.leafCount }).map((_, i) => {
          const angle = (i / s.leafCount) * Math.PI * 2 + Math.PI * 0.25;
          const leafY = s.stemHeight * 0.15 + i * 0.04;
          return (
            <mesh
              key={`leaf-${i}`}
              geometry={leafGeo}
              material={leafMat}
              position={[0, leafY, 0]}
              rotation={[0.1, angle, -0.3]}
            />
          );
        })}
      </group>
    </group>
  );
}