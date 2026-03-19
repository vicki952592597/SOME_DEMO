'use client';
/**
 * ============================================================
 * 流体鼠标扭曲后处理 (FluidDistortion.tsx)
 * ============================================================
 * 1. 使用 useFBO 创建离屏 RenderTarget，绘制鼠标轨迹
 * 2. 轨迹通过反馈循环(Feedback Loop)产生拖尾效果
 * 3. 将轨迹纹理作为 UV 扰动应用到主画面
 *
 * 使用 @react-three/postprocessing 的自定义 Effect
 */
import { useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree, createPortal } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import * as THREE from 'three';

/**
 * 这个组件不直接渲染可见内容。
 * 它管理一个离屏 FBO 用来画鼠标轨迹，
 * 并暴露 distortionTexture 供后处理使用。
 */
export function useFluidTexture() {
  const { gl, size, viewport } = useThree();

  // 两个 FBO 做 Ping-Pong
  const fboA = useFBO(512, 512, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType });
  const fboB = useFBO(512, 512, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType });
  const pingPong = useRef(0);

  // 正交相机 + 场景（离屏渲染用）
  const orthoCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const offScene = useMemo(() => new THREE.Scene(), []);

  // 鼠标位置（归一化到 [-1, 1]）
  const mouse = useRef(new THREE.Vector2(9999, 9999));
  const prevMouse = useRef(new THREE.Vector2(9999, 9999));

  // 监听鼠标
  const onPointerMove = useCallback((e: PointerEvent) => {
    mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }, []);

  // 挂载/卸载事件
  useMemo(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', onPointerMove);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointermove', onPointerMove);
      }
    };
  }, [onPointerMove]);

  // 笔刷材质：在鼠标位置画一个柔和的圆
  const brushMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    uniforms: {
      uMouse: { value: new THREE.Vector2() },
      uPrevMouse: { value: new THREE.Vector2() },
      uVelocity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: `
      uniform vec2 uMouse;
      uniform vec2 uPrevMouse;
      uniform float uVelocity;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        float dist = length(uv - uMouse);
        float brush = exp(-dist * dist * 40.0) * uVelocity;
        // 将鼠标移动方向编码到 RG 通道
        vec2 dir = normalize(uMouse - uPrevMouse + 0.001);
        gl_FragColor = vec4(dir * brush * 0.3, brush * 0.1, 1.0);
      }`,
  }), []);

  // 反馈材质：将上一帧的结果缩放并衰减
  const feedbackMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    uniforms: {
      uPrevFrame: { value: null as THREE.Texture | null },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uPrevFrame;
      varying vec2 vUv;
      void main() {
        // 略微向中心收缩（产生扩散效果）
        vec2 uv = (vUv - 0.5) * 0.995 + 0.5;
        vec4 prev = texture2D(uPrevFrame, uv);
        // 衰减
        gl_FragColor = prev * 0.94;
      }`,
  }), []);

  // 离屏几何体
  const quad = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  const brushMesh = useMemo(() => {
    const m = new THREE.Mesh(quad, brushMat);
    return m;
  }, [quad, brushMat]);
  const feedbackMesh = useMemo(() => {
    const m = new THREE.Mesh(quad, feedbackMat);
    return m;
  }, [quad, feedbackMat]);

  // 每帧更新
  useFrame(() => {
    const currentFBO = pingPong.current === 0 ? fboA : fboB;
    const prevFBO = pingPong.current === 0 ? fboB : fboA;

    // 计算鼠标速度
    const dx = mouse.current.x - prevMouse.current.x;
    const dy = mouse.current.y - prevMouse.current.y;
    const velocity = Math.min(Math.sqrt(dx * dx + dy * dy) * 8.0, 1.0);

    // 更新笔刷 uniform
    brushMat.uniforms.uMouse.value.copy(mouse.current);
    brushMat.uniforms.uPrevMouse.value.copy(prevMouse.current);
    brushMat.uniforms.uVelocity.value = velocity;

    // 更新反馈 uniform
    feedbackMat.uniforms.uPrevFrame.value = prevFBO.texture;

    // 渲染到当前 FBO
    gl.setRenderTarget(currentFBO);
    gl.clear();

    // 先画反馈（上一帧衰减后的结果）
    offScene.children.length = 0;
    offScene.add(feedbackMesh);
    gl.render(offScene, orthoCamera);

    // 再叠加笔刷
    offScene.children.length = 0;
    offScene.add(brushMesh);
    gl.render(offScene, orthoCamera);

    gl.setRenderTarget(null);

    prevMouse.current.copy(mouse.current);
    pingPong.current = 1 - pingPong.current;
  });

  // 返回当前可读的 FBO texture
  return () => {
    return pingPong.current === 0 ? fboB.texture : fboA.texture;
  };
}

/**
 * 后处理扭曲效果组件
 * 读取流体纹理的 RG 通道作为 UV 偏移
 */
export function DistortionPass({ getTexture }: { getTexture: () => THREE.Texture }) {
  const { gl, scene, camera, size } = useThree();

  const composer = useMemo(() => {
    const comp = new EffectComposer(gl);
    comp.addPass(new RenderPass(scene, camera));

    const distortPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        tDistortion: { value: null },
        uStrength: { value: 0.04 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDistortion;
        uniform float uStrength;
        varying vec2 vUv;
        void main() {
          vec4 dist = texture2D(tDistortion, vUv);
          vec2 offset = dist.rg * uStrength;
          vec4 color = texture2D(tDiffuse, vUv + offset);
          gl_FragColor = color;
        }`,
    });
    comp.addPass(distortPass);

    return { comp, distortPass };
  }, [gl, scene, camera]);

  // 响应 resize
  useMemo(() => {
    composer.comp.setSize(size.width, size.height);
  }, [size, composer]);

  useFrame(() => {
    // 更新扭曲纹理
    (composer.distortPass as any).uniforms.tDistortion.value = getTexture();
    composer.comp.render();
  }, 1); // priority=1，在默认渲染之后

  return null;
}