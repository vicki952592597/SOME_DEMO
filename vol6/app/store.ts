'use client';
import { create } from 'zustand';

export interface TulipParams {
  // 生长动画
  growthProgress: number;
  autoPlay: boolean;
  growthDuration: number;
  loopMode: 'once' | 'loop' | 'pingpong';

  // 花瓣造型
  petalCount: number;
  petalLayers: number;
  petalLength: number;
  petalWidth: number;
  petalThickness: number;
  petalCurl: number;
  petalOpenAngle: number;
  petalTipBend: number;
  petalRoundness: number;

  // 茎
  stemHeight: number;
  stemRadius: number;
  stemBend: number;
  stemSegments: number;

  // 叶片
  leafCount: number;
  leafLength: number;
  leafWidth: number;
  leafDroop: number;
  leafCurl: number;

  // 花萼
  sepalCount: number;
  sepalLength: number;
  sepalWidth: number;

  // 颜色
  petalColorInner: string;
  petalColorOuter: string;
  petalColorBase: string;
  stemColor: string;
  leafColor: string;

  // 光效
  fresnelStrength: number;
  sssStrength: number;
  specularStr: number;

  // 相机
  cameraDistance: number;
  autoRotateSpeed: number;
  mouseParallaxH: number;
  mouseParallaxV: number;
  smoothFactor: number;

  // 风
  windStrength: number;
  windSpeed: number;
}

export const defaultParams: TulipParams = {
  growthProgress: -1,
  autoPlay: true,
  growthDuration: 10.0,
  loopMode: 'pingpong',

  petalCount: 6,
  petalLayers: 2,
  petalLength: 0.22,
  petalWidth: 0.12,
  petalThickness: 0.008,
  petalCurl: 0.35,
  petalOpenAngle: 0.25,
  petalTipBend: 0.15,
  petalRoundness: 0.7,

  stemHeight: 0.42,
  stemRadius: 0.012,
  stemBend: 0.03,
  stemSegments: 12,

  leafCount: 2,
  leafLength: 0.30,
  leafWidth: 0.10,
  leafDroop: 0.3,
  leafCurl: 0.2,

  sepalCount: 3,
  sepalLength: 0.08,
  sepalWidth: 0.03,

  petalColorInner: '#f8b4c8',
  petalColorOuter: '#e8708a',
  petalColorBase: '#f0e8d8',
  stemColor: '#3a6b2a',
  leafColor: '#2d5a1e',

  fresnelStrength: 0.3,
  sssStrength: 0.25,
  specularStr: 0.15,

  cameraDistance: 1.8,
  autoRotateSpeed: 0.008,
  mouseParallaxH: 0.3,
  mouseParallaxV: 0.15,
  smoothFactor: 0.04,

  windStrength: 1.0,
  windSpeed: 0.5,
};

interface Store extends TulipParams {
  set: (partial: Partial<TulipParams>) => void;
  reset: () => void;
}

export const useStore = create<Store>((set) => ({
  ...defaultParams,
  set: (partial) => set(partial),
  reset: () => set(defaultParams),
}));