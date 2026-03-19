'use client';
/**
 * 全屏渐变背景 + 星点
 * 参考图：顶部深蓝黑 → 中部深靛蓝 → 底部蓝紫
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function Background() {
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.9999, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      void main() {
        vec2 uv = vUv;
        vec3 top = vec3(0.018, 0.018, 0.058);
        vec3 mid = vec3(0.048, 0.042, 0.185);
        vec3 bot = vec3(0.148, 0.118, 0.365);
        float t = uv.y;
        vec3 col = t > 0.5
          ? mix(mid, top, smoothstep(0.5, 1.0, t))
          : mix(bot, mid, smoothstep(0.0, 0.5, t));
        float cd = length(vec2(uv.x - 0.5, (uv.y - 0.5) * 1.4));
        col += vec3(0.05, 0.04, 0.12) * exp(-cd * cd * 5.0);
        vec2 sg = uv * vec2(85.0, 48.0);
        vec2 sc = floor(sg);
        float sr = hash(sc);
        if (sr > 0.965) {
          vec2 sp = fract(sg) - 0.5;
          vec2 so = (vec2(hash(sc + 1.0), hash(sc + 2.0)) - 0.5) * 0.5;
          float sd = length(sp - so);
          float star = smoothstep(0.025, 0.0, sd);
          float tw = sin(uTime * (1.5 + sr * 3.0) + sr * 6.28) * 0.5 + 0.5;
          col += vec3(0.5, 0.5, 0.7) * star * (tw * 0.4 + 0.6) * 0.3;
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  }), []);

  useFrame((_, delta) => {
    mat.uniforms.uTime.value += delta;
  });

  return (
    <mesh renderOrder={-1} frustumCulled={false} material={mat}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}