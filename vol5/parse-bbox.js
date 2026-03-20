// 分析每个部件的包围盒
const fs = require('fs');
const path = require('path');
const glbPath = path.resolve(__dirname, '../yujinxiang/flower/source/yyujinx.glb');
const buf = fs.readFileSync(glbPath);
const chunk0Len = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + chunk0Len).toString('utf8');
const gltf = JSON.parse(jsonStr);
const binStart = 20 + chunk0Len + 8;

function readVec3Accessor(accIdx) {
  const acc = gltf.accessors[accIdx];
  const bv = gltf.bufferViews[acc.bufferView];
  const offset = binStart + (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = bv.byteStride || 12;
  const result = [];
  for (let i = 0; i < acc.count; i++) {
    const o = offset + i * stride;
    result.push([buf.readFloatLE(o), buf.readFloatLE(o+4), buf.readFloatLE(o+8)]);
  }
  return result;
}

const names = ['genjin','huaban1','huaban2','huaban3','huaban4','huaban5','huaban6','huarui','left1','left2','left3'];
gltf.meshes.forEach((m, i) => {
  const posAcc = m.primitives[0].attributes.POSITION;
  const acc = gltf.accessors[posAcc];
  const node = gltf.nodes[i];
  console.log(`\n${names[i] || node.name} (mesh ${i}):`);
  console.log(`  verts: ${acc.count}`);
  console.log(`  min: [${acc.min.map(v=>v.toFixed(3)).join(', ')}]`);
  console.log(`  max: [${acc.max.map(v=>v.toFixed(3)).join(', ')}]`);
  const size = acc.max.map((v,j) => (v - acc.min[j]).toFixed(3));
  console.log(`  size: [${size.join(', ')}]`);
  const center = acc.max.map((v,j) => ((v + acc.min[j])/2).toFixed(3));
  console.log(`  center: [${center.join(', ')}]`);
  if (node.translation) console.log(`  node pos: [${node.translation.map(v=>v.toFixed(3)).join(', ')}]`);
});