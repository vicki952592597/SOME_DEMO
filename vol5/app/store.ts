'use client';
import { create } from 'zustand';

export interface TulipParams {
  // 生长
  growthProgress: number;    // 0~1 手动控制生长进度 (-1=自动播放)
  autoPlay: boolean;         // 自动播放生长动画
  growthDuration: number;    // 自动播放一个周期秒数
  loopMode: 'once' | 'loop' | 'pingpong';

  // 花瓣
  petalOpenAngle: number;    // 花瓣张开角度 0~1
  petalScale: number;        // 花瓣缩放
  petalCurl: number;         // 花瓣卷曲程度

  // 茎
  stemHeight: number;        // 茎高度系数
  stemBend: number;          // 茎弯曲度

  // 叶片
  leafScale: number;
  leafDroop: number;         // 叶片下垂度

  // 相机
  cameraDistance: number;
  autoRotateSpeed: number;
  mouseParallaxH: number;
  mouseParallaxV: number;
  smoothFactor: number;

  // 光效
  ambientIntensity: number;
  directionalIntensity: number;
  sssStrength: number;

  // 视角
  viewMode: 'showcase' | 'free';

  // 风
  windStrength: number;
  windSpeed: number;

  // 背景
  bgTopColor: string;
  bgBottomColor: string;
}

export const defaultParams: TulipParams = {
  growthProgress: -1,
  autoPlay: true,
  growthDuration: 8.0,
  loopMode: 'loop',

  petalOpenAngle: 0.3,
  petalScale: 1.0,
  petalCurl: 0.4,

  stemHeight: 1.0,
  stemBend: 0.05,

  leafScale: 1.0,
  leafDroop: 0.2,

  cameraDistance: 3.5,
  autoRotateSpeed: 0.01,
  mouseParallaxH: 0.3,
  mouseParallaxV: 0.15,
  smoothFactor: 0.04,

  ambientIntensity: 0.4,
  directionalIntensity: 1.2,
  sssStrength: 0.3,

  viewMode: 'showcase',

  windStrength: 1.0,
  windSpeed: 0.5,

  bgTopColor: '#050510',
  bgBottomColor: '#1a1040',
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