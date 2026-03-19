// 花朵渲染着色器 v4 — 牡丹风格：程序化叶脉凹凸 + 蓝紫丝绸 + 粉白花心

struct P {
  mvp: mat4x4<f32>,
  model: mat4x4<f32>,
  cam: vec4<f32>,
  time: f32,
  bloom: f32,
  ripStr: f32,
  gridSz: f32,
};

@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> wave: array<f32>;

struct VI { @location(0) pos: vec3<f32>, @location(1) nor: vec3<f32>, @location(2) uv: vec2<f32>, @location(3) lr: f32, };
struct VO {
  @builtin(position) cp: vec4<f32>,
  @location(0) wp: vec3<f32>,
  @location(1) wn: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) lr: f32,
  @location(4) fr: f32,
};

fn sw(uv: vec2<f32>) -> f32 {
  let s = i32(p.gridSz); let fs = p.gridSz;
  let gx = clamp(uv.x,0.0,1.0)*fs; let gy = clamp(uv.y,0.0,1.0)*fs;
  let x0 = clamp(i32(floor(gx)),0,s-1); let y0 = clamp(i32(floor(gy)),0,s-1);
  let x1 = clamp(x0+1,0,s-1); let y1 = clamp(y0+1,0,s-1);
  let fx = fract(gx); let fy = fract(gy);
  return mix(mix(wave[y0*s+x0],wave[y0*s+x1],fx),mix(wave[y1*s+x0],wave[y1*s+x1],fx),fy);
}

// ===== 程序化叶脉凹凸高度场 =====
// 模拟牡丹花瓣上的叶脉纹理
// u: 花瓣径向 (0=根部 1=尖端)
// v: 花瓣横向 (0~1, 0.5=中线)
fn veinHeight(u: f32, v: f32) -> f32 {
  let vc = v - 0.5; // 相对于中线的偏移 (-0.5 ~ 0.5)

  // 主脉：花瓣正中线的凹槽
  let mainVein = exp(-vc * vc * 120.0) * 0.6 * u;

  // 侧脉：从主脉分叉出去的分支脉络（无分支写法，避免 GPU 兼容性问题）
  var sideVeins = 0.0;
  for (var k = 1u; k <= 5u; k += 1u) {
    let fk = f32(k);
    let veinU = fk / 6.0;
    let du = u - veinU * 0.8;
    // 使用 smoothstep 代替 if 分支
    let mask = smoothstep(0.0, 0.01, du) * smoothstep(0.25, 0.24, du);
    let targetV = du * 1.8 * (0.5 + fk * 0.1);
    let distP = abs(vc - targetV);
    let distN = abs(vc + targetV);
    let veinW = max(0.006, 0.012 * (1.0 - du * 4.0));
    let intensity = max(0.0, (1.0 - du * 4.0)) * 0.35 * mask;
    sideVeins += exp(-distP * distP / (veinW * veinW)) * intensity;
    sideVeins += exp(-distN * distN / (veinW * veinW)) * intensity;
  }

  // 细微纹理：花瓣表面的微观凹凸（细胞纹理近似）
  let microU = u * 25.0;
  let microV = (v - 0.5) * 40.0;
  let micro = (sin(microU) * sin(microV) * 0.5 + 0.5) * 0.08 * u;

  return mainVein + sideVeins + micro;
}

// 通过有限差分从高度场计算扰动法线
fn veinNormal(u: f32, v: f32, N: vec3<f32>, T: vec3<f32>, B: vec3<f32>) -> vec3<f32> {
  let e = 0.005;
  let h = veinHeight(u, v);
  let hu = veinHeight(u + e, v);
  let hv = veinHeight(u, v + e);

  // 梯度
  let du = (hu - h) / e;
  let dv = (hv - h) / e;

  // 凹凸强度
  let strength = 0.5;

  // 扰动法线 = N - strength * (du * T + dv * B)
  let perturbed = normalize(N - strength * (du * T + dv * B));
  return perturbed;
}

@vertex fn vs_main(i: VI) -> VO {
  var o: VO;
  var pos = i.pos;
  let n = i.nor;
  let bl = p.bloom;
  let u = i.uv.x;
  let cf = 1.0 - bl;

  // 绽放动画
  let sh = mix(1.0, 0.1 + 0.9*(1.0-u), cf);
  pos.x *= sh; pos.z *= sh;
  pos.y += cf * u * 0.7;

  // 叶脉凹凸：沿法线方向的几何位移
  let veinH = veinHeight(i.uv.x, i.uv.y);
  pos += n * veinH * 0.012; // 微小的几何位移

  // 呼吸
  let br = 0.01*sin(p.time*1.0 + u*2.5 + i.lr*1.5) + 0.006*sin(p.time*0.6 + i.uv.y*3.14);
  pos += n * br;

  // 涟漪
  pos += n * sw(i.uv) * p.ripStr;

  // 微风
  pos.x += 0.008*sin(p.time*0.4+pos.z*3.0)*u;
  pos.z += 0.006*cos(p.time*0.35+pos.x*2.5)*u;

  let wp4 = p.model * vec4<f32>(pos,1.0);
  o.wp = wp4.xyz;
  o.wn = normalize((p.model*vec4<f32>(n,0.0)).xyz);
  o.cp = p.mvp * vec4<f32>(pos,1.0);
  o.uv = i.uv; o.lr = i.lr;

  let vd = normalize(p.cam.xyz - wp4.xyz);
  let ndv = max(dot(o.wn, vd), 0.0);
  o.fr = pow(1.0 - ndv, 2.8);
  return o;
}

@fragment fn fs_main(i: VO) -> @location(0) vec4<f32> {
  let u = i.uv.x; let v = i.uv.y; let lr = i.lr; let fr = i.fr;
  let N0 = normalize(i.wn);
  let V = normalize(p.cam.xyz - i.wp);

  // ===== 构建TBN切空间 =====
  // T: 大致沿花瓣径向 (dPos/du 方向)
  // B: 大致沿花瓣横向 (dPos/dv 方向)
  // 简化：用 N × up 得到 T，再叉积得 B
  let up = vec3<f32>(0.0, 1.0, 0.0);
  var T = normalize(cross(up, N0));
  // 如果 N 接近 up 导致退化，换一个参考方向
  if (length(cross(up, N0)) < 0.01) {
    T = normalize(cross(vec3<f32>(1.0, 0.0, 0.0), N0));
  }
  let B = normalize(cross(N0, T));

  // 叶脉法线扰动
  let N = veinNormal(u, v, N0, T, B);

  // === 配色（牡丹：冷蓝紫 → 薰衣草 → 粉白花心） ===
  let c0 = vec3<f32>(0.30, 0.28, 0.62);   // 深蓝紫（外层暗面）
  let c1 = vec3<f32>(0.45, 0.42, 0.75);   // 蓝紫（外层亮面）
  let c2 = vec3<f32>(0.58, 0.52, 0.82);   // 薰衣草（中层）
  let c3 = vec3<f32>(0.76, 0.67, 0.88);   // 淡紫（内层）
  let c4 = vec3<f32>(0.92, 0.83, 0.96);   // 粉白（花心）

  var base: vec3<f32>;
  if (lr < 0.25) {
    base = mix(c0, c1, lr * 4.0);
  } else if (lr < 0.5) {
    base = mix(c1, c2, (lr - 0.25) * 4.0);
  } else if (lr < 0.75) {
    base = mix(c2, c3, (lr - 0.5) * 4.0);
  } else {
    base = mix(c3, c4, (lr - 0.75) * 4.0);
  }

  // 叶脉处颜色微调（脉络处稍微深一点/偏绿）
  let vh = veinHeight(u, v);
  let veinDarken = vh * 0.25;
  base = mix(base, base * vec3<f32>(0.85, 0.88, 0.80), veinDarken);

  // 径向微调
  let radBright = 0.87 + 0.13 * sin(u * 3.14);
  base *= radBright;

  // === 光照（使用扰动后的法线 N） ===
  let L1 = normalize(vec3<f32>(0.2, 0.85, 0.4));
  let L2 = normalize(vec3<f32>(-0.3, 0.4, -0.6));
  let L3 = normalize(vec3<f32>(0.0, -0.5, 0.3));

  let wrap = 0.45;
  let d1 = (max(dot(N, L1), 0.0) + wrap) / (1.0 + wrap);
  let d2 = (max(dot(N, L2), 0.0) + wrap) / (1.0 + wrap);
  let d3 = max(dot(N, L3), 0.0) * 0.15;

  let amb = 0.22 + 0.08 * lr;
  var col = base * (amb + d1 * 0.52 + d2 * 0.18 + d3);

  // Specular (叶脉纹理让高光更细碎、更真实)
  let H1 = normalize(L1 + V);
  let spec1 = pow(max(dot(N, H1), 0.0), 40.0) * 0.22;
  let H2 = normalize(L2 + V);
  let spec2 = pow(max(dot(N, H2), 0.0), 28.0) * 0.10;
  col += vec3<f32>(0.68, 0.63, 0.93) * (spec1 + spec2);

  // === SSS 透光（花瓣薄处透光，叶脉处减弱） ===
  let sssD = normalize(L1 + V * 0.3);
  let sssBase = pow(max(dot(-N, sssD), 0.0), 2.5) * 0.38;
  // 叶脉处 SSS 减弱（脉络更厚实不容易透光）
  let sssMask = 1.0 - vh * 0.4;
  let sss = sssBase * sssMask;
  let sssC = vec3<f32>(0.68, 0.52, 0.86);
  col += sssC * sss * (1.0 - lr * 0.3);

  // === 菲涅尔边缘光 ===
  let frC = vec3<f32>(0.52, 0.48, 0.90);
  col += frC * fr * 0.42;

  // === 花心辉光 ===
  let coreR = lr * lr * (1.0 - u * 0.7);
  let pulse = 0.04 * sin(p.time * 1.2) + 0.04;
  col += c4 * coreR * (0.85 + pulse);

  // === 涟漪高亮 ===
  let wh = abs(sw(i.uv));
  col += vec3<f32>(0.6, 0.5, 0.9) * wh * 0.25;

  // === Alpha ===
  let fadeU = smoothstep(0.0, 0.05, u) * smoothstep(1.0, 0.88, u);
  let fadeV = 1.0 - pow(abs(v - 0.5) * 2.0, 2.5) * 0.5;
  var a = fadeU * fadeV;
  a *= mix(0.52, 0.90, lr);
  a = max(a, fr * 0.18);
  a *= p.bloom;
  a = clamp(a, 0.0, 0.95);

  return vec4<f32>(col, a);
}