# Changelog

## [v0.3.3] — 2026-06-02

### 改进
- **卡片布局重写**：精简三行结构，突出今日用量 + 装饰进度条
- **视觉优化**：青柠绿光晕体系——卡片、图标、进度条、时间文字、用量 pill 统一发光
- **新鲜度视觉区分**：1小时内亮绿发光，超过1小时变灰暗淡
- **时间格式**：完整中文表述（刚刚 / 42秒前 / 5分钟前 / 3小时前 / 2天前）

### Mimo Cookie 流程优化
- **关闭自动提取**：打开配置弹窗不再自动打开浏览器 + 自动提取 Cookie
- **手动确认**：提取后不自动保存，需用户点击"保存"按钮确认

## [v0.3.2] — 2026-06-01

### 修复
- **窗口圆角透明**：移除 Electron 主进程 `backgroundColor`，圆角边缘不再显示黑色/深绿底色
- 背景色从 `body` 移至 `#app`，`body`/`html` 设置为 `transparent`

### 新增
- **窗口彩虹呼吸边框**：2px 半透明彩虹渐变边框，跑马灯动画滚动
- 使用 `repeating-linear-gradient` + `mask` 实现，不影响窗口内容和交互

---

## [v0.3.1] — 2026-05-31

### 改进
- **安全重构**：API Key 配置迁移到 `~/.config/api-panel/keys.json`，不再写死在项目目录
- 初次启动自动从旧路径迁移配置（`config/keys.json` → `~/.config/api-panel/keys.json`）
- `config/keys.json` 加入 `.gitignore`，防止敏感数据误提交
- 窗口状态文件统一到 `~/.config/api-panel/state.json`
- 应用图标改为透明底 + 青柠绿闪电标志
- 页脚文案更新为实际配置路径
- **控制台链接用系统默认浏览器打开**（`shell.openExternal`），非 Electron 内嵌窗口

### 新增 — Lumai 详细数据
- **实时今日用量**：请求数、输入/输出/缓存 Token（来自 `usage.today`）
- **按模型拆分**：每个模型的请求次数、消耗金额（如 opus-4-7 / sonnet-4-6）
- **终身累计**：总请求、总消耗、总 Token 数

---

## [v0.3.0] — 2026-05-31

### 新增
- 打包配置：Linux `.deb` / Windows `.zip` 便携包 / NSIS 安装包
- 应用图标（9 尺寸 PNG + Windows `.ico`）
- 页脚动态显示版本号（IPC `get-version`）
- Linux 桌面入口 `.desktop` 文件

### 重构
- 标准化目录结构：`electron/`（主进程）、`src/`（渲染进程）
- `src/components/`、`src/assets/`、`src/index.html`

---

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
