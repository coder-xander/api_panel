# Changelog

## [v0.2.0] — 2026-05-31

### 重构
- Vue 3 组件化：拆出 `PlatformCard` / `SettingsModal` 两个独立组件
- HTML 模板全部迁入 Vue `template` 选项，`index.html` 仅留 `<div id="app">` 挂载点

### 移除
- 删除 8 个调试/测试文件（debug.html、test*.html、app-debug.js 等）

---

## [v0.1.0] — 2026-05-31

### 新增
- 多平台 API 余额查询：DeepSeek / Kimi CN / 小米 MiMo / Lumai
- 自定义无边框暗色窗口 (Electron + Vue 3)
- 暗色滚动条样式，与霓虹绿主题融为一体
- 窗口状态持久化 (位置/大小/最大化 → `~/.config/api-panel-state.json`)
- 自动从 Hermes `.env` 注入 API Key
- 每 30 分钟自动刷新余额
- 余额明细展示 (赠送/充值/代金券/现金)
- Lumai 今日用量统计 (请求数/消耗/实际扣费)
- 平台设置弹窗 (别名/API Key)
- 窗口控制按钮 (最小化/最大化/关闭)
- 一键直达各平台网页控制台
