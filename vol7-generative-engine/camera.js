
/**
 * camera.js — GSAP程序化运镜系统
 * 15套封闭循环运镜序列 + Frustum Fitting + 动态Min/Max裁剪
 * 所有运镜基于用户实时视线焦点计算相对空间向量
 */
import * as THREE from 'three';

// ============ 运镜序列定义 ============
const SEQUENCES = [
  // 0: Orbit Slow — 经典慢速环绕
  { name:'Orbit Slow', dur:20, fn:(t,R)=>{
    const a=t*Math.PI*2, r=R*1.2;
    return { pos:[Math.sin(a)*r, R*0.3, Math.cos(a)*r], target:[0,0,0] };
  }},
  // 1: Orbit Fast + Elevation
  { name:'Orbit Elevate', dur:12, fn:(t,R)=>{
    const a=t*Math.PI*4, el=Math.sin(t*Math.PI*2)*R*0.6;
    return { pos:[Math.sin(a)*R, el+R*0.2, Math.cos(a)*R], target:[0,el*0.3,0] };
  }},
  // 2: Dolly In — 推进
  { name:'Dolly In', dur:8, fn:(t,R)=>{
    const d = R*2.5*(1-t*0.7);
    return { pos:[0, R*0.15, d], target:[0,0,0] };
  }},
  // 3: Dolly Out — 拉远
  { name:'Dolly Out', dur:8, fn:(t,R)=>{
    const d = R*0.8+t*R*2.0;
    return { pos:[0, R*0.1, d], target:[0,0,0] };
  }},
  // 4: Top Down Spiral
  { name:'Top Spiral', dur:15, fn:(t,R)=>{
    const a=t*Math.PI*6, r=R*0.3+t*R;
    return { pos:[Math.sin(a)*r, R*2.5-t*R*1.5, Math.cos(a)*r], target:[0,0,0] };
  }},
  // 5: Crane Up
  { name:'Crane Up', dur:10, fn:(t,R)=>{
    const h = -R*0.5+t*R*3;
    return { pos:[R*0.8, h, R*0.8], target:[0,h*0.4,0] };
  }},
  // 6: Track Left-Right
  { name:'Track LR', dur:12, fn:(t,R)=>{
    const x = Math.sin(t*Math.PI*2)*R*2;
    return { pos:[x, R*0.3, R*1.5], target:[0,0,0] };
  }},
  // 7: Figure-8
  { name:'Figure 8', dur:16, fn:(t,R)=>{
    const a=t*Math.PI*2;
    return { pos:[Math.sin(a)*R*1.5, R*0.2+Math.sin(a*2)*R*0.3, Math.cos(a)*Math.cos(a)*R*1.5], target:[0,0,0] };
  }},
  // 8: Whip Pan
  { name:'Whip Pan', dur:6, fn:(t,R)=>{
    const a=t*Math.PI*8; // 超快旋转
    return { pos:[Math.sin(a)*R, R*0.2, Math.cos(a)*R], target:[0,0,0] };
  }},
  // 9: Dutch Angle Roll
  { name:'Dutch Roll', dur:14, fn:(t,R)=>{
    const a=t*Math.PI*2;
    return { pos:[Math.sin(a)*R*1.2, R*0.4, Math.cos(a)*R*1.2], target:[0,0,0], roll:Math.sin(t*Math.PI*4)*0.15 };
  }},
  // 10: Macro — 微距推进
  { name:'Macro', dur:10, fn:(t,R)=>{
    const d = R*0.15+Math.sin(t*Math.PI)*R*0.3;
    const a = t*Math.PI*0.5;
    return { pos:[Math.sin(a)*d, R*0.05, Math.cos(a)*d], target:[0,0,0] };
  }},
  // 11: Pendulum Swing
  { name:'Pendulum', dur:10, fn:(t,R)=>{
    const swing = Math.sin(t*Math.PI*4)*0.8;
    return { pos:[Math.sin(swing)*R*1.5, R*0.5, Math.cos(swing)*R*1.5], target:[0,0,0] };
  }},
  // 12: Helical Rise
  { name:'Helix Rise', dur:18, fn:(t,R)=>{
    const a=t*Math.PI*6, h=t*R*3-R;
    return { pos:[Math.sin(a)*R, h, Math.cos(a)*R], target:[0,h*0.5,0] };
  }},
  // 13: Flythrough
  { name:'Flythrough', dur:8, fn:(t,R)=>{
    const z = R*3*(1-t*2);
    return { pos:[Math.sin(t*3)*R*0.3, Math.cos(t*5)*R*0.2, z], target:[0,0,z-R] };
  }},
  // 14: Static Contemplation — 静态微动
  { name:'Contemplate', dur:25, fn:(t,R)=>{
    const breathe = Math.sin(t*Math.PI*2)*0.02;
    return { pos:[R*0.8+breathe*R, R*0.3+breathe*R*0.5, R*1.2+breathe*R], target:[0,breathe*R*0.3,0] };
  }},
];

export class CinematographyEngine {
  constructor(camera, target = new THREE.Vector3()) {
    this.camera = camera;
    this.target = target;
    this.enabled = true;
    this.currentSeq = 0;
    this.seqTime = 0;
    this.radius = 2.0; // 默认 Frustum Fitting 半径
    this.transitionDur = 2.0;
    this.transitioning = false;
    this.transFrom = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
    this.transTo = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
    this.transProgress = 0;

    // 摄像机空间裁剪边界
    this.minDist = 0.1;
    this.maxDist = 50;
    this.minHeight = -10;
    this.maxHeight = 20;

    // 平滑
    this._smoothPos = camera.position.clone();
    this._smoothTarget = target.clone();
    this._smoothFactor = 0.04;

    // VJ override
    this.vjOverride = null; // { pos, target, progress }
    this.vjBlend = 0;
  }

  // Frustum Fitting: 根据目标bounding sphere计算最优距离
  frustumFit(boundingSphere) {
    const fov = this.camera.fov * Math.PI / 180;
    const aspect = this.camera.aspect;
    const halfFov = fov / 2;
    const halfFovH = Math.atan(Math.tan(halfFov) * aspect);
    const minHalfFov = Math.min(halfFov, halfFovH);
    this.radius = boundingSphere.radius / Math.sin(minHalfFov);
    this.radius = Math.max(this.minDist * 2, Math.min(this.radius, this.maxDist * 0.8));
  }

  setSequence(index) {
    if (index === this.currentSeq) return;
    // 平滑过渡
    this.transitioning = true;
    this.transProgress = 0;
    this.transFrom.pos.copy(this.camera.position);
    this.transFrom.target.copy(this.target);
    this.currentSeq = index % SEQUENCES.length;
  }

  nextSequence() {
    this.setSequence((this.currentSeq + 1) % SEQUENCES.length);
  }

  update(dt, focusPoint) {
    if (!this.enabled) return;

    this.seqTime += dt;
    const seq = SEQUENCES[this.currentSeq];
    const loopT = (this.seqTime % seq.dur) / seq.dur;

    // 焦点偏移: 所有运镜相对用户焦点计算
    const focus = focusPoint || this.target;

    const result = seq.fn(loopT, this.radius);
    let desiredPos = new THREE.Vector3(
      result.pos[0] + focus.x,
      result.pos[1] + focus.y,
      result.pos[2] + focus.z
    );
    let desiredTarget = new THREE.Vector3(
      result.target[0] + focus.x,
      result.target[1] + focus.y,
      result.target[2] + focus.z
    );

    // 空间裁剪
    const dist = desiredPos.distanceTo(desiredTarget);
    if (dist < this.minDist) desiredPos.add(desiredPos.clone().sub(desiredTarget).normalize().multiplyScalar(this.minDist - dist));
    if (dist > this.maxDist) desiredPos.copy(desiredTarget).add(desiredPos.clone().sub(desiredTarget).normalize().multiplyScalar(this.maxDist));
    desiredPos.y = Math.max(this.minHeight, Math.min(this.maxHeight, desiredPos.y));

    // 过渡混合
    if (this.transitioning) {
      this.transProgress += dt / this.transitionDur;
      if (this.transProgress >= 1) {
        this.transitioning = false;
        this.transProgress = 1;
      }
      const t = this._easeInOut(this.transProgress);
      desiredPos.lerpVectors(this.transFrom.pos, desiredPos, t);
      desiredTarget.lerpVectors(this.transFrom.target, desiredTarget, t);
    }

    // VJ Override blend
    if (this.vjOverride && this.vjBlend > 0) {
      const vp = new THREE.Vector3().fromArray(this.vjOverride.pos);
      const vt = new THREE.Vector3().fromArray(this.vjOverride.target);
      desiredPos.lerp(vp, this.vjBlend);
      desiredTarget.lerp(vt, this.vjBlend);
    }

    // 平滑插值
    this._smoothPos.lerp(desiredPos, this._smoothFactor);
    this._smoothTarget.lerp(desiredTarget, this._smoothFactor);

    this.camera.position.copy(this._smoothPos);
    this.camera.lookAt(this._smoothTarget);
    this.target.copy(this._smoothTarget);

    // Dutch angle roll
    if (result.roll) {
      this.camera.rotation.z += result.roll;
    }
  }

  _easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  getSequences() { return SEQUENCES.map((s, i) => ({ id: i, name: s.name })); }
  getCurrentSequence() { return this.currentSeq; }
}
