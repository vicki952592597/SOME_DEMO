/**
 * ===================================================================
 * 简易矩阵数学工具 (Matrix Math Utilities)
 * ===================================================================
 * 提供 4x4 矩阵的基本操作，用于构建 MVP 矩阵。
 * 不依赖 gl-matrix 等外部库，完全手写实现。
 */

/** 4x4 矩阵类型（列主序，WebGPU 标准） */
export type Mat4 = Float32Array;

/** 创建单位矩阵 */
export function mat4Identity(): Mat4 {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

/** 透视投影矩阵 */
export function mat4Perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1.0 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  // WebGPU 使用 [0, 1] 深度范围（不同于 OpenGL 的 [-1, 1]）
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, far * nf, -1,
    0, 0, near * far * nf, 0,
  ]);
}

/** 观察矩阵 (LookAt) */
export function mat4LookAt(eye: [number, number, number], center: [number, number, number], up: [number, number, number]): Mat4 {
  const zx = eye[0] - center[0];
  const zy = eye[1] - center[1];
  const zz = eye[2] - center[2];
  let len = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
  const fz = [zx / len, zy / len, zz / len];

  // right = up × forward
  let rx = up[1] * fz[2] - up[2] * fz[1];
  let ry = up[2] * fz[0] - up[0] * fz[2];
  let rz = up[0] * fz[1] - up[1] * fz[0];
  len = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
  rx /= len; ry /= len; rz /= len;

  // recompute up = forward × right
  const ux = fz[1] * rz - fz[2] * ry;
  const uy = fz[2] * rx - fz[0] * rz;
  const uz = fz[0] * ry - fz[1] * rx;

  return new Float32Array([
    rx, ux, fz[0], 0,
    ry, uy, fz[1], 0,
    rz, uz, fz[2], 0,
    -(rx * eye[0] + ry * eye[1] + rz * eye[2]),
    -(ux * eye[0] + uy * eye[1] + uz * eye[2]),
    -(fz[0] * eye[0] + fz[1] * eye[1] + fz[2] * eye[2]),
    1,
  ]);
}

/** 矩阵乘法 a × b */
export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/** 绕 Y 轴旋转矩阵 */
export function mat4RotateY(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]);
}

/** 绕 X 轴旋转矩阵 */
export function mat4RotateX(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ]);
}

/** 缩放矩阵 */
export function mat4Scale(sx: number, sy: number, sz: number): Mat4 {
  return new Float32Array([
    sx, 0, 0, 0,
    0, sy, 0, 0,
    0, 0, sz, 0,
    0, 0, 0, 1,
  ]);
}

/** 平移矩阵 */
export function mat4Translate(tx: number, ty: number, tz: number): Mat4 {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    tx, ty, tz, 1,
  ]);
}