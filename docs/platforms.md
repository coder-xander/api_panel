# Supported Platforms

## Overview

API Panel supports 14 AI service platforms. Each platform can have multiple instances (different API keys). Balance querying is available for platforms that expose a REST API; others provide console link shortcuts only.

## Platform List

### DeepSeek
- **ID:** `deepseek`
- **Balance API:** ✅ `GET https://api.deepseek.com/user/balance`
- **Auth:** Bearer token
- **Data returned:** Granted balance, topped-up balance, total balance (CNY)
- **Console:** https://platform.deepseek.com

### Kimi CN (Moonshot)
- **ID:** `kimi_cn`
- **Balance API:** ✅ `GET https://api.moonshot.cn/v1/users/me/balance`
- **Auth:** Bearer token
- **Data returned:** Cash balance, voucher balance (CNY)
- **Console:** https://platform.moonshot.cn

### Lumai
- **ID:** `lumai`
- **Balance API:** ✅ `GET https://api.lmuai.com/v1/usage`
- **Auth:** Bearer token
- **Data returned:**
  - Today: request count, cost, actual charge, tokens (input/output/cache)
  - Per-model breakdown: requests, cost per model
  - Lifetime: total requests, total cost, total tokens
- **Console:** https://api.lmuai.com/dashboard

### OpenRouter
- **ID:** `openrouter`
- **Balance API:** ✅ `GET https://openrouter.ai/api/v1/auth/key`
- **Auth:** Bearer token
- **Data returned:** Limit, used, remaining credits (USD)
- **Console:** https://openrouter.ai/keys

### OpenAI
- **ID:** `openai`
- **Balance API:** ✅ `GET https://api.openai.com/v1/organization/usage`
- **Auth:** Bearer token
- **Data returned:** Total usage (USD)
- **Console:** https://platform.openai.com

### SiliconFlow
- **ID:** `siliconflow`
- **Balance API:** ✅ `GET https://api.siliconflow.cn/v1/user/info`
- **Auth:** Bearer token
- **Data returned:** Balance (CNY)
- **Console:** https://cloud.siliconflow.cn

### 小米 MiMo
- **ID:** `xiaomi`
- **Balance API:** ❌ No public API
- **Console:** https://api.minimaxi.chat

### Claude (Anthropic)
- **ID:** `claude`
- **Balance API:** ❌ No public API
- **Console:** https://console.anthropic.com

### Gemini (Google)
- **ID:** `gemini`
- **Balance API:** ❌ No public API
- **Console:** https://aistudio.google.com

### Groq
- **ID:** `groq`
- **Balance API:** ❌ No public API
- **Console:** https://console.groq.com

### Together AI
- **ID:** `together`
- **Balance API:** ❌ No public API
- **Console:** https://api.together.xyz

### 火山引擎 (Volcengine)
- **ID:** `volcengine`
- **Balance API:** ❌ No public API
- **Console:** https://console.volcengine.com

### 智谱 AI (Zhipu)
- **ID:** `zhipu`
- **Balance API:** ❌ No public API
- **Console:** https://open.bigmodel.cn

### MiniMax
- **ID:** `minimax`
- **Balance API:** ❌ No public API
- **Console:** https://api.minimaxi.chat

## Adding a New Platform

To add a new platform with balance API support:

1. **Define the platform** in `electron/main.js` → `PLATFORM_DEFS` array:
   ```js
   { id: 'newplat', name: 'New Platform', icon: 'newplat', hasAPI: true, consoleUrl: 'https://...' }
   ```

2. **Add credential key name** in the credential mapping section

3. **Implement the API query** in the `refreshPlatform()` function:
   ```js
   case 'newplat':
     await queryNewplat(instance)
     break
   ```

4. **Implement the parser function**:
   ```js
   function queryNewplat(instance) {
     return new Promise((resolve, reject) => {
       const req = https.request({
         hostname: 'api.newplatform.com',
         path: '/v1/balance',
         method: 'GET',
         headers: { 'Authorization': `Bearer ${instance.key}` }
       }, (res) => {
         let data = ''
         res.on('data', chunk => data += chunk)
         res.on('end', () => {
           if (res.statusCode === 200) {
             const json = JSON.parse(data)
             // Parse and assign to instance fields
             resolve()
           } else {
             reject(new Error(`HTTP ${res.statusCode}`))
           }
         })
       })
       req.on('error', reject)
       req.end()
     })
   }
   ```

5. **Add platform icon** as SVG in `src/assets/icons/`

6. **Add display logic** in `PlatformCard.js` for the new platform's data fields
