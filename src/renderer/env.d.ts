// 全局 window.kpAPI 类型声明
// 直接引用 preload.ts 导出的 KpAPI 类型，保证类型同步
declare global {
  interface Window {
    kpAPI: import('../main/preload').KpAPI
  }
}

export {}
