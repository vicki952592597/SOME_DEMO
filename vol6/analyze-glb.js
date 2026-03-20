// 深度分析 GLB 几何数据 — 提取花瓣/茎/叶轮廓
const fs = require('fs');
const path = require('path');

const glbPath = path.resolve(__dirname, '../yujinxiang/flower/source/flower.glb');
const buf = fs.readFileSync(glbPath);

const chunk0Len = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + chunk0Len).toString('utf8');
const gltf = JSON.parse(jsonStr);

// 二进制 chunk
const binStart = 20 + chunk0Len + 8;

function readAccessor(accIdx) {
  const acc = gltf.accessors[accIdx];
  const bv = gltf.bufferViews[acc.bufferView];
  const offset = binStart + (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = bv.byteStride || 0;
  const count = acc.count;
  const result = [];
  
  if (acc.type === 'VEC3') {
    const elemSize = stride || 12;
    for (let i = 0; i < count; i++) {
      const o = offset + i * elemSize;
      result.push([buf.readFloatLE(o), buf.readFloatLE(o+4), buf.readFloatLE(o+8)]);
    }
  } else if (acc.type === 'VEC2') {
    const elemSize = stride || 8;
    for (let i = 0; i < count; i++) {
      const o = offset + i * elemSize;
      result.push([buf.readFloatLE(o), buf.readFloatLE(o+4)]);
    }
  } else if (acc.type === 'SCALAR') {
    if (acc.componentType === 5123) { // UNSIGNED_SHORT
      const elemSize = stride || 2;
      for (let i = 0; i < count; i++) {
        result.push(buf.readUInt16LE(offset + i * elemSize));
      }
    } else if (acc.componentType === 5125) { // UNSIGNED_INT
      const elemSize = stride || 4;
      for (let i = 0; i < count; i++) {
        result.push(buf.readUInt32LE(offset + i * elemSize));
      }
    }
  }
  return result;
}

const prim = gltf.meshes[0].primitives[0];
const positions = readAccessor(prim.attributes.POSITION);
const normals = readAccessor(prim.attributes.NORMAL);
const uvs = readAccessor(prim.attributes.TEXCOORD_0);
const indices = readAccessor(prim.indices);

console.log(`Vertices: ${positions.length}, Triangles: ${indices.length / 3}`);

// 模型的缩放和偏移
const node = gltf.nodes[1]; // mesh node
const scale = node.scale ? node.scale[0] : 1;
const trans = node.translation || [0,0,0];
console.log(`Node scale: ${scale}, translation: ${JSON.stringify(trans)}`);

// 统计 Y 分布（应用 scale 和 translation）
let minY = Infinity, maxY = -Infinity;
const worldPos = positions.map(p => [
  p[0] * scale + trans[0],
  p[1] * scale + trans[1],
  p[2] * scale + trans[2]
]);
worldPos.forEach(p => { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
console.log(`World Y range: ${minY.toFixed(4)} ~ ${maxY.toFixed(4)}`);

// 按 Y 分层统计
const bins = 20;
const yRange = maxY - minY;
const histogram = new Array(bins).fill(0);
worldPos.forEach(p => {
  const bin = Math.min(Math.floor((p[1] - minY) / yRange * bins), bins - 1);
  histogram[bin]++;
});
console.log('\nY distribution (bottom to top):');
histogram.forEach((c, i) => {
  const y0 = (minY + i * yRange / bins).toFixed(3);
  const y1 = (minY + (i+1) * yRange / bins).toFixed(3);
  const bar = '#'.repeat(Math.ceil(c / 20));
  console.log(`  ${y0}~${y1}: ${c} ${bar}`);
});

// 按 UV 分析 — 看贴图区域分布
// UV 贴图上不同区域对应不同部件
let uvMinX = Infinity, uvMaxX = -Infinity, uvMinY = Infinity, uvMaxY = -Infinity;
uvs.forEach(uv => {
  uvMinX = Math.min(uvMinX, uv[0]); uvMaxX = Math.max(uvMaxX, uv[0]);
  uvMinY = Math.min(uvMinY, uv[1]); uvMaxY = Math.max(uvMaxY, uv[1]);
});
console.log(`\nUV range: U[${uvMinX.toFixed(3)}~${uvMaxX.toFixed(3)}] V[${uvMinY.toFixed(3)}~${uvMaxY.toFixed(3)}]`);

// 对高处顶点（花瓣区域 top 30%）分析 XZ 分布
const petalThreshold = minY + yRange * 0.6;
const petalVerts = worldPos.filter(p => p[1] > petalThreshold);
let pMinX = Infinity, pMaxX = -Infinity, pMinZ = Infinity, pMaxZ = -Infinity;
petalVerts.forEach(p => {
  pMinX = Math.min(pMinX, p[0]); pMaxX = Math.max(pMaxX, p[0]);
  pMinZ = Math.min(pMinZ, p[2]); pMaxZ = Math.max(pMaxZ, p[2]);
});
console.log(`\nPetal region (Y > ${petalThreshold.toFixed(3)}): ${petalVerts.length} verts`);
console.log(`  X range: ${pMinX.toFixed(4)} ~ ${pMaxX.toFixed(4)} (width: ${(pMaxX - pMinX).toFixed(4)})`);
console.log(`  Z range: ${pMinZ.toFixed(4)} ~ ${pMaxZ.toFixed(4)} (depth: ${(pMaxZ - pMinZ).toFixed(4)})`);

// 茎区域 (bottom 40%)
const stemThreshold = minY + yRange * 0.4;
const stemVerts = worldPos.filter(p => p[1] < stemThreshold);
let sMinX = Infinity, sMaxX = -Infinity, sMinZ = Infinity, sMaxZ = -Infinity;
stemVerts.forEach(p => {
  sMinX = Math.min(sMinX, p[0]); sMaxX = Math.max(sMaxX, p[0]);
  sMinZ = Math.min(sMinZ, p[2]); sMaxZ = Math.max(sMaxZ, p[2]);
});
console.log(`\nStem region (Y < ${stemThreshold.toFixed(3)}): ${stemVerts.length} verts`);
console.log(`  X range: ${sMinX.toFixed(4)} ~ ${sMaxX.toFixed(4)} (width: ${(sMaxX - sMinX).toFixed(4)})`);
console.log(`  Z range: ${sMinZ.toFixed(4)} ~ ${sMaxZ.toFixed(4)} (depth: ${(sMaxZ - sMinZ).toFixed(4)})`);

// 在花瓣区域，对每个不同角度 sector 统计顶点数量，看有几片花瓣
const sectors = 12;
const sectorCounts = new Array(sectors).fill(0);
petalVerts.forEach(p => {
  const angle = Math.atan2(p[2], p[0]);
  const sector = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * sectors) % sectors;
  sectorCounts[sector]++;
});
console.log('\nPetal angular distribution (sectors):');
sectorCounts.forEach((c, i) => {
  const a0 = (-180 + i * 360 / sectors).toFixed(0);
  const a1 = (-180 + (i+1) * 360 / sectors).toFixed(0);
  console.log(`  ${a0}°~${a1}°: ${c} ${'#'.repeat(Math.ceil(c/10))}`);
});