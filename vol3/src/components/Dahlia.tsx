'use client';
/**
 * ============================================================
 * 大丽花组件 (Dahlia.tsx)
 * ============================================================
 * 使用 instancedMesh 渲染 ~400 片花瓣
 * 花瓣排列：黄金螺旋，内层小而竖直，外层大而展开
 * 材质：自定义 ShaderMaterial，从上到下的发光波浪 + 菲涅尔边缘光
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ===== 花瓣配置 =====
const PETAL_COUNT = 420;            // 花瓣总数（球形需要更密集）
const GOLDEN_ANGLE = 2.39996323;    // 黄金角（弧度）≈ 137.508°
const BALL_RADIUS = 0.45;           // 球体半径（缩小！）

// ===== 花瓣几何体 =====
// 创建一个匙形花瓣（带卷曲），用于所有实例共享
function createPetalGeometry(): THREE.BufferGeometry {
  const segU = 16, segV = 8;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;

      // 匙形宽度轮廓
      const wP = Math.pow(Math.sin(u * Math.PI * 0.55), 0.5) *
                 Math.pow(1.0 - Math.pow(u, 2.0), 0.65);
      const halfW = (v - 0.5) * 0.5 * wP; // 基础宽度0.5，会被实例缩放

      // 沿 Z 轴生长
      const z = u * 1.0; // 基础长度1.0

      // 横向卷曲（花瓣不完全平）
      const curlAngle = 0.4 * (1.0 - u * 0.3);
      const vN = (v - 0.5) * 2.0;
      const curlR = 0.25 * wP;
      const cx = curlR * Math.sin(vN * curlAngle);
      const cy = curlR * (1.0 - Math.cos(vN * curlAngle));

      // 碗状微凹 + 纵向弧度
      const bowl = 0.03 * (1.0 - u * 0.4) * (1.0 - Math.pow(vN, 2));
      const arch = 0.025 * u * u;

      positions.push(cx, cy + bowl + arch, z);
      uvs.push(u, v);
    }
  }

  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i;
      indices.push(a, a + segU + 1, a + 1, a + 1, a + segU + 1, a + segU + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ===== 花瓣着色器 =====
const vertexShader = /* glsl */ `
  // 实例属性：花瓣在花朵中的高度位置 (0=最外层底部, 1=花心顶部)
  attribute float aHeight;
  // 实例属性：花瓣所在层级 (0=最外, 1=最内)
  attribute float aLayer;

  uniform float uTime;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying float vHeight;
  varying float vLayer;
  varying float vFresnel;

  void main() {
    vUv = uv;
    vHeight = aHeight;
    vLayer = aLayer;

    vec3 pos = position;

    // 微风呼吸
    float breathe = 0.006 * sin(uTime * 0.9 + aHeight * 3.0 + aLayer * 1.5);
    breathe += 0.004 * sin(uTime * 0.55 + uv.y * 3.14);
    pos += normal * breathe;

    // 微风横摆
    pos.x += 0.005 * sin(uTime * 0.3 + pos.z * 2.0) * uv.x;

    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    vWorldPos = (modelMatrix * instanceMatrix * vec4(pos, 1.0)).xyz;
    vWorldNormal = normalize((modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);

    // 菲涅尔
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float NdotV = max(dot(vWorldNormal, viewDir), 0.0);
    vFresnel = pow(1.0 - NdotV, 2.5);

    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying float vHeight;  // 0=外层底部, 1=花心顶部
  varying float vLayer;   // 0=外层, 1=内层
  varying float vFresnel;

  void main() {
    float u = vUv.x, v = vUv.y;
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);

    // ===== 参考图配色：外层蓝紫 → 内层粉白 =====
    vec3 core   = vec3(0.95, 0.88, 0.97);   // 粉白花心
    vec3 inner  = vec3(0.78, 0.70, 0.92);   // 淡粉紫
    vec3 mid    = vec3(0.52, 0.48, 0.80);   // 薰衣草
    vec3 outer  = vec3(0.34, 0.31, 0.65);   // 蓝紫
    vec3 outerD = vec3(0.24, 0.22, 0.52);   // 深蓝紫

    float lr = vLayer;
    vec3 base;
    if (lr < 0.15) base = mix(core, inner, lr / 0.15);
    else if (lr < 0.4) base = mix(inner, mid, (lr - 0.15) / 0.25);
    else if (lr < 0.7) base = mix(mid, outer, (lr - 0.4) / 0.3);
    else base = mix(outer, outerD, (lr - 0.7) / 0.3);

    base *= 0.9 + 0.1 * sin(u * 3.14159);

    // ===== 能量波浪：从上到下循环流动（强化！） =====
    float waveSpeed = 0.5;
    float wavePhase = vHeight - uTime * waveSpeed;
    float wave = sin(wavePhase * 6.2832) * 0.5 + 0.5;
    wave = pow(wave, 2.0); // 明亮的脉冲带

    // 能量光晕颜色 — 更亮
    vec3 energyColor = mix(vec3(0.75, 0.60, 0.98), core, vLayer * 0.5);
    base += energyColor * wave * 0.30; // 加强到 0.30

    // ===== 光照 =====
    vec3 L1 = normalize(vec3(0.2, 0.85, 0.4));
    vec3 L2 = normalize(vec3(-0.3, 0.3, -0.5));
    float wrap = 0.4;
    float d1 = (max(dot(N, L1), 0.0) + wrap) / (1.0 + wrap);
    float d2 = (max(dot(N, L2), 0.0) + wrap) / (1.0 + wrap);
    float amb = 0.28 + 0.12 * vLayer;
    vec3 col = base * (amb + d1 * 0.48 + d2 * 0.12);

    // 高光
    vec3 H = normalize(L1 + V);
    float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.15;
    col += vec3(0.6, 0.55, 0.85) * spec;

    // SSS 透光
    vec3 sD = normalize(L1 + V * 0.3);
    float sss = pow(max(dot(-N, sD), 0.0), 2.5) * 0.22;
    col += vec3(0.6, 0.48, 0.82) * sss * (1.0 - lr * 0.3);

    // 菲涅尔边缘光
    col += vec3(0.48, 0.44, 0.88) * vFresnel * 0.35;

    // 花心辉光
    float cg = pow(1.0 - lr, 2.0) * (1.0 - u * 0.5);
    float pulse = 0.02 * sin(uTime * 1.2) + 0.02;
    col += core * cg * (0.55 + pulse);

    // 能量波叠加发光
    col += energyColor * wave * 0.08 * (1.0 + vFresnel);

    // ===== Alpha =====
    float fU = smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.90, u);
    float fV = 1.0 - pow(abs(v - 0.5) * 2.0, 2.0) * 0.35;
    float a = fU * fV;
    a *= mix(0.88, 0.52, lr);
    a = max(a, vFresnel * 0.12);
    a = clamp(a, 0.0, 0.94);

    gl_FragColor = vec4(col, a);
  }
`;

// ===== React 组件 =====
export default function Dahlia() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  // 计算所有花瓣的变换矩阵和属性
  const { matrices, heights, layers } = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    const heights: number[] = [];
    const layers: number[] = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < PETAL_COUNT; i++) {
      const t = i / PETAL_COUNT; // 0 → 1（从花心顶部到外层底部）

      // 黄金螺旋分布角
      const theta = i * GOLDEN_ANGLE;

      // ===== 球面分布：花瓣紧密排列在球面上 =====
      // phi: 极角，t=0 时在顶部(phi=0)，t=1 时在底部(phi≈135°)
      // 使用 acos 分布让花瓣在球面上均匀
      const phi = Math.acos(1.0 - t * 1.5); // 0 → ~135° 覆盖大部分球面

      // 球面坐标 → 笛卡尔，球心在原点
      const R = BALL_RADIUS;
      const x = R * Math.sin(phi) * Math.cos(theta);
      const z = R * Math.sin(phi) * Math.sin(theta);
      const y = R * Math.cos(phi); // 顶部 y>0, 底部 y<0

      // 花瓣大小：顶部(花心)小，底部(外层)大
      const scale = 0.06 + t * 0.22; // 小花瓣，紧密排列

      // 大丽花花瓣卷曲程度：内层卷紧，外层微展
      // （通过缩放 Y 轴模拟卷曲效果）
      const scaleY = scale * (0.7 + t * 0.3);

      dummy.position.set(x, y, z);

      // 花瓣朝向：从球心向外指
      const outDir = new THREE.Vector3(x, y, z).normalize();
      const target = new THREE.Vector3().copy(dummy.position).add(outDir);
      dummy.lookAt(target);

      dummy.scale.set(scale, scaleY, scale);

      // 微小随机扰动让花瓣不那么机械
      dummy.rotation.x += Math.sin(i * 137.508) * 0.08;
      dummy.rotation.z += Math.cos(i * 73.0) * 0.06;
      dummy.rotation.y += Math.sin(i * 53.0) * 0.04;

      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());

      // aHeight: 1=顶部(花心), 0=底部(外层) — 用于波浪动画
      heights.push(1.0 - t);
      // aLayer: 0=内层(花心), 1=外层 — 用于颜色
      layers.push(t);
    }

    return { matrices, heights, layers };
  }, []);

  // 几何体
  const petalGeo = useMemo(() => createPetalGeometry(), []);

  // 材质
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
    });
  }, []);

  // 初始化 instancedMesh
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null!);

  // 每帧更新
  useFrame((_, delta) => {
    if (material) {
      material.uniforms.uTime.value += delta;
    }
  });

  return (
    <instancedMesh
      ref={(mesh) => {
        if (mesh && !meshRef.current) {
          meshRef.current = mesh;

          // 设置每个实例的矩阵
          for (let i = 0; i < PETAL_COUNT; i++) {
            mesh.setMatrixAt(i, matrices[i]);
          }
          mesh.instanceMatrix.needsUpdate = true;

          // 添加自定义实例属性 aHeight 和 aLayer
          const heightAttr = new THREE.InstancedBufferAttribute(
            new Float32Array(heights), 1
          );
          const layerAttr = new THREE.InstancedBufferAttribute(
            new Float32Array(layers), 1
          );
          mesh.geometry.setAttribute('aHeight', heightAttr);
          mesh.geometry.setAttribute('aLayer', layerAttr);
        }
      }}
      args={[petalGeo, material, PETAL_COUNT]}
      frustumCulled={false}
    />
  );
}