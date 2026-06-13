# ⚡ API 聚合面板

多平台 AI API 余额/用量一站式查询面板。支持 DeepSeek、Kimi CN、小米 MiMo、Lumai 四个平台。

![暗色主题](https://img.shields.io/badge/theme-dark-%230a0f0a?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiByeD0iNCIgZmlsbD0iIzBhMGYwYSIvPjxyZWN0IHdpZHRoPSI2IiBoZWlnaHQ9IjYiIHg9IjUiIHk9IjUiIGZpbGw9IiNhM2ZmNDciLz48L3N2Zz4=)
![Electron](https://img.shields.io/badge/electron-33.x-47848f?logo=electron)
![Vue](https://img.shields.io/badge/vue-3.x-4fc08d)
![Node.js](https://img.shields.io/badge/node-22.x-339933?logo=node.js)

---

## 功能特性

| 特性 | 说明 |
|------|------|
| 🔑 API Key 管理 | 支持各平台独立配置 Key，网页端密码输入框不可见 |
| 💰 余额查询 | 一键刷新 DeepSeek / Kimi / Lumai 余额（赠送/充值/代金券分类） |
| 📊 当日用量 | Lumai 显示今日请求数、消耗金额、实际扣费 |
| 🏷️ 别名系统 | 每个平台可自定义别名 |
| 📡 自动注入 | 首次启动自动从 `~/.hermes/.env` 读取已有 Key |
| ⏱️ 自动刷新 | 每 30 分钟自动刷新一次余额 |
| 🎨 暗色主题 | 深绿底色 + 青柠绿 Inter Tight 字体 |
| 🔗 控制台直达 | 每个平台卡片底部一键跳转官方控制台 |
| 🖥️ Electron 桌面应用 | 前后端一体，纯 Node.js 栈 |

## 架构

```
main.js (Electron 主进程)
  ├─ IPC 处理：get-platforms / refresh-platform / refresh-all / update-platform
  ├─ 直接调用各平台 HTTPS API 查询余额
  ├─ 读取 ~/.hermes/.env 自动注入 Key
  └─ BrowserWindow → templates/index.html (Vue 3)
       └─ preload.js (安全桥接) → window.electronAPI
```

无后端服务器，无 Flask/Python，全部逻辑在 Electron main process 中。

## 项目结构

```
api_panel/
├── package.json           # Electron + Node.js 配置
├── main.js                # Electron 主进程 — IPC + HTTPS 查询
├── preload.js             # Electron preload 脚本
├── .gitignore             # 忽略 node_modules / dist / keys.json
├── config/
│   └── keys.json          # 平台 API Key 和别名（自动从 ~/.hermes/.env 注入）
├── static/
│   ├── app.js             # Vue 3 前端逻辑
│   └── style.css          # 暗色样式
└── templates/
    └── index.html         # 单页 HTML
```

## 快速开始

```bash
cd api_panel
npm install
npm start
```

## 构建桌面应用

```bash
npm run build:linux    # 生成 AppImage + .deb
```

构建产物在 `dist/` 目录。

## 各平台支持情况

| 平台 | 余额 API | 用量详情 | 控制台直达 |
|------|:--------:|:--------:|:----------:|
| DeepSeek | ✅ | 赠送/充值分类 | ✅ |
| Kimi CN | ✅ | 现金/代金券分类 | ✅ |
| 小米 MiMo | ❌ 无 API | — | ✅ |
| Lumai | ✅ | 今日请求/消耗/扣费 | ✅ |

> 小米 MiMo 暂不支持 REST API 查询余额，页面会提示前往网页控制台查看。

## 配置说明

### 自动注入逻辑

每次加载配置时，如果 `auto_load_env` 为 `true`（默认），会从 `~/.hermes/.env` 自动读取以下环境变量并注入到配置中：

| 环境变量 | 对应平台 |
|----------|---------|
| `DEEPSEEK_API_KEY` | DeepSeek |
| `KIMI_CN_API_KEY` | Kimi CN |
| `XIAOMI_API_KEY` | 小米 MiMo |
| `LUMAI_API_KEY` | Lumai |

- 如果 `config/keys.json` 中已有手动配置的 Key，**不会覆盖**。
- 不想自动注入时，将 `auto_load_env` 设为 `false`。

### 安全提示

- `config/keys.json` 已加入 `.gitignore`，不会被提交到 Git。
- 窗口使用 `contextIsolation: true` + preload 脚本，渲染进程无法直接访问 Node.js API。

## 常见问题

### Q: 余额显示"❌ HTTP 401"？

API Key 无效或已过期。点击该平台的「⚙ 设置」更新 Key。

### Q: 余额显示"❌ HTTP 403 / 网络错误"？

- 检查是否需代理：本机直连 API，若网络环境需代理请设置系统代理或环境变量
- Lumai 的 API Key 需在 [api.lmuai.com](https://api.lmuai.com/dashboard) 生成

### Q: 如何添加新平台？

在 `main.js` 的 `PLATFORM_DEFS` 对象中添加平台定义，实现对应的 `parseXxx()` 解析函数，页面会自动渲染新卡片。
