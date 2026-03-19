// ===================================================================
// 背景渲染着色器 (Background Shader)
// ===================================================================
// 参考图背景：上方偏黑/深蓝，中下方深蓝紫渐变，有微弱星点闪烁
// 使用全屏三角形（无需顶点 Buffer）

struct BgParams {
  time: f32,
  aspect: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<uniform> params: BgParams;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// 全屏覆盖：6个顶点组成2个三角形
@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VSOutput {
  // 全屏 quad 的 6 个顶点（2 个三角形）
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
  );

  var output: VSOutput;
  let pos = positions[vertexIndex];
  output.position = vec4<f32>(pos, 0.999, 1.0); // z接近远平面
  output.uv = pos * 0.5 + 0.5; // 转为 [0,1]
  return output;
}

// 伪随机 hash 函数
fn hash21(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, vec3<f32>(p3.y + 33.33, p3.z + 33.33, p3.x + 33.33));
  return fract((p3.x + p3.y) * p3.z);
}

@fragment
fn fs_main(input: VSOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;

  // ===== 渐变背景 =====
  // 参考图：顶部近黑，中部深蓝，底部暖蓝紫
  let topColor = vec3<f32>(0.015, 0.015, 0.045);    // 近黑微蓝
  let midColor = vec3<f32>(0.05, 0.04, 0.18);       // 深靛蓝
  let botColor = vec3<f32>(0.14, 0.11, 0.35);       // 暖蓝紫

  // 非线性渐变
  let t = uv.y; // 0=底部, 1=顶部
  var bg: vec3<f32>;
  if (t > 0.5) {
    // 上半部分：中间到顶部
    let tt = (t - 0.5) * 2.0;
    bg = mix(midColor, topColor, tt * tt);
  } else {
    // 下半部分：底部到中间
    let tt = t * 2.0;
    bg = mix(botColor, midColor, tt);
  }

  // 中心微微亮一点（花朵位置的环境光）
  let centerDist = length(vec2<f32>(uv.x - 0.5, (uv.y - 0.45) * params.aspect));
  let centerGlow = exp(-centerDist * centerDist * 4.0) * 0.04;
  bg += vec3<f32>(0.15, 0.12, 0.35) * centerGlow;

  // ===== 星点 =====
  // 参考图中有稀疏的微弱星点
  let starUV = uv * vec2<f32>(80.0, 45.0); // 网格密度
  let starCell = floor(starUV);
  let starFract = fract(starUV) - 0.5;

  let starRand = hash21(starCell);
  var star = 0.0;

  // 只有少数cell有星星（约5%的概率）
  if (starRand > 0.95) {
    // 星星位置在 cell 内随机偏移
    let starOffset = vec2<f32>(
      hash21(starCell + vec2<f32>(1.0, 0.0)) - 0.5,
      hash21(starCell + vec2<f32>(0.0, 1.0)) - 0.5
    ) * 0.6;
    let dist = length(starFract - starOffset);

    // 星星大小
    let starSize = 0.03 + starRand * 0.02;
    star = smoothstep(starSize, 0.0, dist);

    // 闪烁
    let twinkle = sin(params.time * (1.5 + starRand * 3.0) + starRand * 6.28) * 0.5 + 0.5;
    star *= twinkle * 0.6 + 0.4;
    star *= 0.5; // 总体亮度降低
  }

  bg += vec3<f32>(0.7, 0.7, 0.85) * star;

  return vec4<f32>(bg, 1.0);
}