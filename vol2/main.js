/**
 * 大丽花 VOL2 — Three.js
 * 真正的大丽花：密集花瓣层层卷曲形成圆球形
 * 花瓣波浪式绽放动画从内到外持续循环
 */
import * as THREE from 'three';

// ============================================================
// 大丽花配置
// ============================================================
// 真实大丽花特征：
// - 非常多的花瓣（100+片），紧密排列
// - 花瓣从花心向外层层包裹，形成圆球
// - 内层花瓣小且紧卷（几乎管状），外层逐渐展开变大
// - 每层花瓣数量递增
const CFG = {
  layers: [
    // 从最内层（花心）到最外层
    // { count, len, wid, radius（到球心距离）, curlAmount（卷曲程度，1=完全卷成管状） }
    { count: 5,  len: 0.12, wid: 0.06, radius: 0.05, curl: 0.95 },
    { count: 8,  len: 0.18, wid: 0.09, radius: 0.10, curl: 0.88 },
    { count: 10, len: 0.24, wid: 0.12, radius: 0.16, curl: 0.78 },
    { count: 12, len: 0.30, wid: 0.16, radius: 0.23, curl: 0.65 },
    { count: 14, len: 0.36, wid: 0.20, radius: 0.30, curl: 0.52 },
    { count: 16, len: 0.42, wid: 0.24, radius: 0.38, curl: 0.40 },
    { count: 18, len: 0.48, wid: 0.28, radius: 0.46, curl: 0.30 },
    { count: 20, len: 0.52, wid: 0.32, radius: 0.54, curl: 0.22 },
    { count: 20, len: 0.56, wid: 0.36, radius: 0.62, curl: 0.15 },
    { count: 18, len: 0.58, wid: 0.40, radius: 0.70, curl: 0.10 },
    { count: 16, len: 0.55, wid: 0.42, radius: 0.76, curl: 0.06 },
    { count: 14, len: 0.50, wid: 0.44, radius: 0.82, curl: 0.03 },
  ],
  stemRadius: 0.028,
  stemLength: 1.2,
  // 球心高度（花朵中心）
  ballCenterY: 0.45,
  ballRadius: 0.55,
  // 动画
  waveCycleDuration: 6.0,
  cameraDistance: 3.2,
  cameraPitch: 0.22,
  cameraRotateSpeed: 0.025,
};

// ============================================================
// Three.js 初始化
// ============================================================
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ============================================================
// 背景着色器
// ============================================================
const bgMat = new THREE.ShaderMaterial({
  depthWrite: false, depthTest: false,
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.9999, 1.0);
    }`,
  fragmentShader: `
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    void main() {
      vec2 uv = vUv;
      vec3 top = vec3(0.018, 0.018, 0.060);
      vec3 mid = vec3(0.050, 0.045, 0.190);
      vec3 bot = vec3(0.150, 0.120, 0.370);
      float t = uv.y;
      vec3 col = t > 0.5 ? mix(mid, top, smoothstep(0.5, 1.0, t))
                         : mix(bot, mid, smoothstep(0.0, 0.5, t));
      // 花朵辉光
      float cd = length(vec2(uv.x - 0.5, (uv.y - 0.52) * 1.5));
      col += vec3(0.06, 0.04, 0.14) * exp(-cd * cd * 5.0);
      // 星点
      vec2 sg = uv * vec2(85.0, 48.0);
      vec2 sc = floor(sg);
      float sr = hash(sc);
      if (sr > 0.965) {
        vec2 sp = fract(sg) - 0.5;
        vec2 so = (vec2(hash(sc + 1.0), hash(sc + 2.0)) - 0.5) * 0.5;
        float sd = length(sp - so);
        float star = smoothstep(0.025, 0.0, sd);
        float tw = sin(uTime * (1.5 + sr * 3.0) + sr * 6.28) * 0.5 + 0.5;
        col += vec3(0.5, 0.5, 0.7) * star * (tw * 0.4 + 0.6) * 0.35;
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
bgMesh.renderOrder = -1;
bgMesh.frustumCulled = false;
scene.add(bgMesh);

// ============================================================
// 花瓣几何体 — 带卷曲的匙形
// ============================================================
function createPetalGeo(len, wid, curlAmount, segU = 20, segV = 10) {
  const positions = [], uvs = [], indices = [];

  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;

      // 花瓣宽度轮廓：匙形（底部窄，中间宽，顶部圆润）
      const wP = Math.pow(Math.sin(u * Math.PI * 0.55), 0.5) *
                 Math.pow(1.0 - Math.pow(u, 2.2), 0.6);
      const halfW = (v - 0.5) * wid * wP;

      // 花瓣沿 Z 轴生长
      const z = u * len;

      // 横向卷曲：大丽花花瓣的关键特征
      // curl=1时花瓣卷成管状，curl=0时平展
      const curlAngle = curlAmount * Math.PI * 0.9 * (1.0 - u * 0.3);
      const vNorm = (v - 0.5) * 2.0; // -1 ~ 1
      const curlR = wid * wP * 0.5;
      const cx = curlR * Math.sin(vNorm * curlAngle);
      const cy = curlR * (1.0 - Math.cos(vNorm * curlAngle));

      // 微弱的纵向弧度
      const arch = 0.03 * u * u;

      // 叶脉凹凸
      const vc = v - 0.5;
      const mainVein = Math.exp(-vc * vc * 80) * 0.008 * u;
      const sideVein = 0.003 * Math.sin(u * 10) * Math.cos(vc * 16) * u;

      const x = cx;
      const y = cy + arch + mainVein + sideVein;

      positions.push(x, y, z);
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

// ============================================================
// 花瓣材质
// ============================================================
function createPetalMat(layerRatio) {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      uTime: { value: 0 },
      uLR: { value: layerRatio },
      uBloom: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uLR;
      varying vec3 vWN;
      varying vec3 vWP;
      varying vec2 vUv;
      varying float vFr;
      void main() {
        vUv = uv;
        vec3 pos = position;
        // 微风 + 呼吸
        float br = 0.005 * sin(uTime * 0.9 + uv.x * 2.0 + uLR * 1.5);
        br += 0.003 * sin(uTime * 0.6 + uv.y * 3.0);
        pos += normal * br;
        pos.x += 0.004 * sin(uTime * 0.3 + pos.z * 2.0) * uv.x;

        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vWP = wp.xyz;
        vWN = normalize(normalMatrix * normal);
        vec3 vd = normalize(cameraPosition - wp.xyz);
        vFr = pow(1.0 - max(dot(vWN, vd), 0.0), 2.5);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uLR;
      uniform float uBloom;
      varying vec3 vWN;
      varying vec3 vWP;
      varying vec2 vUv;
      varying float vFr;
      void main() {
        float u = vUv.x, v = vUv.y, lr = uLR;
        vec3 N = normalize(vWN);
        vec3 V = normalize(cameraPosition - vWP);

        // 配色：内层粉白 → 外层蓝紫
        // lr: 0=最内(花心), 1=最外
        vec3 core = vec3(0.95, 0.88, 0.97);
        vec3 inner = vec3(0.78, 0.70, 0.90);
        vec3 mid = vec3(0.55, 0.50, 0.80);
        vec3 outer = vec3(0.35, 0.32, 0.65);
        vec3 outerD = vec3(0.26, 0.24, 0.55);

        vec3 base;
        if (lr < 0.15) base = mix(core, inner, lr / 0.15);
        else if (lr < 0.4) base = mix(inner, mid, (lr - 0.15) / 0.25);
        else if (lr < 0.7) base = mix(mid, outer, (lr - 0.4) / 0.3);
        else base = mix(outer, outerD, (lr - 0.7) / 0.3);

        base *= 0.9 + 0.1 * sin(u * 3.14);

        // 光照
        vec3 L1 = normalize(vec3(0.2, 0.85, 0.4));
        vec3 L2 = normalize(vec3(-0.3, 0.3, -0.5));
        float w = 0.4;
        float d1 = (max(dot(N, L1), 0.0) + w) / (1.0 + w);
        float d2 = (max(dot(N, L2), 0.0) + w) / (1.0 + w);
        float amb = 0.28 + 0.12 * (1.0 - lr);
        vec3 col = base * (amb + d1 * 0.48 + d2 * 0.12);

        // 高光
        vec3 H = normalize(L1 + V);
        float sp = pow(max(dot(N, H), 0.0), 32.0) * 0.15;
        col += vec3(0.6, 0.55, 0.85) * sp;

        // SSS
        vec3 sD = normalize(L1 + V * 0.3);
        float ss = pow(max(dot(-N, sD), 0.0), 2.5) * 0.25;
        col += vec3(0.6, 0.48, 0.82) * ss * (1.0 - lr * 0.4);

        // 菲涅尔
        col += vec3(0.48, 0.44, 0.85) * vFr * 0.35;

        // 花心辉光
        float cg = (1.0 - lr) * (1.0 - lr) * (1.0 - u * 0.5);
        float pulse = 0.02 * sin(uTime * 1.2) + 0.02;
        col += core * cg * (0.6 + pulse);

        // Alpha
        float fU = smoothstep(0.0, 0.05, u) * smoothstep(1.0, 0.90, u);
        float fV = 1.0 - pow(abs(v - 0.5) * 2.0, 2.0) * 0.35;
        float a = fU * fV;
        a *= mix(0.88, 0.55, lr); // 内层更实，外层更透
        a = max(a, vFr * 0.12);
        a *= uBloom;
        a = clamp(a, 0.0, 0.95);

        gl_FragColor = vec4(col, a);
      }`,
  });
}

// ============================================================
// 构建大丽花球体
// ============================================================
const flowerGroup = new THREE.Group();
scene.add(flowerGroup);

const totalLayers = CFG.layers.length;
const petalData = [];

CFG.layers.forEach((layer, li) => {
  // layerRatio: 0=最内层(花心), 1=最外层
  const layerRatio = li / (totalLayers - 1);
  const geo = createPetalGeo(layer.len, layer.wid, layer.curl);

  for (let pi = 0; pi < layer.count; pi++) {
    const mat = createPetalMat(layerRatio);
    const mesh = new THREE.Mesh(geo, mat);

    // 微小随机变化
    const seed = Math.sin(pi * 137.508 + li * 42.0);
    const seed2 = Math.cos(pi * 73.0 + li * 31.0);
    const randScale = 1.0 + seed * 0.06;
    mesh.scale.set(randScale, randScale, randScale);

    // 计算花瓣在球面上的位置
    // 使用球坐标：
    // - phi (极角): 内层在顶部(小phi)，外层在底部(大phi)
    // - theta (方位角): 均匀分布，层间交错
    const phiBase = layerRatio * Math.PI * 0.52; // 0~93度 (不到半球)
    const phi = phiBase + seed2 * 0.03;

    const theta = (pi / layer.count) * Math.PI * 2 +
      (li % 2 === 0 ? 0 : Math.PI / layer.count) + seed * 0.03;

    // 球面上的点
    const r = layer.radius;
    const sx = r * Math.sin(phi) * Math.cos(theta);
    const sy = r * Math.cos(phi); // 向上
    const sz = r * Math.sin(phi) * Math.sin(theta);

    // 创建层级结构让花瓣从球心向外指向
    const pivot = new THREE.Group();
    pivot.position.set(sx, sy + CFG.ballCenterY, sz);

    // 花瓣指向从球心到表面的方向
    // lookAt 让花瓣 Z 轴指向外
    const outDir = new THREE.Vector3(sx, sy, sz).normalize();
    const target = new THREE.Vector3().copy(pivot.position).add(outDir);
    pivot.lookAt(target);

    pivot.add(mesh);
    flowerGroup.add(pivot);

    petalData.push({
      mesh, mat, pivot,
      layerIndex: li,
      layerRatio,
      phi,
      theta,
      baseRadius: r,
    });
  }
});

// 花茎
const stemGeo = new THREE.CylinderGeometry(
  CFG.stemRadius * 0.6, CFG.stemRadius * 1.1, CFG.stemLength, 8, 8
);
const stemMat = new THREE.ShaderMaterial({
  uniforms: {},
  vertexShader: `
    varying vec3 vN;
    void main() {
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    varying vec3 vN;
    void main() {
      vec3 col = vec3(0.32, 0.28, 0.42);
      float l = max(dot(vN, normalize(vec3(0.2, 0.8, 0.4))), 0.0);
      col *= 0.35 + l * 0.55;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const stem = new THREE.Mesh(stemGeo, stemMat);
stem.position.y = -CFG.stemLength / 2 + 0.05;
flowerGroup.add(stem);

// ============================================================
// 动画循环
// ============================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // 相机
  const ca = t * CFG.cameraRotateSpeed;
  const cd = CFG.cameraDistance;
  const cp = CFG.cameraPitch;
  camera.position.set(
    Math.sin(ca) * cd * Math.cos(cp),
    Math.sin(cp) * cd + CFG.ballCenterY,
    Math.cos(ca) * cd * Math.cos(cp)
  );
  camera.lookAt(0, CFG.ballCenterY * 0.8, 0);

  // 初始展开
  const initBloom = Math.min(t / 3.5, 1.0);
  const easeBloom = 1.0 - Math.pow(1.0 - initBloom, 3.0);

  // 波浪动画：从内到外传播的波
  // 每层有相位延迟，形成涟漪效果
  const waveT = t / CFG.waveCycleDuration;

  petalData.forEach((pd) => {
    const { mat, pivot, layerRatio, baseRadius } = pd;

    // 波浪：从内(layerRatio=0)向外(layerRatio=1)传播
    // layerRatio越大，相位越延迟
    const phase = layerRatio * 1.2; // 延迟系数
    const wave = Math.sin((waveT - phase) * Math.PI * 2);

    // 波浪影响：
    // 1. 花瓣微微向外鼓起再收回（径向脉动）
    const radiusPulse = wave * 0.025 * (0.5 + layerRatio * 0.5);

    // 2. 花瓣展开角度微变（外层幅度更大）
    const anglePulse = wave * 0.06 * layerRatio;

    // 应用到位置（沿径向方向脉动）
    const outDir = new THREE.Vector3(
      pivot.position.x,
      pivot.position.y - CFG.ballCenterY,
      pivot.position.z
    ).normalize();

    const effectiveRadius = baseRadius + radiusPulse;
    const effectivePhi = pd.phi + anglePulse;

    const sx = effectiveRadius * Math.sin(effectivePhi) * Math.cos(pd.theta);
    const sy = effectiveRadius * Math.cos(effectivePhi);
    const sz = effectiveRadius * Math.sin(effectivePhi) * Math.sin(pd.theta);

    // 绽放缩放
    const bloomScale = easeBloom;
    pivot.position.set(
      sx * bloomScale,
      sy * bloomScale + CFG.ballCenterY,
      sz * bloomScale
    );

    // 重新指向外方向
    const newOut = new THREE.Vector3(sx, sy, sz).normalize();
    const target = new THREE.Vector3().copy(pivot.position).add(newOut);
    pivot.lookAt(target);

    // 更新 uniforms
    mat.uniforms.uTime.value = t;
    mat.uniforms.uBloom.value = easeBloom;
  });

  bgMat.uniforms.uTime.value = t;
  renderer.render(scene, camera);
}

animate();
console.log('🌺 大丽花 VOL2 球形版 启动！');