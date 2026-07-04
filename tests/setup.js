// 测试设置文件 — 操作 window 环境

// 模拟 electronAPI
window.electronAPI = {
  getVersion: () => Promise.resolve('0.0.0'),
  getPlatforms: () => Promise.resolve([]),
  getLayout: () => Promise.resolve([]),
  getPlatformDefs: () => Promise.resolve({}),
  saveLayout: () => Promise.resolve({}),
  refreshPlatform: () => Promise.resolve({}),
  addPlatformInstance: () => Promise.resolve({}),
  removePlatformInstance: () => Promise.resolve({}),
  updatePlatform: () => Promise.resolve({}),
  importPlatformCredential: () => Promise.resolve({}),
  saveLanguage: () => Promise.resolve(),
  onWindowMaximized: () => {},
  windowMinimize: () => {},
  windowMaximize: () => {},
  windowClose: () => {},
  resizeToContent: () => {},
  get: () => Promise.resolve({}),
};

// Vue 全局组件 (已由 index.html 测试)
// 现在简单起见，各自外挂到 window/__COMPONENTS__ 上在测试时读取
globalThis.__COMPONENTS__ = {};
