/**
 * 交互式发光波动花朵 v3 — 主程序
 * 深蓝渐变背景 + 蓝紫牡丹 + 粉白花心辉光
 */
import { generateFlower, DEFAULT_CFG } from './geometry';
import { mat4Perspective, mat4LookAt, mat4Multiply, mat4Identity } from './math';
import waveCS from './shaders/wave_compute.wgsl?raw';
import flowerRS from './shaders/flower_render.wgsl?raw';
import bgRS from './shaders/background.wgsl?raw';

const C = {
  GRID: 128,
  DAMP: 0.97,
  SPEED: 0.3,
  RIP: 0.06,
  BLOOM_T: 4.0,
  CAM_DIST: 2.2,
  CAM_PITCH: 0.35,
  CLR: { r: 0.04, g: 0.03, b: 0.14, a: 1.0 },
};

let dev: GPUDevice, ctx: GPUCanvasContext, fmt: GPUTextureFormat;
let mX = 0.5, mY = 0.5, mAct = 0, mDec = 0;
let t0 = 0;

async function initGPU() {
  const cv = document.getElementById('gpuCanvas') as HTMLCanvasElement;
  const fb = document.getElementById('fallback')!;
  if (!navigator.gpu) { cv.style.display='none'; fb.style.display='flex'; throw Error('No WebGPU'); }
  const ad = await navigator.gpu.requestAdapter({ powerPreference:'high-performance' });
  if (!ad) { cv.style.display='none'; fb.style.display='flex'; throw Error('No adapter'); }
  const d = await ad.requestDevice();
  const c = cv.getContext('webgpu') as GPUCanvasContext;
  const f = navigator.gpu.getPreferredCanvasFormat();
  c.configure({ device: d, format: f, alphaMode: 'premultiplied' });
  const resize = () => {
    const dpr = devicePixelRatio || 1;
    cv.width = Math.floor(cv.clientWidth * dpr);
    cv.height = Math.floor(cv.clientHeight * dpr);
  };
  resize();
  addEventListener('resize', resize);
  return { d, c, f, cv };
}

async function main() {
  const gpu = await initGPU();
  dev = gpu.d; ctx = gpu.c; fmt = gpu.f;
  const cv = gpu.cv;

  // 花朵
  const fl = generateFlower(DEFAULT_CFG);
  console.log(`🌸 ${fl.vCount} verts, ${fl.iCount/3} tris`);

  const vData = new Float32Array(fl.verts.buffer, 0, fl.vCount * 9);
  const vBuf = dev.createBuffer({ size: vData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  dev.queue.writeBuffer(vBuf, 0, vData);

  const iData = new Uint32Array(fl.idx.buffer, 0, fl.iCount);
  const iBuf = dev.createBuffer({ size: iData.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
  dev.queue.writeBuffer(iBuf, 0, iData);

  // 波动场
  const gSz = C.GRID, gEl = gSz * gSz, wbSz = gEl * 4;
  const wBufs = [0,1,2].map(i => dev.createBuffer({ label:`wave${i}`, size:wbSz, usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST }));
  const z = new Float32Array(gEl);
  for (const b of wBufs) dev.queue.writeBuffer(b, 0, z);

  // Uniforms
  const wUni = dev.createBuffer({ size:32, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST });
  const rUni = dev.createBuffer({ size:160, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST });
  const bUni = dev.createBuffer({ size:16, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST });

  let depthTex = dev.createTexture({ size:[cv.width,cv.height], format:'depth24plus', usage:GPUTextureUsage.RENDER_ATTACHMENT });

  // Compute pipeline
  const compPL = dev.createComputePipeline({
    layout:'auto',
    compute: { module: dev.createShaderModule({ code: waveCS }), entryPoint:'main' },
  });

  let pp = 0;
  const ppStates = [[0,1,2],[2,0,1],[1,2,0]];

  // BG pipeline
  const bgPL = dev.createRenderPipeline({
    layout:'auto',
    vertex: { module: dev.createShaderModule({ code: bgRS }), entryPoint:'vs_main' },
    fragment: { module: dev.createShaderModule({ code: bgRS }), entryPoint:'fs_main', targets:[{ format:fmt }] },
    primitive: { topology:'triangle-list' },
    depthStencil: { format:'depth24plus', depthWriteEnabled:false, depthCompare:'always' },
  });

  // Flower pipeline
  const flPL = dev.createRenderPipeline({
    layout:'auto',
    vertex: {
      module: dev.createShaderModule({ code: flowerRS }),
      entryPoint:'vs_main',
      buffers: [{
        arrayStride: 36,
        attributes: [
          { shaderLocation:0, offset:0,  format:'float32x3' as GPUVertexFormat },
          { shaderLocation:1, offset:12, format:'float32x3' as GPUVertexFormat },
          { shaderLocation:2, offset:24, format:'float32x2' as GPUVertexFormat },
          { shaderLocation:3, offset:32, format:'float32'   as GPUVertexFormat },
        ],
      }],
    },
    fragment: {
      module: dev.createShaderModule({ code: flowerRS }),
      entryPoint:'fs_main',
      targets: [{
        format: fmt,
        blend: {
          color: { srcFactor:'src-alpha' as GPUBlendFactor, dstFactor:'one-minus-src-alpha' as GPUBlendFactor, operation:'add' as GPUBlendOperation },
          alpha: { srcFactor:'one' as GPUBlendFactor, dstFactor:'one-minus-src-alpha' as GPUBlendFactor, operation:'add' as GPUBlendOperation },
        },
      }],
    },
    primitive: { topology:'triangle-list', cullMode:'none' },
    depthStencil: { format:'depth24plus', depthWriteEnabled:false, depthCompare:'always' },
  });

  // Events
  cv.addEventListener('mousemove', e => {
    const r = cv.getBoundingClientRect();
    mX = (e.clientX-r.left)/r.width; mY = (e.clientY-r.top)/r.height;
    mAct = 1; mDec = 1;
  });
  cv.addEventListener('mouseleave', () => { mAct = 0; });
  cv.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0], r = cv.getBoundingClientRect();
    mX = (t.clientX-r.left)/r.width; mY = (t.clientY-r.top)/r.height;
    mAct = 1; mDec = 1;
  }, { passive:false });
  cv.addEventListener('touchend', () => { mAct = 0; });

  t0 = performance.now() / 1000;

  function frame() {
    const now = performance.now() / 1000;
    const el = now - t0;
    if (!mAct) { mDec *= 0.95; if (mDec < 0.01) mDec = 0; }
    const bloom = 1.0 - Math.pow(1.0 - Math.min(el / C.BLOOM_T, 1.0), 3.0);
    const cw = cv.width, ch = cv.height;
    if (depthTex.width !== cw || depthTex.height !== ch) {
      depthTex.destroy();
      depthTex = dev.createTexture({ size:[cw,ch], format:'depth24plus', usage:GPUTextureUsage.RENDER_ATTACHMENT });
    }

    // Wave uniform
    dev.queue.writeBuffer(wUni, 0, new Float32Array([mX, mY, mDec, C.DAMP, C.SPEED, gSz, el, 0]));

    // Render uniform
    const asp = cw / ch;
    const proj = mat4Perspective(Math.PI / 3.2, asp, 0.1, 100);
    const ca = el * 0.05;
    const cd = C.CAM_DIST, cp = C.CAM_PITCH;
    const ex = Math.sin(ca)*cd*Math.cos(cp), ey = Math.sin(cp)*cd+0.45, ez = Math.cos(ca)*cd*Math.cos(cp);
    // lookAt 目标点提高到花朵中心高度（花朵向上生长，中心大约在 y=0.35）
    const view = mat4LookAt([ex,ey,ez], [0,0.35,0], [0,1,0]);
    const mvp = mat4Multiply(proj, mat4Multiply(view, mat4Identity()));
    const rd = new Float32Array(40);
    rd.set(mvp, 0); rd.set(mat4Identity(), 16);
    rd[32]=ex; rd[33]=ey; rd[34]=ez; rd[35]=1;
    rd[36]=el; rd[37]=bloom; rd[38]=C.RIP; rd[39]=gSz;
    dev.queue.writeBuffer(rUni, 0, rd);

    // BG uniform
    dev.queue.writeBuffer(bUni, 0, new Float32Array([el, asp, 0, 0]));

    const s = ppStates[pp];
    const cBG = dev.createBindGroup({ layout:compPL.getBindGroupLayout(0), entries:[
      { binding:0, resource:{ buffer:wUni } },
      { binding:1, resource:{ buffer:wBufs[s[0]] } },
      { binding:2, resource:{ buffer:wBufs[s[1]] } },
      { binding:3, resource:{ buffer:wBufs[s[2]] } },
    ]});
    const rBG = dev.createBindGroup({ layout:flPL.getBindGroupLayout(0), entries:[
      { binding:0, resource:{ buffer:rUni } },
      { binding:1, resource:{ buffer:wBufs[s[2]] } },
    ]});
    const bgBG = dev.createBindGroup({ layout:bgPL.getBindGroupLayout(0), entries:[
      { binding:0, resource:{ buffer:bUni } },
    ]});

    const enc = dev.createCommandEncoder();

    // Compute
    const cp2 = enc.beginComputePass();
    cp2.setPipeline(compPL);
    cp2.setBindGroup(0, cBG);
    const wg = Math.ceil(gSz / 16);
    cp2.dispatchWorkgroups(wg, wg);
    cp2.end();

    // Render
    const tv = ctx.getCurrentTexture().createView();
    const rp = enc.beginRenderPass({
      colorAttachments: [{ view:tv, clearValue:C.CLR, loadOp:'clear' as GPULoadOp, storeOp:'store' as GPUStoreOp }],
      depthStencilAttachment: { view:depthTex.createView(), depthClearValue:1, depthLoadOp:'clear' as GPULoadOp, depthStoreOp:'store' as GPUStoreOp },
    });
    rp.setPipeline(bgPL); rp.setBindGroup(0, bgBG); rp.draw(6);
    rp.setPipeline(flPL); rp.setBindGroup(0, rBG); rp.setVertexBuffer(0, vBuf); rp.setIndexBuffer(iBuf, 'uint32'); rp.drawIndexed(fl.iCount);
    rp.end();

    dev.queue.submit([enc.finish()]);
    pp = (pp + 1) % 3;
    requestAnimationFrame(frame);
  }

  console.log('🌺 花朵 v3 启动！');
  requestAnimationFrame(frame);
}

main().catch(e => console.error('❌', e));