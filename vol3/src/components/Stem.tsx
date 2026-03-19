'use client';
/**
 * 花茎组件
 */
import * as THREE from 'three';
import { useMemo } from 'react';
import { useStore } from '@/store';

export default function Stem() {
  const stemY = useStore((s) => s.stemY);
  const stemLength = useStore((s) => s.stemLength);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vN;
      void main() {
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vN;
      void main() {
        vec3 col = vec3(0.32, 0.28, 0.42);
        float l = max(dot(vN, normalize(vec3(0.2, 0.8, 0.4))), 0.0);
        col *= 0.35 + l * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }), []);

  return (
    <mesh position={[0, stemY, 0]} material={mat}>
      <cylinderGeometry args={[0.014, 0.026, stemLength, 8, 6]} />
    </mesh>
  );
}