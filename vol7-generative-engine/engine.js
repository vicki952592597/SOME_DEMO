
/**
 * engine.js — GPGPU核心 + 数据管线 + 后期处理
 * Ping-pong FBO, GLB点云解析, ACES Tonemapping, Bloom, Afterimage
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  PARTICLE_VERT, PARTICLE_FRAG, QUAD_VERT,
  SIM_FRAG_SHADER, VEL_FRAG_SHADER, FIELD_META,
} from './fields.js';
import { CinematographyEngine } from './camera.js';
import { VJConsole, HandTracker, BezierCurveEngine } from './io.js';

// ============ ACES Filmic Tone Mapping Shader ============
const ACESShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    vec3 ACESFilm(vec3 x){
      float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
      return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
    }
    void main(){
      vec4 col=texture2D(tDiffuse,vUv);
      gl_FragColor=vec4(ACESFilm(col.rgb),col.a);
    }
  `,
};

// Afterimage shader
const AfterimageShader = {
  uniforms: {
    tDiffuse: { value: null },
    tOld: { value: null },
    damp: { value: 0.92 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tOld;
    uniform float damp;
    varying vec2 vUv;
    void main(){
      vec4 newFrame=texture2D(tDiffuse,vUv);
      vec4 oldFrame=texture2D(tOld,vUv);
      gl_FragColor=max(newFrame, oldFrame*damp);
    }
  `,
};

// Custom AfterimagePass
class AfterimagePass extends ShaderPass {
  constructor(damp = 0.92) {
    super(AfterimageShader);
    this.uniforms['damp'].value = damp;
    this.textureOld = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat,
    });
    this.textureComp = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat,
    });
  }
  render(renderer, writeBuffer, readBuffer) {
    // Resize if needed
    if (this.textureOld.width !== readBuffer.width || this.textureOld.height !== readBuffer.height) {
      this.textureOld.setSize(readBuffer.width, readBuffer.height);
      this.textureComp.setSize(readBuffer.width, readBuffer.height);
    }
    this.uniforms['tDiffuse'].value = readBuffer.texture;
    this.uniforms['tOld'].value = this.textureOld.texture;
    renderer.setRenderTarget(this.textureComp);
    this.fsQuad.render(renderer);
    // Swap
    const temp = this.textureOld;
    this.textureOld = this.textureComp;
    this.textureComp = temp;
    // Copy to write
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      this.uniforms['tDiffuse'].value = this.textureOld.texture;
      this.fsQuad.render(renderer);
    }
  }
}

// ============ Main Engine ============
export class GenerativeEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.params = {
      fieldId: 1,
      strength: 1.0,
      frequency: 1.0,
      decay: 0.98,
      custom: 1.0,
      pointSize: 2.0,
      bloomStrength: 0.3,
      bloomRadius: 0.4,
      bloomThreshold: 0.2,
      afterimageDamp: 0.92,
      progress: 0,
    };

    // GPGPU texture size
    this.TEX_WIDTH = 512;
    this.TEX_HEIGHT = 512;
    this.particleCount = this.TEX_WIDTH * this.TEX_HEIGHT; // 262144

    this._initRenderer();
    this._initScene();
    this._initGPGPU();
    this._initPostProcessing();

    // Subsystems
    this.cinematography = new CinematographyEngine(this.camera);
    this.vjConsole = new VJConsole(this);
    this.bezier = new BezierCurveEngine();
    this.handTracker = null;

    // Bezier curves for transitions
    this.bezier.addPreset('fieldTransition', 'spring', 2, false);
    this.bezier.addPreset('bloom', 'smooth', 3, true);

    this._time = 0;
    this._running = false;

    // Auto-cycle state machine
    // Start with 'hold' so the tulip model is visible first, then scatter
    this._cycleTime = 0;
    this._cyclePhase = 'hold';
    this._cycleDurations = { scatter: 6, converge: 4, hold: 3, release: 1.5 };
    this._autoFieldSwitch = true;
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
    this.camera.position.set(0, 0.5, 3);
  }

  _initGPGPU() {
    const W = this.TEX_WIDTH, H = this.TEX_HEIGHT;

    // Create data textures
    const posData = new Float32Array(W * H * 4);
    const velData = new Float32Array(W * H * 4);

    // Initialize with random positions in [-1,1]³
    for (let i = 0; i < W * H; i++) {
      posData[i * 4]     = (Math.random() - 0.5) * 2;
      posData[i * 4 + 1] = (Math.random() - 0.5) * 2;
      posData[i * 4 + 2] = (Math.random() - 0.5) * 2;
      posData[i * 4 + 3] = 1.0; // life
      velData[i * 4]     = 0;
      velData[i * 4 + 1] = 0;
      velData[i * 4 + 2] = 0;
      velData[i * 4 + 3] = 0;
    }

    this._origPosData = new Float32Array(posData);

    // Create FBO ping-pong
    const makeRT = () => new THREE.WebGLRenderTarget(W, H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    this.posRT = [makeRT(), makeRT()];
    this.velRT = [makeRT(), makeRT()];
    this._fboIdx = 0;

    // Upload initial data
    const posTex = new THREE.DataTexture(posData, W, H, THREE.RGBAFormat, THREE.FloatType);
    posTex.needsUpdate = true;
    const velTex = new THREE.DataTexture(velData, W, H, THREE.RGBAFormat, THREE.FloatType);
    velTex.needsUpdate = true;

    // Copy to FBOs
    this._copyToRT(posTex, this.posRT[0]);
    this._copyToRT(posTex, this.posRT[1]);
    this._copyToRT(velTex, this.velRT[0]);
    this._copyToRT(velTex, this.velRT[1]);
    this._copyToRT(posTex, this._originRT); // Origin = initial shape

    // Simulation materials
    const shaderReplace = (src) => src
      .replace(/\{WIDTH\}/g, W.toString())
      .replace(/\{HEIGHT\}/g, H.toString());

    // Origin texture (persistent, stores the target model shape)
    this._originRT = makeRT();

    this._simQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: shaderReplace(SIM_FRAG_SHADER),
        uniforms: {
          uPosTex: { value: null },
          uVelTex: { value: null },
          uOriginTex: { value: null },
          uTime: { value: 0 },
          uDelta: { value: 0.016 },
          uFieldId: { value: 1 },
          uFieldParams: { value: new THREE.Vector4(1, 1, 0.98, 1) },
          uProgress: { value: 0 },
        },
      })
    );

    this._velQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: shaderReplace(VEL_FRAG_SHADER),
        uniforms: {
          uPosTex: { value: null },
          uVelTex: { value: null },
          uOriginTex: { value: null },
          uTime: { value: 0 },
          uDelta: { value: 0.016 },
          uFieldId: { value: 1 },
          uFieldParams: { value: new THREE.Vector4(1, 1, 0.98, 1) },
          uProgress: { value: 0 },
        },
      })
    );

    this._simScene = new THREE.Scene();
    this._simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Particle render — create aRef attribute for texture lookup
    const geo = new THREE.BufferGeometry();
    const refs = new Float32Array(this.particleCount * 2);
    const positions = new Float32Array(this.particleCount * 3);
    for (let i = 0; i < this.particleCount; i++) {
      const x = i % W;
      const y = Math.floor(i / W);
      refs[i * 2]     = (x + 0.5) / W;
      refs[i * 2 + 1] = (y + 0.5) / H;
      positions[i * 3] = positions[i * 3 + 1] = positions[i * 3 + 2] = 0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aRef', new THREE.BufferAttribute(refs, 2));

    this._particleMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uPosTex: { value: null },
        uVelTex: { value: null },
        uPointSize: { value: this.params.pointSize },
        uTime: { value: 0 },
      },
    });

    this._particles = new THREE.Points(geo, this._particleMat);
    this.scene.add(this._particles);
  }

  _copyToRT(texture, rt) {
    // Use a raw shader to preserve float precision (MeshBasicMaterial clamps to [0,1])
    const mat = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`,
      fragmentShader: `
        precision highp float;
        uniform sampler2D tSrc;
        varying vec2 vUv;
        void main(){ gl_FragColor = texture2D(tSrc, vUv); }
      `,
      uniforms: { tSrc: { value: texture } },
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    const scene = new THREE.Scene();
    scene.add(mesh);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.renderer.setRenderTarget(rt);
    this.renderer.render(scene, cam);
    this.renderer.setRenderTarget(null);
    mat.dispose();
    mesh.geometry.dispose();
  }

  _initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Bloom
    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.params.bloomStrength,
      this.params.bloomRadius,
      this.params.bloomThreshold
    );
    this.composer.addPass(this._bloomPass);

    // Afterimage
    this._afterimagePass = new AfterimagePass(this.params.afterimageDamp);
    this.composer.addPass(this._afterimagePass);

    // ACES
    this._acesPass = new ShaderPass(ACESShader);
    this.composer.addPass(this._acesPass);

    // Output
    this.composer.addPass(new OutputPass());
  }

  // ============ GLB 点云加载 ============
  async loadGLB(url) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    const positions = [];
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        const posAttr = child.geometry.getAttribute('position');
        child.updateMatrixWorld(true);
        const matrix = child.matrixWorld;
        const v = new THREE.Vector3();
        for (let i = 0; i < posAttr.count; i++) {
          v.fromBufferAttribute(posAttr, i);
          v.applyMatrix4(matrix);
          positions.push(v.x, v.y, v.z);
        }
      }
    });

    console.log(`[Engine] Loaded GLB: ${positions.length / 3} vertices`);

    // Bounding box normalization
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i+1], z = positions[i+2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    const range = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
    const scale = 2.0 / range;

    // Map to GPGPU texture
    const W = this.TEX_WIDTH, H = this.TEX_HEIGHT;
    const total = W * H;
    const posData = new Float32Array(total * 4);
    const velData = new Float32Array(total * 4);
    const srcCount = positions.length / 3;

    for (let i = 0; i < total; i++) {
      const si = (i % srcCount) * 3;
      posData[i * 4]     = (positions[si]   - cx) * scale;
      posData[i * 4 + 1] = (positions[si+1] - cy) * scale;
      posData[i * 4 + 2] = (positions[si+2] - cz) * scale;
      posData[i * 4 + 3] = 1.0;
      velData[i * 4] = velData[i * 4 + 1] = velData[i * 4 + 2] = velData[i * 4 + 3] = 0;
    }

    this._origPosData = new Float32Array(posData);

    const posTex = new THREE.DataTexture(posData, W, H, THREE.RGBAFormat, THREE.FloatType);
    posTex.needsUpdate = true;
    const velTex = new THREE.DataTexture(velData, W, H, THREE.RGBAFormat, THREE.FloatType);
    velTex.needsUpdate = true;

    this._copyToRT(posTex, this.posRT[0]);
    this._copyToRT(posTex, this.posRT[1]);
    this._copyToRT(velTex, this.velRT[0]);
    this._copyToRT(velTex, this.velRT[1]);
    this._copyToRT(posTex, this._originRT); // Origin = target model shape

    // Frustum fit
    const sphere = new THREE.Sphere(new THREE.Vector3(), 1.2);
    this.cinematography.frustumFit(sphere);

    console.log(`[Engine] Particles mapped: ${total} (source: ${srcCount})`);
  }

  // ============ GPGPU Step ============
  _gpgpuStep(dt) {
    const readIdx = this._fboIdx;
    const writeIdx = 1 - readIdx;
    const p = this.params;

    const fieldParams = new THREE.Vector4(p.strength, p.frequency, p.decay, p.custom);

    // Update velocity
    this._velQuad.material.uniforms.uPosTex.value = this.posRT[readIdx].texture;
    this._velQuad.material.uniforms.uVelTex.value = this.velRT[readIdx].texture;
    this._velQuad.material.uniforms.uOriginTex.value = this._originRT.texture;
    this._velQuad.material.uniforms.uTime.value = this._time;
    this._velQuad.material.uniforms.uDelta.value = dt;
    this._velQuad.material.uniforms.uFieldId.value = p.fieldId;
    this._velQuad.material.uniforms.uFieldParams.value = fieldParams;
    this._velQuad.material.uniforms.uProgress.value = p.progress;

    this._simScene.add(this._velQuad);
    this.renderer.setRenderTarget(this.velRT[writeIdx]);
    this.renderer.render(this._simScene, this._simCamera);
    this._simScene.remove(this._velQuad);

    // Update position
    this._simQuad.material.uniforms.uPosTex.value = this.posRT[readIdx].texture;
    this._simQuad.material.uniforms.uVelTex.value = this.velRT[writeIdx].texture;
    this._simQuad.material.uniforms.uOriginTex.value = this._originRT.texture;
    this._simQuad.material.uniforms.uTime.value = this._time;
    this._simQuad.material.uniforms.uDelta.value = dt;
    this._simQuad.material.uniforms.uFieldId.value = p.fieldId;
    this._simQuad.material.uniforms.uFieldParams.value = fieldParams;
    this._simQuad.material.uniforms.uProgress.value = p.progress;

    this._simScene.add(this._simQuad);
    this.renderer.setRenderTarget(this.posRT[writeIdx]);
    this.renderer.render(this._simScene, this._simCamera);
    this._simScene.remove(this._simQuad);

    this.renderer.setRenderTarget(null);
    this._fboIdx = writeIdx;

    // Update particle uniforms
    this._particleMat.uniforms.uPosTex.value = this.posRT[writeIdx].texture;
    this._particleMat.uniforms.uVelTex.value = this.velRT[writeIdx].texture;
    this._particleMat.uniforms.uPointSize.value = p.pointSize;
    this._particleMat.uniforms.uTime.value = this._time;
  }

  // ============ Public API ============
  setParam(name, value) {
    if (name in this.params) {
      this.params[name] = value;
      // Sync post-processing
      if (name === 'bloomStrength') this._bloomPass.strength = value;
      if (name === 'bloomRadius') this._bloomPass.radius = value;
      if (name === 'bloomThreshold') this._bloomPass.threshold = value;
      if (name === 'afterimageDamp') this._afterimagePass.uniforms['damp'].value = value;
    }
  }

  setCameraSeq(idx) {
    this.cinematography.setSequence(idx);
  }

  resetParticles() {
    const W = this.TEX_WIDTH, H = this.TEX_HEIGHT;
    const posTex = new THREE.DataTexture(new Float32Array(this._origPosData), W, H, THREE.RGBAFormat, THREE.FloatType);
    posTex.needsUpdate = true;
    const velData = new Float32Array(W * H * 4);
    const velTex = new THREE.DataTexture(velData, W, H, THREE.RGBAFormat, THREE.FloatType);
    velTex.needsUpdate = true;
    this._copyToRT(posTex, this.posRT[0]);
    this._copyToRT(posTex, this.posRT[1]);
    this._copyToRT(velTex, this.velRT[0]);
    this._copyToRT(velTex, this.velRT[1]);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(w, h);
    this._bloomPass.resolution.set(w, h);
  }

  // ============ Main Loop ============
  start() {
    this._running = true;
    let prev = performance.now();
    const loop = () => {
      if (!this._running) return;
      requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      this._time += dt;

      // Bezier update
      this.bezier.evaluate('bloom', dt);

      // Auto-cycle state machine
      this._cycleTime += dt;
      const dur = this._cycleDurations[this._cyclePhase];
      const phaseT = Math.min(this._cycleTime / dur, 1);

      if (this._cyclePhase === 'scatter') {
        this.params.progress = 0;
        if (phaseT >= 1) { this._cyclePhase = 'converge'; this._cycleTime = 0; }
      } else if (this._cyclePhase === 'converge') {
        // Smooth ease-in-out from 0 to 1
        const t = phaseT;
        this.params.progress = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
        if (phaseT >= 1) { this._cyclePhase = 'hold'; this._cycleTime = 0; this.params.progress = 1; }
      } else if (this._cyclePhase === 'hold') {
        this.params.progress = 1;
        if (phaseT >= 1) { this._cyclePhase = 'release'; this._cycleTime = 0; }
      } else if (this._cyclePhase === 'release') {
        const t = phaseT;
        this.params.progress = 1 - (t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2);
        if (phaseT >= 1) {
          this._cyclePhase = 'scatter'; this._cycleTime = 0; this.params.progress = 0;
          // Switch to a random field on each new scatter
          if (this._autoFieldSwitch) {
            const newField = Math.floor(Math.random() * 30);
            this.params.fieldId = newField;
            const sel = document.getElementById('vj-field');
            if (sel) sel.value = newField;
          }
        }
      }

      // Hand tracking override
      if (this.handTracker?.active) {
        this.params.progress = this.handTracker.pinchValue;
        this.vjConsole.updatePinch(this.handTracker.pinchValue);
      }

      // GPGPU
      this._gpgpuStep(dt);

      // Camera
      this.cinematography.update(dt);

      // Render with post-processing
      this.composer.render(dt);
    };
    loop();
  }

  stop() { this._running = false; }

  async init(glbUrl) {
    if (glbUrl) await this.loadGLB(glbUrl);

    // VJ Console
    this.vjConsole.create();
    this.vjConsole.populateFields(FIELD_META);
    this.vjConsole.populateCameraSeqs(this.cinematography.getSequences());
    this.vjConsole.show();

    // Resize handler
    window.addEventListener('resize', () => this.resize());

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); this.vjConsole.toggle(); }
      if (e.key === 'c' || e.key === 'C') this.cinematography.nextSequence();
      if (e.key === 'r' || e.key === 'R') this.resetParticles();
      if (e.key >= '0' && e.key <= '9') {
        this.setParam('fieldId', parseInt(e.key) + (e.shiftKey ? 10 : 0) + (e.ctrlKey ? 20 : 0));
      }
    });

    this.start();
    console.log('[Engine] Ready. Press TAB for VJ Console, C for camera, R for reset, 0-9 for fields');
  }
}
