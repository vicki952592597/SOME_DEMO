const fs = require('fs');
const path = require('path');
const glbPath = path.resolve(__dirname, '../yujinxiang/flower/source/yyujinx1.glb');
const buf = fs.readFileSync(glbPath);
const chunk0Len = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + chunk0Len).toString('utf8');
const gltf = JSON.parse(jsonStr);
console.log(`Size: ${(buf.length/1024).toFixed(1)} KB`);
console.log('\n=== HIERARCHY ===');
function printNode(idx, depth=0) {
  const n = gltf.nodes[idx];
  const p = '  '.repeat(depth);
  const mesh = n.mesh!==undefined ? ` [mesh:${n.mesh} "${gltf.meshes[n.mesh]?.name||''}"]` : '';
  const t = n.translation ? ` pos(${n.translation.map(v=>v.toFixed(3))})` : '';
  const r = n.rotation ? ` rot(${n.rotation.map(v=>v.toFixed(3))})` : '';
  const s = n.scale ? ` scl(${n.scale.map(v=>v.toFixed(3))})` : '';
  console.log(`${p}[${idx}] "${n.name||''}"${mesh}${t}${r}${s}`);
  if(n.children) n.children.forEach(c=>printNode(c,depth+1));
}
gltf.scenes[0].nodes.forEach(n=>printNode(n));
console.log('\n=== MESHES ===');
gltf.meshes.forEach((m,i)=>{
  const pa = m.primitives[0].attributes;
  const acc = gltf.accessors[pa.POSITION];
  const hasUV = pa.TEXCOORD_0!==undefined;
  console.log(`[${i}] "${m.name||''}" v:${acc.count} uv:${hasUV} min:[${acc.min.map(v=>v.toFixed(2))}] max:[${acc.max.map(v=>v.toFixed(2))}]`);
});
console.log('\nMaterials:', gltf.materials?.length||0);
console.log('Textures:', gltf.textures?.length||0);
console.log('Images:', gltf.images?.length||0);