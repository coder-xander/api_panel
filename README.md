# ⚡ API Panel

Multi-platform AI API balance & usage tracker — a unified desktop dashboard for monitoring API keys across 14+ AI service providers.

![Theme](https://img.shields.io/badge/theme-dark-%230a0f0a)
![Electron](https://img.shields.io/badge/electron-33.x-47848f?logo=electron)
![Vue](https://img.shields.io/badge/vue-3-4fc08d?logo=vue.js)
![Node.js](https://img.shields.io/badge/node-22.x-339933?logo=node.js)
![License](https://img.shields.io/badge/license-©%202026%20Hermes-blue)

---

## Features

| Feature | Description |
|---------|-------------|
| 🔑 **Multi-instance** | Each platform supports multiple API keys |
| 💰 **Balance Query** | One-click refresh for platforms with REST API support |
| 📊 **Usage Stats** | Today's requests, costs, tokens, lifetime totals |
| 🏷️ **Alias System** | Custom labels for each instance |
| 📡 **Auto Import** | Import keys from Hermes Agent / OpenClaw configs on first launch |
| ⏱️ **Auto Refresh** | Automatic balance refresh every 30 minutes |
| 🎨 **Dark Theme** | Deep green + lime neon aesthetic with animated rainbow border |
| 🔗 **Console Links** | One-click jump to each platform's web console |
| 🖥️ **Desktop App** | Cross-platform Electron app (Linux + Windows) |
| 🌐 **i18n** | English + 中文 support |
| 🔒 **Secure** | Context isolation, preload bridge, credentials in user config dir |

## Quick Start

```bash
cd api_panel
npm install
npm start
```

## Building

```bash
npm run build:linux    # Linux .deb package
npm run build:win      # Windows NSIS installer
npm run build:all      # Both platforms
```

Build artifacts are placed in `dist/`.

## Supported Platforms

| Platform | Balance API | Usage Details | Console |
|----------|:-----------:|:-------------:|:-------:|
| DeepSeek | ✅ | Granted / Topped-up | ✅ |
| Kimi CN | ✅ | Cash / Voucher | ✅ |
| Lumai | ✅ | Today / Per-model / Lifetime | ✅ |
| OpenRouter | ✅ | Limit / Used / Remaining | ✅ |
| OpenAI | ✅ | Total usage | ✅ |
| SiliconFlow | ✅ | Balance | ✅ |
| 小米 MiMo | ❌ | — | ✅ |
| Claude | ❌ | — | ✅ |
| Gemini | ❌ | — | ✅ |
| Groq | ❌ | — | ✅ |
| Together AI | ❌ | — | ✅ |
| 火山引擎 | ❌ | — | ✅ |
| 智谱 AI | ❌ | — | ✅ |
| MiniMax | ❌ | — | ✅ |

> Platforms without API support display a link to the web console for manual balance checking.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/user-guide.md](docs/user-guide.md) | User guide — installation, interface, settings, troubleshooting |
| [docs/architecture.md](docs/architecture.md) | Architecture overview — processes, IPC channels, security model |
| [docs/platforms.md](docs/platforms.md) | Platform reference — API endpoints, data formats, adding new platforms |
| [docs/development.md](docs/development.md) | Development guide — setup, commands, testing, dependencies |

## Architecture

```
electron/main.js  (Main Process)
  ├─ IPC Handlers ←→ preload.js (contextBridge)
  ├─ HTTPS queries to platform APIs
  ├─ Config I/O (~/.config/api-panel/)
  └─ Window state persistence
       ↓
  Vue 3 Renderer (src/)
  ├─ App.js + Components
  ├─ GridStack (drag-and-drop)
  └─ i18n (en-US, zh-CN)
```

No backend server — all logic runs in the Electron main process.

## Security

- `contextIsolation: true`, `nodeIntegration: false`
- Preload script exposes only whitelisted APIs via `contextBridge`
- Credentials stored in `~/.config/api-panel/.api_panel.env` (outside project dir)
- `config/keys.json` is git-ignored

## License

Copyright © 2026 Hermes
