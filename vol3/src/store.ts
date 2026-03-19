'use client';
/**
 * 全局可调参数 Store (Zustand)
 * 所有 3D 场景中的可调参数集中管理
 */
import { create } from 'zustand';

export interface FlowerParams {
  // === 花朵造型 ===
  petalScale: number;        // 花瓣整体缩放 0.3~2.0
  petalLength: number;       // 花瓣长度系数 0.3~2.0
  petalWidth: number;        // 花瓣宽度系数 0.3~2.0
  ballRadius: number;        // 球体分布半径 0.05~0.35
  openAngleScale: number;    // 花瓣张开角度系数 0.3~2.0 (越大越展开)
  curlAmount: number;        // 花瓣卷曲程度 0~1.5

  // === 动画 ===
  bloomWaveAmp: number;      // 生长波浪幅度 0~0.5
  bloomWaveSpeed: number;    // 传播速度系数 0.2~3.0 (未直接使用, 通过cycleDuration)
  cycleDuration: number;     // 一个周期秒数 2~15
  breatheAmp: number;        // 呼吸幅度 0~0.03
  radialPulse: number;       // 径向脉冲幅度 0~0.08

  // === 光效 ===
  energyWaveSpeed: number;   // 能量光波速度 0.05~2.0
  energyWaveStrength: number;// 能量光波强度 0~1.0
  fresnelStrength: number;   // 菲涅尔边缘光强度 0~1.5
  coreGlow: number;          // 花心辉光强度 0~2.0
  specularStr: number;       // 高光强度 0~0.5
  sssStrength: number;       // SSS 次表面散射强度 0~0.8

  // === 相机 ===
  cameraDistance: number;
  autoRotateSpeed: number;
  mouseParallaxH: number;
  mouseParallaxV: number;
  smoothFactor: number;

  // === 花茎 ===
  stemY: number;
  stemLength: number;

  // === 背景 ===
  starBrightness: number;
  bgGlowStrength: number;
}

export const defaultParams: FlowerParams = {
  petalScale: 1.0,
  petalLength: 1.0,
  petalWidth: 1.0,
  ballRadius: 0.14,
  openAngleScale: 1.0,
  curlAmount: 0.45,

  bloomWaveAmp: 0.14,
  bloomWaveSpeed: 1.0,
  cycleDuration: 5.0,
  breatheAmp: 0.004,
  radialPulse: 0.025,

  energyWaveSpeed: 0.4,
  energyWaveStrength: 0.22,
  fresnelStrength: 0.38,
  coreGlow: 0.55,
  specularStr: 0.14,
  sssStrength: 0.25,

  cameraDistance: 2.2,
  autoRotateSpeed: 0.015,
  mouseParallaxH: 0.45,
  mouseParallaxV: 0.2,
  smoothFactor: 0.04,

  stemY: -0.28,
  stemLength: 0.55,

  starBrightness: 1.0,
  bgGlowStrength: 0.04,
};

interface Store extends FlowerParams {
  set: (partial: Partial<FlowerParams>) => void;
  reset: () => void;
}

export const useStore = create<Store>((set) => ({
  ...defaultParams,
  set: (partial) => set(partial),
  reset: () => set(defaultParams),
}));