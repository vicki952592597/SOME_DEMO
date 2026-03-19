// 声明 .wgsl 文件为可导入的字符串模块
declare module '*.wgsl?raw' {
  const value: string;
  export default value;
}