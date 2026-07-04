# Architecture

## Overview

API Panel is an Electron desktop application with a Vue 3 renderer. It follows a clean main/renderer process separation with secure IPC communication.

```
┌─────────────────────────────────────────────────────────────────┐
│  Electron Main Process (electron/main.js)                      │
│  ├─ IPC Handlers (20+ channels)                                │
│  ├─ HTTPS API queries (Node.js native https module)            │
│  ├─ Config management (~/.config/api-panel/)                   │
│  ├─ Credential storage (~/.config/api-panel/.api_panel.env)   │
│  ├─ Window state persistence (state.json)                      │
│  ├─ Single-instance lock                                       │
│  └─ Auto-refresh timer (30 min interval)                       │
│                                                                 │
│  ←→ Preload Script (electron/preload.js)                       │
│      └─ contextBridge.exposeInMainWorld('electronAPI', ...)    │
│                                                                 │
│  ←→ Renderer Process (Vue 3 + src/)                            │
│      ├─ App.js (root component, state management)              │
│      ├─ PlatformCard.js (platform list card)                   │
│      ├─ DetailSheet.js (bottom sheet detail panel)             │
│      ├─ SettingsModal.js (platform settings modal)             │
│      ├─ AddCardModal.js (add platform instance modal)          │
│      ├─ WelcomeWizard.js (first-launch wizard)                 │
│      ├─ i18n.js (internationalization)                         │
│      └─ assets/style.css (dark theme styles)                   │
└─────────────────────────────────────────────────────────────────┘
```

## Process Communication (IPC Channels)

### Renderer → Main

| Channel | Payload | Description |
|---------|---------|-------------|
| `get-platforms` | — | Get all platform instances with cached balance data |
| `refresh-platform` | `{ id }` | Query balance for a single platform instance |
| `refresh-all` | — | Query all enabled platforms concurrently |
| `update-platform` | `{ id, alias, key, enabled }` | Save platform settings |
| `add-platform-instance` | `{ type }` | Create new instance of a platform type |
| `remove-platform-instance` | `{ id }` | Delete a platform instance |
| `get-layout` | — | Get card ordering from persistent storage |
| `save-layout` | `{ layout }` | Save card ordering to persistent storage |
| `get-platform-defs` | — | Get platform type definitions (id, name, icon, api support) |
| `import-platform-credential` | `{ source }` | Import key from Hermes Agent or OpenClaw config |
| `get-version` | — | Get application version string |
| `open-external` | `{ url }` | Open URL in system default browser |
| `window-minimize` | — | Minimize application window |
| `window-maximize` | — | Maximize/restore application window |
| `window-close` | — | Close application window |
| `resize-to-content` | `{ width, height }` | Auto-resize window to content |
| `is-first-launch` | — | Check if this is the first time launching |
| `get-language` | — | Get saved locale preference |
| `save-language` | `{ lang }` | Save locale preference |
| `get-default-browser` | — | Detect system default browser name |

## Security Model

1. **Context Isolation** — `contextIsolation: true`, `nodeIntegration: false`
2. **Preload Bridge** — Only whitelisted APIs exposed via `contextBridge.exposeInMainWorld`
3. **Credential Separation** — API keys stored in `~/.config/api-panel/.api_panel.env`, never in the project directory
4. **Git Protection** — `config/keys.json` and `.env*` files are in `.gitignore`
5. **Single Instance Lock** — `app.requestSingleInstanceLock()` prevents multiple app instances
6. **External URL Validation** — URLs validated to start with `http://` or `https://` before opening

## Data Flow

```
User Action (click refresh)
  ↓
Renderer calls window.electronAPI.refreshPlatform(id)
  ↓
Preload forwards via IPC to main process
  ↓
Main process reads credential from ~/.config/api-panel/.api_panel.env
  ↓
HTTPS request to platform API (api.deepseek.com, etc.)
  ↓
Response parsed by platform-specific parser
  ↓
Result cached in memory + returned via IPC
  ↓
Renderer updates Vue reactive state → UI re-renders
```

## File Storage

| File | Location | Purpose |
|------|----------|---------|
| `keys.json` | `~/.config/api-panel/` | Platform instances (alias, type, enabled) |
| `.api_panel.env` | `~/.config/api-panel/` | API credentials (KEY=VALUE format) |
| `state.json` | `~/.config/api-panel/` | Window position, size, maximized state |
| `layout.json` | `~/.config/api-panel/` | Card ordering for drag-and-drop |
| `language.json` | `~/.config/api-panel/` | User locale preference |
