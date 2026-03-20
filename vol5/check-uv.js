// 检查拆分 GLB 的 UV 和材质
const fs = require('fs');
const path = require('path');
const glbPath = path.resolve(__dirname, '../yujinxiang/flower/source/yyujinx.glb');
const buf = fs.readFileSync(glbPath);
const chunk0Len = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + chunk0Len).toString('utf8');
const gltf = JSON.parse(jsonStr);
const binStart = 20 + chunk0Len + 8;

const names = ['genjin','huaban1','huaban2','huaban3','huaban4','huaban5','huaban6','huarui','left1','left2','left3'];

gltf.meshes.forEach((m, i) => {
  const prim = m.primitives[0];
  const hasUV = prim.attributes.TEXCOORD_0 !== undefined;
  const matIdx = prim.material;
  console.log(`${names[i]}: hasUV=${hasUV} material=${matIdx}`);
  
  if (hasUV) {
    const uvAcc = gltf.accessors[prim.attributes.TEXCOORD_0];
    console.log(`  UV count: ${uvAcc.count}`);
    if (uvAcc.min) console.log(`  UV min: [${uvAcc.min.map(v=>v.toFixed(3)).join(', ')}]`);
    if (uvAcc.max) console.log(`  UV max: [${uvAcc.max.map(v=>v.toFixed(3)).join(', ')}]`);
  }
});

console.log('\n=== Materials ===');
if (gltf.materials) {
  gltf.materials.forEach((m, i) => {
    console.log(`[${i}] "${m.name}" doubleSided:${m.doubleSided}`);
    console.log('  full:', JSON.stringify(m, null, 2));
  });
}

console.log('\n=== Textures ===');
console.log('count:', gltf.textures?.length || 0);
console.log('\n=== Images ===');
console.log('count:', gltf.images?.length || 0);