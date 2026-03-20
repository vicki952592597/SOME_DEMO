'use client';
import { useRef, useEffect, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/app/store';
import Tulip from './Tulip';

function Background() {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value += dt;
  });
  return (
    <mesh renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={mat}
        depthWrite={false} depthTest={false}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
        `}
        fragmentShader={`
          uniform float uTime;
          varying vec2 vUv;
          float hash(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
          }
          void main() {
            vec2 uv = vUv;
            vec3 top = vec3(0.015, 0.012, 0.045);
            vec3 mid = vec3(0.04, 0.05, 0.10);
            vec3 bot = vec3(0.03, 0.06, 0.03);
            float t = uv.y;
            vec3 col;
            if (t > 0.5) col = mix(mid, top, smoothstep(0.5, 1.0, t));
            else col = mix(bot, mid, smoothstep(0.0, 0.5, t));
            col = mix(vec3(0.015, 0.025, 0.01), col, smoothstep(0.0, 0.12, t));
            vec2 sg = uv * vec2(50.0, 30.0);
            vec2 sc = floor(sg);
            float sr = hash(sc);
            if (sr > 0.93) {
              vec2 sp = fract(sg) - 0.5;
              vec2 so = (vec2(hash(sc + 1.0), hash(sc + 2.0)) - 0.5) * 0.4;
              float sd = length(sp - so);
              float star = smoothstep(0.03, 0.0, sd);
              float tw = sin(uTime * (1.0 + sr * 2.5) + sr * 6.28) * 0.5 + 0.5;
              col += vec3(0.4, 0.45, 0.55) * star * (tw * 0.5 + 0.5) * 0.5 * smoothstep(0.3, 0.7, uv.y);
            }
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function CameraController() {
  const { camera } = useThree();
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame(() => {
    const s = useStore.getState();
    const sm = s.smoothFactor;
    targetRef.current.x += (mouseRef.current.x * s.mouseParallaxH - targetRef.current.x) * sm;
    targetRef.current.y += (-mouseRef.current.y * s.mouseParallaxV - targetRef.current.y) * sm;
    const dist = s.cameraDistance;
    const angle = s.autoRotateSpeed * performance.now() * 0.001;
    camera.position.x = Math.sin(angle + targetRef.current.x) * dist;
    camera.position.z = Math.cos(angle + targetRef.current.x) * dist;
    camera.position.y = 0.15 + targetRef.current.y;
    camera.lookAt(0, 0.1, 0);
  });

  return null;
}

export default function Scene() {
  return (
    <>
      <Background />
      <CameraController />
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 5, 2]} intensity={1.3} color="#fff8f0" />
      <directionalLight position={[-2, 3, -3]} intensity={0.35} color="#c8e0ff" />
      <pointLight position={[0, 0.5, 0.3]} intensity={0.2} color="#ffccdd" distance={3} />
      <Tulip />
    </>
  );
}