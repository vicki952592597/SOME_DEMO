'use client';
/**
 * 全局可调参数 Store (Zustand)
 * 所有 3D 场景中的可调参数集中管理
 */
import { create } from 'zustand';

export interface FlowerParams {
  // === 花朵 ===
  petalScale: number;       // 花瓣整体缩放 0.5~2.0
  bloomWaveAmp: number;     // 生长波浪幅度 0~0.4
  bloomWaveSpeed: number;   // 生长波浪传播速度 0.5~3.0
  cycleDuration: number;    // 一个周期秒数 2~12
  breatheAmp: number;       // 呼吸幅度 0~0.02
  energyWaveSpeed: number;  // 能量光波速度 0.1~1.5
  energyWaveStrength: number; // 能量光波强度 0~0.5
  fresnelStrength: number;  // 菲涅尔边缘光强度 0~1.0
  coreGlow: number;         // 花心辉光强度 0~1.5

  // === 颜色 ===
  coreColor: [number, number, number];   // 花心颜色
  outerColor: [number, number, number];  // 外层颜色

  // === 相机 ===
  cameraDistance: number;     // 相机距离 1~5
  autoRotateSpeed: number;    // 自转速度 0~0.1
  mouseParallaxH: number;     // 鼠标水平视差强度 0~1.0
  mouseParallaxV: number;     // 鼠标垂直视差强度 0~0.5
  smoothFactor: number;       // 平滑系数 0.01~0.15

  // === 花茎 ===
  stemY: number;              // 花茎Y位置 -1~0
  stemLength: number;         // 花茎长度 0.1~1.5

  // === 背景 ===
  starBrightness: number;     // 星空亮度 0~2.0
  bgGlowStrength: number;    // 背景辉光强度 0~0.3
}

export const defaultParams: FlowerParams = {
  petalScale: 1.0,
  bloomWaveAmp: 0.14,
  bloomWaveSpeed: 1.0,
  cycleDuration: 5.0,
  breatheAmp: 0.004,
  energyWaveSpeed: 0.4,
  energyWaveStrength: 0.22,
  fresnelStrength: 0.38,
  coreGlow: 0.55,
  coreColor: [0.94, 0.86, 0.97],
  outerColor: [0.23, 0.21, 0.50],
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