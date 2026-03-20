// 解析拆分后的 GLB 模型结构
const fs = require('fs');
const path = require('path');

const glbPath = path.resolve(__dirname, '../yujinxiang/flower/source/yyujinx.glb');
const buf = fs.readFileSync(glbPath);

const magic = buf.readUInt32LE(0);
const version = buf.readUInt32LE(4);
const totalLen = buf.readUInt32LE(8);
console.log(`GLB size: ${(totalLen / 1024 / 1024).toFixed(2)} MB, version: ${version}`);

const chunk0Len = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + chunk0Len).toString('utf8');
const gltf = JSON.parse(jsonStr);

console.log('\n=== SCENE HIERARCHY ===');
function printNode(idx, depth = 0) {
  const n = gltf.nodes[idx];
  const prefix = '  '.repeat(depth);
  const meshInfo = n.mesh !== undefined ? ` [mesh:${n.mesh} "${gltf.meshes[n.mesh]?.name || ''}"]` : '';
  const trans = n.translation ? ` pos(${n.translation.map(v=>v.toFixed(3)).join(',')})` : '';
  const rot = n.rotation ? ` rot(${n.rotation.map(v=>v.toFixed(3)).join(',')})` : '';
  const scl = n.scale ? ` scl(${n.scale.map(v=>v.toFixed(3)).join(',')})` : '';
  console.log(`${prefix}[${idx}] "${n.name || ''}"${meshInfo}${trans}${rot}${scl}`);
  if (n.children) n.children.forEach(c => printNode(c, depth + 1));
}
if (gltf.scenes && gltf.scenes[0]) {
  gltf.scenes[0].nodes.forEach(n => printNode(n));
}

console.log('\n=== MESHES ===');
gltf.meshes.forEach((m, i) => {
  let totalVerts = 0;
  let totalTris = 0;
  m.primitives.forEach(p => {
    if (p.attributes.POSITION !== undefined) {
      totalVerts += gltf.accessors[p.attributes.POSITION].count;
    }
    if (p.indices !== undefined) {
      totalTris += gltf.accessors[p.indices].count / 3;
    }
  });
  console.log(`  [${i}] "${m.name || ''}" verts:${totalVerts} tris:${totalTris} prims:${m.primitives.length}`);
});

console.log('\n=== MATERIALS ===');
if (gltf.materials) gltf.materials.forEach((m, i) => {
  console.log(`  [${i}] "${m.name || ''}" alpha:${m.alphaMode||'OPAQUE'} double:${m.doubleSided||false}`);
  if (m.pbrMetallicRoughness) {
    const pbr = m.pbrMetallicRoughness;
    if (pbr.baseColorTexture) console.log(`    baseColorTex: ${pbr.baseColorTexture.index}`);
    if (pbr.metallicRoughnessTexture) console.log(`    metalRoughTex: ${pbr.metallicRoughnessTexture.index}`);
  }
  if (m.normalTexture) console.log(`    normalTex: ${m.normalTexture.index}`);
});

console.log('\n=== TEXTURES & IMAGES ===');
if (gltf.textures) gltf.textures.forEach((t, i) => {
  const img = gltf.images[t.source];
  console.log(`  tex[${i}] -> img[${t.source}] "${img.name||''}" ${img.mimeType||''} bufView:${img.bufferView??'-'}`);
});