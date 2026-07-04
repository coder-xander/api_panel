# Development Guide

## Prerequisites

- Node.js 22+
- pnpm (recommended) or npm
- Python 3 (optional, for icon generation scripts)

## Project Setup

```bash
git clone <repository-url>
cd api_panel
npm install
```

## Development Commands

```bash
# Run in development mode
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Building

```bash
# Build for Linux (.deb)
npm run build:linux

# Build for Windows (NSIS installer)
npm run build:win

# Build for both platforms
npm run build:all
```

Build artifacts are placed in the `dist/` directory.

## Project Structure

```
api_panel/
├── electron/
│   ├── main.js              # Main process — IPC handlers, HTTPS queries, config I/O
│   └── preload.js           # Preload script — secure contextBridge API
├── src/
│   ├── index.html           # SPA entry point (Vue mount)
│   ├── App.js               # Root Vue component
│   ├── i18n.js              # i18n translations (en-US, zh-CN)
│   ├── assets/
│   │   ├── style.css        # Dark theme styles
│   │   ├── gridstack-all.js # GridStack library
│   │   ├── gridstack.min.css
│   │   └── icons/           # Platform SVG icons
│   └── components/
│       ├── IconMap.js       # Platform icon name → SVG mapping
│       ├── PlatformCard.js  # Platform card component
│       ├── DetailSheet.js   # Bottom detail sheet
│       ├── SettingsModal.js # Platform settings modal
│       ├── AddCardModal.js  # Add new instance modal
│       └── WelcomeWizard.js # First-launch setup wizard
├── config/
│   └── keys.json            # Local dev config (git-ignored)
├── scripts/
│   └── generate_icons.py    # Icon generation utility
├── tests/                   # Vitest test files
├── vitest.config.js         # Test configuration
└── package.json             # Project metadata & scripts
```

## Test Framework

- **Runner:** Vitest 2.x
- **Environment:** happy-dom
- **Vue Testing:** @vue/test-utils
- **Coverage:** @vitest/coverage-v8

### Coverage Thresholds

| Metric    | Threshold |
|-----------|-----------|
| Lines     | 60%       |
| Functions | 60%       |
| Statements| 60%       |
| Branches  | 50%       |

### Test Files

| File | Coverage |
|------|----------|
| `basic.test.js` | Project structure integrity |
| `app.test.js` | App.js computed properties & methods |
| `i18n.test.js` | Translation completeness & interpolation |
| `iconmap.test.js` | Icon mapping correctness |
| `preload.test.js` | Preload API surface |
| `electron-main.test.js` | Main process logic |
| `electron-main-extended.test.js` | Extended main process scenarios |
| `vue-components.test.js` | Vue component rendering |

## Dependencies

### Production
| Package | Version | Purpose |
|---------|---------|---------|
| `gridstack` | ^12.6.0 | Drag-and-drop grid layout |
| `ws` | ^8.21.0 | WebSocket client (future use) |

### Development
| Package | Version | Purpose |
|---------|---------|---------|
| `electron` | ^33.0.0 | Desktop app framework |
| `electron-builder` | ^25.0.0 | App packaging |
| `vitest` | ^2.1.0 | Unit testing |
| `@vitest/coverage-v8` | ^2.1.9 | Code coverage |
| `@vue/test-utils` | ^2.4.0 | Vue component testing |
| `happy-dom` | ^15.11.0 | DOM environment for tests |

### Runtime (CDN)
- Vue 3 (`vue.global.prod.js` from unpkg.com)

## Internationalization

The app supports English (en-US) and Chinese (zh-CN). Translations are managed in `src/i18n.js`.

To add a new language:
1. Add a new key to the `translations` object in `i18n.js`
2. Include all existing message keys with translated values
3. Add the language option to the settings UI

## Code Style

- No semicolons (JS)
- 2-space indentation
- Vue 3 Composition API style
- CSS: BEM-like naming, CSS custom properties for theming
- Comments: minimal, only when non-obvious
