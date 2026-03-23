
/**
 * io.js — 状态机与现场交互
 * MediaPipe手部关键点 + Bezier曲线引擎 + VJ控制台
 */

// ============ Bezier 曲线引擎 ============
export class BezierCurveEngine {
  constructor() {
    this.curves = new Map(); // name -> { points, duration, loop, current }
  }

  // 三次贝塞尔
  static cubicBezier(t, p0, p1, p2, p3) {
    const t2 = t * t, t3 = t2 * t;
    const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt;
    return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3;
  }

  // CSS ease presets
  static PRESETS = {
    linear:     [0, 0, 1, 1],
    ease:       [0.25, 0.1, 0.25, 1],
    easeIn:     [0.42, 0, 1, 1],
    easeOut:    [0, 0, 0.58, 1],
    easeInOut:  [0.42, 0, 0.58, 1],
    spring:     [0.175, 0.885, 0.32, 1.275],
    bounce:     [0.68, -0.55, 0.265, 1.55],
    smooth:     [0.4, 0, 0.2, 1],
    snap:       [0.075, 0.82, 0.165, 1],
  };

  addCurve(name, { p1x, p1y, p2x, p2y, duration = 1, loop = false } = {}) {
    this.curves.set(name, {
      points: [p1x, p1y, p2x, p2y],
      duration, loop, time: 0, value: 0,
    });
  }

  addPreset(name, presetName, duration = 1, loop = false) {
    const p = BezierCurveEngine.PRESETS[presetName] || BezierCurveEngine.PRESETS.ease;
    this.addCurve(name, { p1x: p[0], p1y: p[1], p2x: p[2], p2y: p[3], duration, loop });
  }

  // 牛顿法求解 t → x 的反函数
  _solveCurveX(x, p1x, p2x) {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const ct = 3*((1-t)*(1-t))*t*p1x + 3*(1-t)*t*t*p2x + t*t*t;
      const d = 3*(1-t)*(1-t)*p1x + 6*(1-t)*t*(p2x-p1x) + 3*t*t*(1-p2x);
      if (Math.abs(d) < 1e-6) break;
      t -= (ct - x) / d;
      t = Math.max(0, Math.min(1, t));
    }
    return t;
  }

  evaluate(name, dt) {
    const c = this.curves.get(name);
    if (!c) return 0;
    c.time += dt;
    let progress = c.time / c.duration;
    if (c.loop) progress = progress % 1;
    else progress = Math.min(progress, 1);
    const t = this._solveCurveX(progress, c.points[0], c.points[2]);
    c.value = BezierCurveEngine.cubicBezier(t, 0, c.points[1], c.points[3], 1);
    return c.value;
  }

  getValue(name) {
    return this.curves.get(name)?.value || 0;
  }

  reset(name) {
    const c = this.curves.get(name);
    if (c) { c.time = 0; c.value = 0; }
  }
}

// ============ MediaPipe 手势识别 ============
export class HandTracker {
  constructor(onGesture) {
    this.onGesture = onGesture;
    this.active = false;
    this.pinchValue = 0;      // 0~1 归一化
    this.palmCenter = [0, 0]; // 归一化屏幕坐标
    this.video = null;
    this.hands = null;
    this._lastPinchDist = 0;
  }

  async init() {
    try {
      // 动态导入 MediaPipe
      const { Hands } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js');
      const { Camera } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js');

      this.video = document.createElement('video');
      this.video.style.display = 'none';
      document.body.appendChild(this.video);

      this.hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`
      });
      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      this.hands.onResults((results) => this._onResults(results));

      const camera = new Camera(this.video, {
        onFrame: async () => { await this.hands.send({ image: this.video }); },
        width: 320, height: 240,
      });
      await camera.start();
      this.active = true;
      console.log('[HandTracker] Started');
    } catch (e) {
      console.warn('[HandTracker] MediaPipe not available:', e.message);
      this.active = false;
    }
  }

  _onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.pinchValue = 0;
      return;
    }
    const lm = results.multiHandLandmarks[0];
    // Pinch: 拇指尖(4) vs 食指尖(8) 的欧氏距离
    const thumb = lm[4];
    const index = lm[8];
    const dx = thumb.x - index.x;
    const dy = thumb.y - index.y;
    const dz = thumb.z - index.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // 归一化: 0.02 = 完全捏合, 0.15 = 完全张开
    this.pinchValue = 1 - Math.min(Math.max((dist - 0.02) / 0.13, 0), 1);
    // 手掌中心 (landmark 9)
    this.palmCenter = [lm[9].x, lm[9].y];

    if (this.onGesture) {
      this.onGesture({
        pinch: this.pinchValue,
        palm: this.palmCenter,
      });
    }
  }

  destroy() {
    if (this.video) this.video.remove();
    this.active = false;
  }
}

// ============ VJ 控制台 ============
export class VJConsole {
  constructor(engine) {
    this.engine = engine; // engine.js 实例
    this.dom = null;
    this.visible = false;
    this.bindings = new Map(); // uniform name -> { slider, value }
  }

  create() {
    if (this.dom) return;
    this.dom = document.createElement('div');
    this.dom.id = 'vj-console';
    this.dom.innerHTML = `
      <div class="vj-header">
        <span>🎛️ VJ CONSOLE</span>
        <button id="vj-close">✕</button>
      </div>
      <div class="vj-body">
        <div class="vj-section">
          <label>🎯 Vector Field</label>
          <select id="vj-field"></select>
        </div>
        <div class="vj-section">
          <label>⚡ Strength</label>
          <input type="range" id="vj-strength" min="0" max="5" step="0.01" value="1">
          <span id="vj-strength-val">1.00</span>
        </div>
        <div class="vj-section">
          <label>🔄 Frequency</label>
          <input type="range" id="vj-freq" min="0.1" max="10" step="0.1" value="1">
          <span id="vj-freq-val">1.0</span>
        </div>
        <div class="vj-section">
          <label>🌊 Decay</label>
          <input type="range" id="vj-decay" min="0" max="5" step="0.05" value="0.98">
          <span id="vj-decay-val">0.98</span>
        </div>
        <div class="vj-section">
          <label>📐 Custom</label>
          <input type="range" id="vj-custom" min="0" max="5" step="0.05" value="1">
          <span id="vj-custom-val">1.00</span>
        </div>
        <div class="vj-section">
          <label>📹 Camera Seq</label>
          <select id="vj-camera"></select>
        </div>
        <div class="vj-section">
          <label>🔵 Point Size</label>
          <input type="range" id="vj-pointsize" min="0.5" max="8" step="0.1" value="2">
          <span id="vj-pointsize-val">2.0</span>
        </div>
        <div class="vj-section">
          <label>🌸 Bloom</label>
          <input type="range" id="vj-bloom" min="0" max="5" step="0.1" value="0.3">
          <span id="vj-bloom-val">0.3</span>
        </div>
        <div class="vj-section">
          <label>👁️ Afterimage</label>
          <input type="range" id="vj-afterimage" min="0" max="0.99" step="0.01" value="0.92">
          <span id="vj-afterimage-val">0.92</span>
        </div>
        <div class="vj-section">
          <label>⏱️ Progress</label>
          <input type="range" id="vj-progress" min="0" max="1" step="0.001" value="0">
          <span id="vj-progress-val">0.000</span>
        </div>
        <div class="vj-section">
          <label>✋ Hand Tracking</label>
          <button id="vj-hand-toggle">OFF</button>
          <span id="vj-pinch-val" style="margin-left:8px">Pinch: --</span>
        </div>
        <div class="vj-section">
          <button id="vj-reset" style="width:100%">🔄 Reset Particles</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.dom);
    this._bindEvents();
  }

  _bindEvents() {
    const $ = (id) => document.getElementById(id);
    $('vj-close').onclick = () => this.toggle();

    // Sliders
    const sliders = [
      ['vj-strength', 'vj-strength-val', 'strength', v=>parseFloat(v).toFixed(2)],
      ['vj-freq', 'vj-freq-val', 'frequency', v=>parseFloat(v).toFixed(1)],
      ['vj-decay', 'vj-decay-val', 'decay', v=>parseFloat(v).toFixed(2)],
      ['vj-custom', 'vj-custom-val', 'custom', v=>parseFloat(v).toFixed(2)],
      ['vj-pointsize', 'vj-pointsize-val', 'pointSize', v=>parseFloat(v).toFixed(1)],
      ['vj-bloom', 'vj-bloom-val', 'bloomStrength', v=>parseFloat(v).toFixed(1)],
      ['vj-afterimage', 'vj-afterimage-val', 'afterimageDamp', v=>parseFloat(v).toFixed(2)],
      ['vj-progress', 'vj-progress-val', 'progress', v=>parseFloat(v).toFixed(3)],
    ];
    sliders.forEach(([sliderId, valId, param, fmt]) => {
      const slider = $(sliderId);
      const valSpan = $(valId);
      slider.addEventListener('input', () => {
        valSpan.textContent = fmt(slider.value);
        if (this.engine && this.engine.setParam) {
          this.engine.setParam(param, parseFloat(slider.value));
        }
      });
    });

    $('vj-reset').onclick = () => { if (this.engine?.resetParticles) this.engine.resetParticles(); };
  }

  populateFields(fieldMeta) {
    const sel = document.getElementById('vj-field');
    if (!sel) return;
    sel.innerHTML = fieldMeta.map(f => `<option value="${f.id}">${f.id}: ${f.name}</option>`).join('');
    sel.onchange = () => {
      if (this.engine?.setParam) this.engine.setParam('fieldId', parseInt(sel.value));
    };
  }

  populateCameraSeqs(seqs) {
    const sel = document.getElementById('vj-camera');
    if (!sel) return;
    sel.innerHTML = seqs.map(s => `<option value="${s.id}">${s.id}: ${s.name}</option>`).join('');
    sel.onchange = () => {
      if (this.engine?.setCameraSeq) this.engine.setCameraSeq(parseInt(sel.value));
    };
  }

  updatePinch(val) {
    const el = document.getElementById('vj-pinch-val');
    if (el) el.textContent = `Pinch: ${val.toFixed(2)}`;
  }

  toggle() {
    this.visible = !this.visible;
    if (this.dom) this.dom.style.display = this.visible ? 'block' : 'none';
  }

  show() { this.visible = true; if (this.dom) this.dom.style.display = 'block'; }
  hide() { this.visible = false; if (this.dom) this.dom.style.display = 'none'; }
}
