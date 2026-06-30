// ⚡ API 聚合面板 — Electron preload 脚本
// 通过 contextBridge 安全暴露 IPC 接口给 Vue 前端

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 获取平台实例列表（每个实例有唯一 id 和 type）
  getPlatforms: () => ipcRenderer.invoke('get-platforms'),

  // 刷新单个平台实例余额
  refreshPlatform: (instanceId) => ipcRenderer.invoke('refresh-platform', instanceId),

  // 刷新全部平台实例余额
  refreshAll: () => ipcRenderer.invoke('refresh-all'),

  // 更新平台实例配置（alias / key / enabled）
  updatePlatform: (instanceId, updates) => ipcRenderer.invoke('update-platform', instanceId, updates),

  // 从 Hermes Agent / OpenClaw 导入 API Key，并保存到 App 自己的 .api_panel.env
  importPlatformCredential: (instanceId, source) => ipcRenderer.invoke('import-platform-credential', instanceId, source),

  // 添加新的平台实例
  addPlatformInstance: (type) => ipcRenderer.invoke('add-platform-instance', type),

  // 移除平台实例（从 config 和 layout 中同时移除）
  removePlatformInstance: (instanceId) => ipcRenderer.invoke('remove-platform-instance', instanceId),

  // ─── 窗口控制（无边框自定义标题栏） ───
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  windowClose: () => ipcRenderer.invoke('window-close'),

  // 窗口状态变化事件
  onWindowMaximized: (callback) => {
    ipcRenderer.on('window:maximized', (_event, maximized) => callback(maximized));
  },

  // 应用信息
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('get-version'),

  // 在系统默认浏览器打开链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // 布局管理
  getLayout: () => ipcRenderer.invoke('get-layout'),
  saveLayout: (layout) => ipcRenderer.invoke('save-layout', layout),
  getPlatformDefs: () => ipcRenderer.invoke('get-platform-defs'),

  // 动态调整窗口高度以适配内容
  resizeToContent: (height) => ipcRenderer.invoke('resize-to-content', height),

  // 检查是否首次启动
  isFirstLaunch: () => ipcRenderer.invoke('is-first-launch'),
});
