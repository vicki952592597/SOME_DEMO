// 对比原始GLB和拆分GLB的UV
const fs = require('fs');
const path = require('path');

function parseGLB(filePath) {
  const buf = fs.readFileSync(filePath);
  const chunk0Len = buf.readUInt32LE(12);
  const jsonStr = buf.slice(20, 20 + chunk0Len).toString('utf8');
  const gltf = JSON.parse(jsonStr);
  const binStart = 20 + chunk0Len + 8;
  return { gltf, buf, binStart };
}

function sampleUV(buf, binStart, gltf, meshIdx, count) {
  const m = gltf.meshes[meshIdx];
  const uvAccIdx = m.primitives[0].attributes.TEXCOORD_0;
  if (uvAccIdx === undefined) return 'NO UV';
  const acc = gltf.accessors[uvAccIdx];
  const bv = gltf.bufferViews[acc.bufferView];
  const offset = binStart + (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = bv.byteStride || 8;
  const samples = [];
  for (let i = 0; i < Math.min(count, acc.count); i++) {
    const o = offset + i * stride;
    samples.push([buf.readFloatLE(o).toFixed(4), buf.readFloatLE(o+4).toFixed(4)]);
  }
  return samples;
}

// 原始 flower.glb (一体mesh)
const orig = parseGLB(path.resolve(__dirname, '../yujinxiang/flower/source/flower.glb'));
console.log('=== ORIGINAL flower.glb ===');
console.log('Meshes:', orig.gltf.meshes.length);
console.log('First 10 UVs of mesh 0:', sampleUV(orig.buf, orig.binStart, orig.gltf, 0, 10));

// 拆分 yyujinx1.glb
const split = parseGLB(path.resolve(__dirname, '../yujinxiang/flower/source/yyujinx1.glb'));
console.log('\n=== SPLIT yyujinx1.glb ===');
const names = ['genjin','huaban1','huaban2','huaban3','huaban4','huaban5','huaban6','huarui','left1','left2','left3'];
split.gltf.meshes.forEach((m, i) => {
  console.log(`\n${names[i]}: first 5 UVs:`, sampleUV(split.buf, split.binStart, split.gltf, i, 5));
});

// 检查原始GLB的贴图设置
console.log('\n=== ORIGINAL TEXTURES ===');
if (orig.gltf.samplers) {
  orig.gltf.samplers.forEach((s, i) => {
    console.log(`sampler[${i}]:`, JSON.stringify(s));
  });
}