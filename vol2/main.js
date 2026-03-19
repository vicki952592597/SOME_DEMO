/**
 * 大丽花 VOL2 — Three.js 实现
 * 参考图一比一复刻：蓝紫色大丽花 + 粉白花心 + 深蓝渐变背景
 * 花瓣从上到下循环绽放动画
 */
import * as THREE from 'three';

// ============================================================
// 配置
// ============================================================
const CFG = {
  // 花瓣层配置 [数量, 长度, 宽度, 展开角(度), y偏移]
  // 从最外层到最内层
  layers: [
    { count: 14, len: 1.15, wid: 0.52, angle: 82, y: -0.06 },
    { count: 13, len: 1.02, wid: 0.48, angle: 72, y: 0.0 },
    { count: 12, len: 0.88, wid: 0.44, angle: 60, y: 0.06 },
    { count: 11, len: 0.72, wid: 0.40, angle: 47, y: 0.12 },
    { count: 10, len: 0.55, wid: 0.34, angle: 33, y: 0.18 },
    { count: 8,  len: 0.38, wid: 0.26, angle: 20, y: 0.24 },
    { count: 6,  len: 0.22, wid: 0.18, angle: 10, y: 0.30 },
  ],
  stemRadius: 0.025,
  stemLength: 1.0,
  bloomCycleDuration: 8.0, // 一个绽放周期的秒数
  cameraDistance: 2.8,
  cameraPitch: 0.28, // 俯视角（弧度）
  cameraRotateSpeed: 0.03,
};

// ============================================================
// 初始化 Three.js
// ============================================================
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.sortObjects = true;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
// 背景：全屏渐变 + 星点
// ============================================================
function createBackground() {
  const bgMat = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.9999, 1.0);
      }
    `,
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
        // 参考图渐变：顶部深蓝黑 → 中部深靛蓝 → 底部蓝紫
        vec3 top = vec3(0.020, 0.020, 0.065);
        vec3 mid = vec3(0.055, 0.048, 0.195);
        vec3 bot = vec3(0.155, 0.125, 0.380);

        float t = uv.y; // 0=bottom, 1=top
        vec3 col;
        if (t > 0.55) {
          col = mix(mid, top, smoothstep(0.55, 1.0, t));
        } else {
          col = mix(bot, mid, smoothstep(0.0, 0.55, t));
        }

        // 花朵区域微弱辉光
        float cd = length(vec2(uv.x - 0.5, (uv.y - 0.48) * 1.4));
        col += vec3(0.08, 0.06, 0.18) * exp(-cd * cd * 6.0);

        // 星点
        vec2 sg = uv * vec2(90.0, 50.0);
        vec2 sc = floor(sg);
        float sr = hash(sc);
        if (sr > 0.96) {
          vec2 sp = fract(sg) - 0.5;
          vec2 so = (vec2(hash(sc + 1.0), hash(sc + 2.0)) - 0.5) * 0.5;
          float sd = length(sp - so);
          float star = smoothstep(0.03, 0.0, sd);
          float tw = sin(uTime * (1.5 + sr * 3.0) + sr * 6.28) * 0.5 + 0.5;
          col += vec3(0.6, 0.6, 0.8) * star * (tw * 0.5 + 0.5) * 0.4;
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const bgGeo = new THREE.PlaneGeometry(2, 2);
  const bg = new THREE.Mesh(bgGeo, bgMat);
  bg.renderOrder = -1;
  bg.frustumCulled = false;
  scene.add(bg);
  return bgMat;
}

// ============================================================
// 花瓣几何体生成
// ============================================================
function createPetalGeometry(length, width, segU, segV) {
  const geo = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;

      // 花瓣宽度轮廓：圆润的水滴/匙形
      const wProfile = Math.pow(Math.sin(u * Math.PI * 0.52), 0.55) *
                        Math.pow(1.0 - Math.pow(u, 2.0), 0.7);
      const halfW = (v - 0.5) * width * wProfile;

      // 纵向弧线
      const r = u * length;

      // 碗状微凹
      const bowl = 0.04 * (1.0 - u * 0.4) * (1.0 - Math.pow((v - 0.5) * 2.0, 2));

      // 叶脉凹凸
      const vc = v - 0.5;
      const mainVein = Math.exp(-vc * vc * 100) * 0.015 * u;
      const sideVein = 0.005 * Math.sin(u * 12.0) * Math.cos(vc * 18.0) * u;

      // 边缘波纹
      const ruffle = 0.008 * Math.sin(v * Math.PI * 5 + u * 4) * u * u;

      const x = halfW;
      const y = bowl + mainVein + sideVein + ruffle;
      const z = r;

      positions.push(x, y, z);

      // UV
      uvs.push(u, v);
    }
  }

  // 索引
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i;
      const b = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

// ============================================================
// 花瓣材质 — 自定义着色器
// ============================================================
function createPetalMaterial(layerRatio) {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      uTime: { value: 0 },
      uLayerRatio: { value: layerRatio }, // 0=最外层, 1=花心
      uBloom: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uBloom;
      uniform float uLayerRatio;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      varying float vFresnel;

      void main() {
        vUv = uv;
        vec3 pos = position;

        // 呼吸波动
        float breathe = 0.008 * sin(uTime * 1.0 + uv.x * 2.5 + uLayerRatio * 1.5);
        breathe += 0.005 * sin(uTime * 0.7 + uv.y * 3.14);
        pos += normal * breathe;

        // 微风
        pos.x += 0.006 * sin(uTime * 0.35 + pos.z * 2.5) * uv.x;
        pos.z += 0.004 * cos(uTime * 0.3 + pos.x * 2.0) * uv.x;

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(normalMatrix * normal);

        // Fresnel
        vec3 viewDir = normalize(cameraPosition - worldPos.xyz);
        float NdotV = max(dot(vWorldNormal, viewDir), 0.0);
        vFresnel = pow(1.0 - NdotV, 2.8);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLayerRatio;
      uniform float uBloom;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      varying float vFresnel;

      void main() {
        float u = vUv.x;
        float v = vUv.y;
        float lr = uLayerRatio;
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);

        // 叶脉法线扰动
        float vc = v - 0.5;
        float veinBump = exp(-vc * vc * 100.0) * 0.3 * u;
        veinBump += 0.08 * sin(u * 12.0) * cos(vc * 18.0) * u;
        // 扰动法线（简化TBN）
        vec3 up = vec3(0.0, 1.0, 0.0);
        vec3 T = normalize(cross(up, N));
        if (length(cross(up, N)) < 0.01) T = normalize(cross(vec3(1,0,0), N));
        vec3 B = normalize(cross(N, T));
        float dVeinU = veinBump * 0.5;
        float dVeinV = exp(-vc * vc * 80.0) * 0.15;
        N = normalize(N + T * dVeinU * 0.3 + B * dVeinV * 0.2);

        // === 配色 ===
        // 参考图：外层蓝紫色，内层粉白色
        vec3 outerDark = vec3(0.28, 0.26, 0.58);
        vec3 outerLight = vec3(0.42, 0.40, 0.72);
        vec3 midColor = vec3(0.56, 0.50, 0.80);
        vec3 innerColor = vec3(0.78, 0.68, 0.88);
        vec3 coreColor = vec3(0.94, 0.86, 0.96);

        vec3 base;
        if (lr < 0.2) base = mix(outerDark, outerLight, lr * 5.0);
        else if (lr < 0.45) base = mix(outerLight, midColor, (lr - 0.2) / 0.25);
        else if (lr < 0.7) base = mix(midColor, innerColor, (lr - 0.45) / 0.25);
        else base = mix(innerColor, coreColor, (lr - 0.7) / 0.3);

        // 径向亮度变化
        base *= 0.88 + 0.12 * sin(u * 3.14159);

        // 叶脉处稍暗
        float vein = exp(-vc * vc * 100.0) * u * 0.15;
        base *= (1.0 - vein);

        // === 光照 ===
        vec3 L1 = normalize(vec3(0.2, 0.8, 0.4));
        vec3 L2 = normalize(vec3(-0.3, 0.4, -0.5));

        float wrap = 0.4;
        float d1 = (max(dot(N, L1), 0.0) + wrap) / (1.0 + wrap);
        float d2 = (max(dot(N, L2), 0.0) + wrap) / (1.0 + wrap);

        float amb = 0.25 + 0.10 * lr;
        vec3 col = base * (amb + d1 * 0.48 + d2 * 0.15);

        // 高光
        vec3 H1 = normalize(L1 + V);
        float spec = pow(max(dot(N, H1), 0.0), 36.0) * 0.18;
        col += vec3(0.65, 0.60, 0.90) * spec;

        // SSS 透光
        vec3 sssDir = normalize(L1 + V * 0.3);
        float sss = pow(max(dot(-N, sssDir), 0.0), 2.5) * 0.30;
        col += vec3(0.65, 0.50, 0.85) * sss * (1.0 - lr * 0.3);

        // 菲涅尔边缘光
        col += vec3(0.50, 0.46, 0.88) * vFresnel * 0.38;

        // 花心辉光
        float coreGlow = lr * lr * (1.0 - u * 0.6);
        float pulse = 0.03 * sin(uTime * 1.2) + 0.03;
        col += coreColor * coreGlow * (0.75 + pulse);

        // === Alpha ===
        float fadeU = smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.88, u);
        float fadeV = 1.0 - pow(abs(v - 0.5) * 2.0, 2.5) * 0.45;
        float a = fadeU * fadeV;
        a *= mix(0.55, 0.92, lr);
        a = max(a, vFresnel * 0.15);
        a *= uBloom;
        a = clamp(a, 0.0, 0.94);

        gl_FragColor = vec4(col, a);
      }
    `,
  });
}

// ============================================================
// 花茎材质
// ============================================================
function createStemMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {},
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        // 灰紫色花茎
        vec3 col = vec3(0.35, 0.30, 0.45);
        float light = max(dot(vNormal, normalize(vec3(0.2, 0.8, 0.4))), 0.0);
        col *= 0.4 + light * 0.5;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// ============================================================
// 构建花朵
// ============================================================
const flowerGroup = new THREE.Group();
scene.add(flowerGroup);

const bgMat = createBackground();

// 收集所有花瓣材质和mesh，用于动画
const petalData = []; // { mesh, material, layer, index, baseAngleY, baseAngleX }

const totalLayers = CFG.layers.length;

CFG.layers.forEach((layer, li) => {
  const layerRatio = li / (totalLayers - 1); // 0=外层, 1=花心
  const geo = createPetalGeometry(layer.len, layer.wid, 24, 14);

  for (let pi = 0; pi < layer.count; pi++) {
    const mat = createPetalMaterial(layerRatio);
    const mesh = new THREE.Mesh(geo, mat);

    // 基础角度
    const baseAngleY = (pi / layer.count) * Math.PI * 2 +
      (li % 2 === 0 ? 0 : Math.PI / layer.count); // 交替错位

    // 展开角度（从Y轴竖直方向倾斜）
    const baseAngleX = THREE.MathUtils.degToRad(layer.angle);

    // 微小随机扰动
    const randAngle = (Math.sin(pi * 137.508 + li * 42) * 0.04);
    const randLen = 1.0 + Math.sin(pi * 73 + li * 31) * 0.05;

    mesh.scale.set(randLen, 1, randLen);

    // 设置花瓣变换：
    // 1. 先绕X轴旋转展开角（让花瓣从竖直变为倾斜）
    // 2. 再绕Y轴旋转到径向位置
    const pivot = new THREE.Group();
    pivot.rotation.y = baseAngleY + randAngle;
    pivot.position.y = layer.y;

    const tilt = new THREE.Group();
    tilt.rotation.x = baseAngleX;
    tilt.add(mesh);
    pivot.add(tilt);
    flowerGroup.add(pivot);

    petalData.push({
      mesh,
      material: mat,
      pivot,
      tilt,
      layerIndex: li,
      layerRatio,
      baseAngleX,
      baseAngleY: baseAngleY + randAngle,
    });
  }
});

// 花茎
const stemGeo = new THREE.CylinderGeometry(CFG.stemRadius * 0.7, CFG.stemRadius, CFG.stemLength, 8, 6);
const stemMat = createStemMaterial();
const stem = new THREE.Mesh(stemGeo, stemMat);
stem.position.y = -CFG.stemLength / 2;
flowerGroup.add(stem);

// ============================================================
// 动画循环
// ============================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  // 相机缓慢旋转
  const ca = elapsed * CFG.cameraRotateSpeed;
  const cd = CFG.cameraDistance;
  const cp = CFG.cameraPitch;
  camera.position.set(
    Math.sin(ca) * cd * Math.cos(cp),
    Math.sin(cp) * cd + 0.3,
    Math.cos(ca) * cd * Math.cos(cp)
  );
  camera.lookAt(0, 0.25, 0);

  // 绽放动画：循环
  // 用 sin 波让花瓣在"收拢"和"绽放"之间循环
  // 每层有不同的相位偏移，外层先动
  const cyclePeriod = CFG.bloomCycleDuration;
  const t = elapsed / cyclePeriod; // 归一化时间

  // 整体绽放进度：开始时从0到1展开，之后在0.7~1.0之间循环波动
  const initialBloom = Math.min(elapsed / 3.0, 1.0);
  const easeBloom = 1.0 - Math.pow(1.0 - initialBloom, 3.0);

  petalData.forEach((pd) => {
    const { material, tilt, layerRatio, baseAngleX } = pd;

    // 循环呼吸波动
    // 外层花瓣波动幅度大，内层小
    const layerPhase = layerRatio * 0.8; // 内层有延迟
    const waveAmp = 0.12 * (1.0 - layerRatio * 0.5); // 外层幅度大
    const wave = Math.sin(t * Math.PI * 2 - layerPhase * Math.PI * 2) * waveAmp;

    // 当前展开角 = 基础角 × 绽放进度 + 波动
    const bloomFactor = easeBloom;
    const currentAngle = baseAngleX * bloomFactor + wave;

    // 未绽放时花瓣收拢（角度接近0=竖直向上）
    tilt.rotation.x = currentAngle;

    // 更新 uniform
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uBloom.value = bloomFactor;
  });

  // 背景
  bgMat.uniforms.uTime.value = elapsed;

  renderer.render(scene, camera);
}

animate();
console.log('🌺 大丽花 VOL2 启动！');