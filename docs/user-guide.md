# User Guide

## Getting Started

### Installation

#### Windows
Download the NSIS installer from the releases page and run it. Choose your installation directory.

#### Linux
```bash
sudo dpkg -i dist/api-panel_*.deb
```

### First Launch

On first launch, the **Welcome Wizard** will guide you through:
1. Selecting your preferred language (English / 中文)
2. Importing existing API keys (from Hermes Agent or OpenClaw config)
3. Adding your first platform

## Main Interface

### Platform Cards

Each platform is displayed as a card showing:
- **Platform icon & name** — Identifies the service
- **Alias** — Custom label you can set
- **Balance / Usage summary** — Key metrics at a glance
- **Status indicator** — Green glow = data <1hr old, gray = stale
- **Last updated time** — e.g., "5 minutes ago"

### Card Actions

| Action | How |
|--------|-----|
| View details | Click on the card → bottom sheet slides up |
| Refresh balance | Click the refresh button on the card |
| Open console | Click the console link at card bottom |
| Reorder cards | Drag the handle on the left side |
| Settings | Click the ⚙ icon |

### Bottom Dock

- **+ Add Card** — Add a new platform instance
- **↻ Refresh All** — Query all enabled platforms at once

## Settings

### Platform Settings

Click the ⚙ icon on any card to open settings:
- **Alias** — Custom name for this instance
- **API Key** — Update the credential
- **Enabled/Disabled** — Toggle whether this instance is queried
- **Delete** — Remove this instance

### Application Settings

- **Language** — Switch between English and 中文
- **Auto-refresh** — Enabled by default, refreshes every 30 minutes

## Detail Sheet

Clicking a card opens a bottom sheet with full details:

### Balance Information
- **DeepSeek:** Granted / Topped-up / Total (CNY)
- **Kimi CN:** Cash / Voucher (CNY)
- **OpenRouter:** Limit / Used / Remaining (USD)
- **OpenAI:** Total usage (USD)
- **SiliconFlow:** Balance (CNY)
- **Lumai:** Full breakdown (see below)

### Lumai Detailed Usage
- **Today:** Request count, cost, actual charge, token counts
- **Per-model:** Requests and cost per model (e.g., opus-4-7, sonnet-4-6)
- **Lifetime:** Total requests, total cost, total tokens

## Data Freshness

The app uses visual indicators to show data age:
- **Green glow** — Data refreshed within the last hour
- **Gray/dim** — Data is older than 1 hour

Click **Refresh All** or individual refresh buttons to update.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+R` | Refresh all platforms |
| `Ctrl+,` | Open settings |
| `Ctrl+Q` | Quit application |

## Credential Management

### Automatic Import

On first launch, the app can automatically import API keys from:
- **Hermes Agent** — `~/.hermes/.env`
- **OpenClaw** — `~/.openclaw/.env`

The following environment variables are recognized:

| Variable | Platform |
|----------|----------|
| `DEEPSEEK_API_KEY` | DeepSeek |
| `KIMI_CN_API_KEY` | Kimi CN |
| `LUMAI_API_KEY` | Lumai |
| `OPENROUTER_API_KEY` | OpenRouter |
| `OPENAI_API_KEY` | OpenAI |
| `SILICONFLOW_API_KEY` | SiliconFlow |
| `XIAOMI_API_KEY` | 小米 MiMo |
| `CLAUDE_API_KEY` | Claude |
| `GEMINI_API_KEY` | Gemini |
| `GROQ_API_KEY` | Groq |
| `TOGETHER_API_KEY` | Together AI |
| `VOLCENGINE_API_KEY` | 火山引擎 |
| `ZHIPU_API_KEY` | 智谱 AI |
| `MINIMAX_API_KEY` | MiniMax |

### Manual Entry

If auto-import doesn't find your keys, you can manually enter them through the platform settings modal.

## Troubleshooting

### "❌ HTTP 401" Error
The API Key is invalid or expired. Open platform settings and update the key.

### "❌ HTTP 403" Error
- Check if your network requires a proxy
- Lumai keys must be generated at https://api.lmuai.com/dashboard

### "❌ Network Error"
- Verify your internet connection
- Some platforms may be region-restricted
- Try setting system proxy if needed

### Balance Not Updating
- Click the refresh button on the card
- Check that the platform is enabled in settings
- Verify the API key is correct

### Window Position Not Saved
The window state is saved to `~/.config/api-panel/state.json`. Ensure the directory is writable.
