// ===================================================================
// 波动方程计算着色器 (Wave Equation Compute Shader)
// ===================================================================
// 实现 2D 波动方程的 Ping-Pong 模拟。
// 使用两个 Storage Buffer 交替存储当前帧和上一帧的高度场数据。
// 鼠标位置会在高度场中施加一个"力场"，产生涟漪效果。

// --- Uniform 数据 ---
struct WaveParams {
  // 鼠标在归一化空间中的坐标 (0~1)
  mouseX: f32,
  mouseY: f32,
  // 鼠标是否按下/移动（>0 表示有交互）
  mouseActive: f32,
  // 波动衰减系数（0.95~0.99，越大波动持续越久）
  damping: f32,
  // 波动传播速度
  speed: f32,
  // 高度场纹理尺寸
  gridSize: f32,
  // 全局时间
  time: f32,
  // 填充对齐
  _pad: f32,
};

@group(0) @binding(0) var<uniform> params: WaveParams;
// 当前帧高度场（读取）
@group(0) @binding(1) var<storage, read> currentField: array<f32>;
// 上一帧高度场（读取）
@group(0) @binding(2) var<storage, read> prevField: array<f32>;
// 输出：下一帧高度场（写入）
@group(0) @binding(3) var<storage, read_write> nextField: array<f32>;

// 将 2D 坐标转换为 1D 索引
fn idx(x: i32, y: i32) -> u32 {
  let size = i32(params.gridSize);
  let cx = clamp(x, 0, size - 1);
  let cy = clamp(y, 0, size - 1);
  return u32(cy * size + cx);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let size = i32(params.gridSize);
  let x = i32(gid.x);
  let y = i32(gid.y);

  // 越界检查
  if (x >= size || y >= size) {
    return;
  }

  let i = idx(x, y);

  // ===== 2D 波动方程离散化 =====
  // 拉普拉斯算子（4 邻域差分）
  let c = currentField[i];
  let l = currentField[idx(x - 1, y)];
  let r = currentField[idx(x + 1, y)];
  let u = currentField[idx(x, y - 1)];
  let d = currentField[idx(x, y + 1)];
  let laplacian = (l + r + u + d) - 4.0 * c;

  // 波动方程：next = 2*current - prev + speed^2 * laplacian
  let speedSq = params.speed * params.speed;
  var next = 2.0 * c - prevField[i] + speedSq * laplacian;

  // 施加衰减（耗散能量，让波动逐渐消失）
  next *= params.damping;

  // ===== 鼠标交互：在鼠标位置施加力场 =====
  if (params.mouseActive > 0.5) {
    let mx = params.mouseX * f32(size);
    let my = params.mouseY * f32(size);
    let dx = f32(x) - mx;
    let dy = f32(y) - my;
    let distSq = dx * dx + dy * dy;
    let radius = f32(size) * 0.04; // 力场半径
    let radiusSq = radius * radius;

    // 高斯分布的力场
    if (distSq < radiusSq * 4.0) {
      let strength = 0.4 * exp(-distSq / radiusSq);
      next += strength;
    }
  }

  // ===== 添加环境微扰（呼吸波动） =====
  // 低频正弦波，让花朵在没有交互时也有轻微的生命感
  let fx = f32(x) / f32(size);
  let fy = f32(y) / f32(size);
  let breathe = 0.003 * sin(params.time * 0.8 + fx * 6.28) * cos(params.time * 0.6 + fy * 6.28);
  next += breathe;

  // 限制高度范围，防止数值爆炸
  next = clamp(next, -2.0, 2.0);

  nextField[i] = next;
}