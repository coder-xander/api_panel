// ⚡ API 聚合面板 — Electron preload 脚本
// 通过 contextBridge 安全暴露 IPC 接口给 Vue 前端

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 获取平台列表（含 masked key、是否已配置等）
  getPlatforms: () => ipcRenderer.invoke('get-platforms'),

  // 刷新单个平台余额
  refreshPlatform: (platId) => ipcRenderer.invoke('refresh-platform', platId),

  // 刷新全部平台余额
  refreshAll: () => ipcRenderer.invoke('refresh-all'),

  // 更新平台配置（alias / key / enabled）
  updatePlatform: (platId, updates) => ipcRenderer.invoke('update-platform', platId, updates),

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
  version: '1.0.0',
});
