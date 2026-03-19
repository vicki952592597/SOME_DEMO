/**
 * 花朵几何体生成器 v3 — 高仿参考图牡丹/莲花风格
 * 6层花瓣, 约60片, 圆润羽毛形, 自然弧度弯曲
 */

export interface FlowerConfig {
  layers: LayerConfig[];
  segU: number;
  segV: number;
  stemLen: number;
  stemSegs: number;
  stemRSegs: number;
}

export interface LayerConfig {
  count: number;
  len: number;
  wid: number;
  open: number;   // 展开角(弧度)
  curl: number;
  tipCurl: number;
  aOff: number;    // 角度偏移
  yOff: number;
  idx: number;
}

export const DEFAULT_CFG: FlowerConfig = {
  segU: 32, segV: 18,
  stemLen: 0.8, stemSegs: 10, stemRSegs: 6,
  layers: [
    // 大丽花：向上生长，外层大瓣向外展，整体圆球形
    // open: 展开角，大=更向外倾斜；curl: 弧度弯曲；tipCurl: 尖端翻卷
    { count:13, len:0.90, wid:0.52, open:1.55, curl:0.08, tipCurl:0.10,  aOff:0,              yOff:0.0,  idx:0 },
    { count:12, len:0.82, wid:0.48, open:1.30, curl:0.10, tipCurl:0.08,  aOff:Math.PI/12,     yOff:0.02, idx:1 },
    { count:11, len:0.72, wid:0.44, open:1.05, curl:0.12, tipCurl:0.05,  aOff:Math.PI/22,     yOff:0.04, idx:2 },
    { count:10, len:0.60, wid:0.38, open:0.78, curl:0.15, tipCurl:0.03,  aOff:Math.PI/10*0.3, yOff:0.06, idx:3 },
    { count:9,  len:0.45, wid:0.30, open:0.50, curl:0.18, tipCurl:0.0,   aOff:Math.PI/9,      yOff:0.08, idx:4 },
    { count:7,  len:0.28, wid:0.20, open:0.25, curl:0.12, tipCurl:0.0,   aOff:Math.PI/14,     yOff:0.10, idx:5 },
  ],
};

export interface FlowerGeo {
  verts: Float32Array;
  idx: Uint32Array;
  vCount: number;
  iCount: number;
}

// 花瓣宽度轮廓 — 圆润水滴形
function wp(u: number): number {
  return Math.pow(Math.sin(u * Math.PI * 0.5), 0.6) * Math.pow(1.0 - Math.pow(u, 1.8), 0.8);
}

// 花瓣弯曲角
function bendA(u: number, open: number, curl: number, tip: number): number {
  return open * u + curl * u * u * Math.PI * 0.5 + tip * Math.pow(u, 3) * Math.PI;
}

export function generateFlower(cfg: FlowerConfig = DEFAULT_CFG): FlowerGeo {
  const { segU, segV, layers } = cfg;
  const vpP = (segU + 1) * (segV + 1);
  const ipP = segU * segV * 6;
  let totP = 0;
  for (const l of layers) totP += l.count;
  const sV = (cfg.stemSegs + 1) * (cfg.stemRSegs + 1);
  const sI = cfg.stemSegs * cfg.stemRSegs * 6;
  const S = 9; // stride
  const verts = new Float32Array((vpP * totP + sV) * S);
  const idxArr = new Uint32Array(ipP * totP + sI);
  let vo = 0, io = 0, bv = 0;
  const nL = layers.length;

  for (const L of layers) {
    const lr = L.idx / Math.max(nL - 1, 1);
    for (let p = 0; p < L.count; p++) {
      const ba = (p / L.count) * Math.PI * 2 + L.aOff;
      const s1 = Math.sin(p * 137.508 + L.idx * 42);
      const s2 = Math.cos(p * 73 + L.idx * 31);
      const pL = L.len * (1 + s1 * 0.07);
      const pW = L.wid * (1 + s2 * 0.05);
      const oA = L.open + Math.sin(p * 53 + L.idx * 17) * 0.04;
      const cosB = Math.cos(ba), sinB = Math.sin(ba);
      const bowlD = 0.06 * (1 - lr * 0.5);

      for (let j = 0; j <= segV; j++) {
        const v = j / segV;
        for (let i = 0; i <= segU; i++) {
          const u = i / segU;
          const bAng = bendA(u, oA, L.curl, L.tipCurl);
          const ar = u * pL;
          // 大丽花向上生长：
          // bAng=0 时花瓣竖直向上(Y+)，bAng增大时向外倾斜(水平方向)
          // localY = ar * cos(bAng)  → 竖直分量（向上）
          // localR = ar * sin(bAng)  → 向外展开的径向分量
          const lR = ar * Math.sin(bAng); // 向外展开距离
          const ly0 = ar * Math.cos(bAng); // 向上高度（正=向上）
          const w = wp(u);
          const hw = (v - 0.5) * pW * w;
          // bowl: 花瓣横截面微凹（碗形），让花瓣不是完全平的
          const bowl = bowlD * (1 - u * 0.3) * (1 - Math.pow((v - 0.5) * 2, 2));
          const ruffle = 0.012 * Math.sin(v * Math.PI * 4 + u * 5) * u * u;

          // 局部坐标：花瓣沿径向(+Z)展开，横向(+X)为宽度，Y为高度
          const lx = hw;
          const lz = lR;
          const ly = ly0 + bowl + ruffle;

          // 绕Y轴旋转到径向位置
          const px = lx * cosB - lz * sinB;
          const pz = lx * sinB + lz * cosB;
          const py = ly + L.yOff;

          // 法线 (有限差分)
          const e = 0.003;
          const u2 = Math.min(u + e, 1);
          const ba2 = bendA(u2, oA, L.curl, L.tipCurl);
          const ar2 = u2 * pL;
          const lR2 = ar2 * Math.sin(ba2);
          const ly2base = ar2 * Math.cos(ba2);
          const ly2 = ly2base + bowl + 0.012 * Math.sin(v * Math.PI * 4 + u2 * 5) * u2 * u2;
          const w2 = wp(u2);
          const hw2 = (v - 0.5) * pW * w2;
          const du = { x: hw2 * cosB - lR2 * sinB - px, y: ly2 + L.yOff - py, z: hw2 * sinB + lR2 * cosB - pz };

          const v2 = Math.min(v + e, 1);
          const hwv = (v2 - 0.5) * pW * w;
          const bowlv = bowlD * (1 - u * 0.3) * (1 - Math.pow((v2 - 0.5) * 2, 2));
          const lyv = ly0 + bowlv + 0.012 * Math.sin(v2 * Math.PI * 4 + u * 5) * u * u;
          const dv = { x: hwv * cosB - lR * sinB - px, y: lyv + L.yOff - py, z: hwv * sinB + lR * cosB - pz };

          let nx = du.y * dv.z - du.z * dv.y;
          let ny = du.z * dv.x - du.x * dv.z;
          let nz = du.x * dv.y - du.y * dv.x;
          const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          nx /= nl; ny /= nl; nz /= nl;
          // 法线应朝"花朵外侧"——即从花心向外的方向
          // 花朵中心在 (0, ~0.3, 0)，法线应该与从中心到顶点的方向同侧
          const toCenterX = -px;
          const toCenterY = -(py - 0.3);
          const toCenterZ = -pz;
          const dotCenter = nx * toCenterX + ny * toCenterY + nz * toCenterZ;
          if (dotCenter > 0) { nx = -nx; ny = -ny; nz = -nz; }

          const vi = vo * S;
          verts[vi] = px; verts[vi + 1] = py; verts[vi + 2] = pz;
          verts[vi + 3] = nx; verts[vi + 4] = ny; verts[vi + 5] = nz;
          verts[vi + 6] = u; verts[vi + 7] = v; verts[vi + 8] = lr;
          vo++;
        }
      }
      for (let j = 0; j < segV; j++) {
        for (let i = 0; i < segU; i++) {
          const a = bv + j * (segU + 1) + i, b = a + 1, c = a + (segU + 1), d = c + 1;
          idxArr[io++] = a; idxArr[io++] = c; idxArr[io++] = b;
          idxArr[io++] = b; idxArr[io++] = c; idxArr[io++] = d;
        }
      }
      bv += vpP;
    }
  }

  // 花茎 (圆柱)
  const sSegs = cfg.stemSegs, rSegs = cfg.stemRSegs;
  const stemBV = bv;
  for (let i = 0; i <= sSegs; i++) {
    const t = i / sSegs;
    const y = -t * cfg.stemLen;
    const bx = 0.02 * Math.sin(t * Math.PI * 0.8);
    const bz2 = 0.01 * Math.cos(t * Math.PI * 0.6);
    const r = 0.022 * (0.8 + 0.4 * t);
    for (let j = 0; j <= rSegs; j++) {
      const a = (j / rSegs) * Math.PI * 2;
      const cnx = Math.cos(a), cnz = Math.sin(a);
      const vi = vo * S;
      verts[vi] = cnx * r + bx; verts[vi + 1] = y; verts[vi + 2] = cnz * r + bz2;
      verts[vi + 3] = cnx; verts[vi + 4] = 0; verts[vi + 5] = cnz;
      verts[vi + 6] = j / rSegs; verts[vi + 7] = t; verts[vi + 8] = 0.5;
      vo++;
    }
  }
  for (let i = 0; i < sSegs; i++) {
    for (let j = 0; j < rSegs; j++) {
      const a = stemBV + i * (rSegs + 1) + j, b = a + 1, c = a + (rSegs + 1), d = c + 1;
      idxArr[io++] = a; idxArr[io++] = c; idxArr[io++] = b;
      idxArr[io++] = b; idxArr[io++] = c; idxArr[io++] = d;
    }
  }

  return { verts, idx: idxArr, vCount: vo, iCount: io };
}