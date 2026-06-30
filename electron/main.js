// ⚡ API 聚合面板 — Electron 主进程
// 职责：IPC 处理余额查询、配置管理、窗口生命周期

const { app, BrowserWindow, ipcMain, shell } = require('electron');

// ═══ 单实例锁：防止多开导致双实例争抢 user-data-dir 吃满 CPU ═══
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}
const path = require('path');
const fs = require('fs');
const https = require('https');

const HOME = require('os').homedir();
// __dirname = electron/，项目根在上一级
const ROOT = path.join(__dirname, '..');
const PACKAGE = require(path.join(ROOT, 'package.json'));
// 敏感配置统一存放到用户配置目录，不写死在项目里
const CONFIG_DIR = path.join(HOME, '.config', 'api-panel');
const CONFIG_FILE = path.join(CONFIG_DIR, 'keys.json');
const APP_ENV_FILE = path.join(CONFIG_DIR, '.api_panel.env');
const ENV_FILE = path.join(HOME, '.hermes', '.env');
const OPENCLAW_FILE = path.join(HOME, '.openclaw', 'openclaw.json');
const STATE_FILE = path.join(CONFIG_DIR, 'state.json');

const CREDENTIAL_SOURCE_LABELS = {
  app: 'API Panel (.api_panel.env)',
  manual: '手动填写',
  hermes: 'Hermes Agent',
  openclaw: 'OpenClaw',
};

// ─── 窗口状态持久化 ───
function loadWindowState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (_) { /* ignore */ }
  return null;
}
function saveWindowState(win) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const bounds = win.getBounds();
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      x: bounds.x, y: bounds.y,
      width: bounds.width, height: bounds.height,
      maximized: win.isMaximized(),
    }, null, 2), 'utf-8');
  } catch (_) { /* ignore */ }
}

// ─── App 自己的 .env 凭据存储 ───
function parseEnvFile(file) {
  const vars = {};
  if (!fs.existsSync(file)) return vars;
  try {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eqIdx = trimmed.indexOf('=');
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      if (key) vars[key] = value;
    }
  } catch (_) { /* ignore corrupt env */ }
  return vars;
}

function quoteEnvValue(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')}"`;
}

function updateAppEnv(updates) {
  const vars = parseEnvFile(APP_ENV_FILE);
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === '') delete vars[key];
    else vars[key] = value;
  }
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const body = Object.keys(vars).sort().map((key) => `${key}=${quoteEnvValue(vars[key])}`).join('\n');
  fs.writeFileSync(
    APP_ENV_FILE,
    `# API Panel credentials. Managed by the app.\n# You can edit this file manually if needed.\n${body}${body ? '\n' : ''}`,
    'utf-8',
  );
}

function credentialEnvName(instanceId, field) {
  const safeId = String(instanceId).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase();
  return `API_PANEL_${safeId}_${field.toUpperCase()}`;
}

function credentialFieldForPlatform(platDef) {
  return 'key';
}

function maskCredential(value) {
  if (!value) return '';
  return value.length > 10 ? value.slice(0, 6) + '****' + value.slice(-4) : '****';
}

function applyAppCredentials(config) {
  const appEnv = parseEnvFile(APP_ENV_FILE);
  for (const [instanceId, instData] of Object.entries(config.platforms || {})) {
    const platDef = PLATFORM_DEFS[instData.type];
    if (!platDef) continue;
    const field = credentialFieldForPlatform(platDef);
    const envName = credentialEnvName(instanceId, field);
    if (appEnv[envName]) {
      instData[field] = appEnv[envName];
      instData.credential_env = envName;
      instData.credential_source = instData.credential_source || CREDENTIAL_SOURCE_LABELS.app;
    }
  }
}

function migrateSecretsToAppEnv(config) {
  let changed = false;
  const updates = {};
  const appEnv = parseEnvFile(APP_ENV_FILE);
  for (const [instanceId, instData] of Object.entries(config.platforms || {})) {
    if (!instData.key) continue;
    const envName = credentialEnvName(instanceId, 'key');
    if (!appEnv[envName]) updates[envName] = instData.key;
    delete instData.key;
    instData.credential_source = instData.credential_source || CREDENTIAL_SOURCE_LABELS.app;
    changed = true;
  }
  if (Object.keys(updates).length > 0) updateAppEnv(updates);
  return changed;
}

function saveCredential(instanceId, field, value) {
  updateAppEnv({ [credentialEnvName(instanceId, field)]: value });
}

function removeCredentials(instanceId) {
  updateAppEnv({
    [credentialEnvName(instanceId, 'key')]: '',
  });
}

function stripRuntimeCredentials(config) {
  for (const instData of Object.values(config.platforms || {})) {
    delete instData.key;
  }
  return config;
}

// ─── 平台定义 ───
const PLATFORM_DEFS = {
  deepseek: {
    name: 'DeepSeek',
    hostname: 'api.deepseek.com',
    path: '/user/balance',
    method: 'GET',
    parser: 'deepseek',
    console_url: 'https://platform.deepseek.com/usage',
    defaultW: 1, defaultH: 1,
    env_keys: ['DEEPSEEK_API_KEY'],
  },
  kimi: {
    name: 'Kimi CN',
    hostname: 'api.moonshot.cn',
    path: '/v1/users/me/balance',
    method: 'GET',
    parser: 'kimi',
    console_url: 'https://platform.kimi.com/console/account',
    defaultW: 1, defaultH: 1,
    env_keys: ['KIMI_CN_API_KEY', 'KIMI_API_KEY'],
  },
  xiaomi: {
    name: '小米 MiMo',
    hostname: '',
    path: '',
    method: '',
    parser: '',
    console_url: 'https://platform.xiaomimimo.com/console/plan-manage',
    defaultW: 1, defaultH: 1,
    env_keys: ['XIAOMI_API_KEY'],
  },
  lumai: {
    name: 'Lumai',
    hostname: 'api.lmuai.com',
    path: '/v1/usage',
    method: 'GET',
    parser: 'lumai',
    console_url: 'https://api.lmuai.com/dashboard',
    defaultW: 3, defaultH: 1,
    env_keys: ['LUMAI_API_KEY'],
  },
  openrouter: {
    name: 'OpenRouter',
    hostname: 'openrouter.ai',
    path: '/api/v1/auth/key',
    method: 'GET',
    parser: 'openrouter',
    console_url: 'https://openrouter.ai/settings/credits',
    defaultW: 1, defaultH: 1,
    env_keys: ['OPENROUTER_API_KEY'],
  },
  openai: {
    name: 'OpenAI',
    hostname: 'api.openai.com',
    path: '/v1/organization/usage',
    method: 'GET',
    parser: 'openai',
    console_url: 'https://platform.openai.com/usage',
    defaultW: 2, defaultH: 1,
    env_keys: ['OPENAI_API_KEY'],
  },
  anthropic: {
    name: 'Claude',
    hostname: '',
    path: '',
    method: '',
    parser: '',
    console_url: 'https://console.anthropic.com/settings/billing',
    defaultW: 1, defaultH: 1,
    env_keys: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  },
  gemini: {
    name: 'Gemini',
    hostname: '',
    path: '',
    method: '',
    parser: '',
    console_url: 'https://aistudio.google.com/usage',
    defaultW: 1, defaultH: 1,
    env_keys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  },
  groq: {
    name: 'Groq',
    hostname: '',
    path: '',
    method: '',
    parser: '',
    console_url: 'https://console.groq.com/usage',
    defaultW: 1, defaultH: 1,
    env_keys: ['GROQ_API_KEY'],
  },
  siliconflow: {
    name: 'SiliconFlow',
    hostname: 'api.siliconflow.cn',
    path: '/v1/user/info',
    method: 'GET',
    parser: 'siliconflow',
    console_url: 'https://cloud.siliconflow.cn/account/billing',
    defaultW: 1, defaultH: 1,
    env_keys: ['SILICONFLOW_API_KEY'],
  },
  together: {
    name: 'Together',
    hostname: '',
    path: '',
    method: '',
    parser: '',
    console_url: 'https://api.together.xyz/settings',
    defaultW: 1, defaultH: 1,
    env_keys: ['TOGETHER_API_KEY'],
  },
  volcengine: {
    name: '火山引擎',
    hostname: '',
    path: '',
    method: '',
    parser: '',
    console_url: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    defaultW: 1, defaultH: 1,
    env_keys: ['VOLC_API_KEY', 'ARK_API_KEY'],
  },
  zhipu: {
    name: '智谱 AI',
    hostname: '',
    path: '',
    method: '',
    parser: '',
    console_url: 'https://open.bigmodel.cn/usercenter/apikeys',
    defaultW: 1, defaultH: 1,
    env_keys: ['ZHIPU_API_KEY', 'GLM_API_KEY'],
  },
  minimax: {
    name: 'MiniMax',
    hostname: '',
    path: '',
    method: '',
    parser: '',
    console_url: 'https://platform.minimaxi.com/user-center/basic-information',
    defaultW: 1, defaultH: 1,
    env_keys: ['MINIMAX_API_KEY', 'MINIMAX_CN_API_KEY'],
  },
};

// ─── 余额解析器 ───
function parseDeepseek(data) {
  const infos = data.balance_infos || [];
  const balances = infos.map((info) => ({
    currency: info.currency || 'CNY',
    total: parseFloat(info.total_balance || 0),
    granted: parseFloat(info.granted_balance || 0),
    topped_up: parseFloat(info.topped_up_balance || 0),
  }));
  return { available: data.is_available || false, balances };
}

function parseKimi(data) {
  const inner = data.data || {};
  return {
    available: true,
    balances: [{
      currency: 'CNY',
      total: parseFloat(inner.available_balance || 0),
      voucher: parseFloat(inner.voucher_balance || 0),
      cash: parseFloat(inner.cash_balance || 0),
    }],
  };
}

function parseLumai(data) {
  const balance = parseFloat(data.balance || 0);
  const daily = data.daily_usage || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  let todayUsage = null;
  let latestUsage = null;

  for (const d of daily) {
    if (d.date === todayStr) { todayUsage = d; break; }
    if (!latestUsage) latestUsage = d;
  }
  const usage = todayUsage || latestUsage;

  const result = {
    available: true,
    balances: [{ currency: 'USD', total: balance }],
  };

  if (usage) {
    result.today = {
      date: usage.date,
      requests: usage.requests || 0,
      cost: parseFloat(usage.cost || 0),
      actual_cost: parseFloat(usage.actual_cost || 0),
      total_tokens: usage.total_tokens || 0,
      is_today: usage === todayUsage,
    };
  }

  if (data.usage && data.usage.today) {
    const t = data.usage.today;
    result.live_today = {
      requests: t.requests || 0,
      cost: parseFloat(t.cost || 0),
      actual_cost: parseFloat(t.actual_cost || 0),
      total_tokens: t.total_tokens || 0,
      input_tokens: t.input_tokens || 0,
      output_tokens: t.output_tokens || 0,
      cache_read_tokens: t.cache_read_tokens || 0,
      cache_write_tokens: t.cache_creation_tokens || 0,
    };
  }

  if (data.usage && data.usage.total) {
    const t = data.usage.total;
    result.lifetime = {
      requests: t.requests || 0,
      cost: parseFloat(t.cost || 0),
      actual_cost: parseFloat(t.actual_cost || 0),
      total_tokens: t.total_tokens || 0,
    };
  }

  if (data.model_stats && data.model_stats.length > 0) {
    result.models = data.model_stats.map(m => ({
      model: m.model || 'unknown',
      requests: m.requests || 0,
      cost: parseFloat(m.cost || 0),
      actual_cost: parseFloat(m.actual_cost || 0),
      total_tokens: m.total_tokens || 0,
      cache_read_tokens: m.cache_read_tokens || 0,
    }));
  }

  return result;
}

function parseOpenRouter(data) {
  const d = data.data || data;
  const usage = d.usage || 0;
  const limit = d.limit || 0;
  const remaining = limit > 0 ? limit - usage : 0;
  return {
    available: true,
    balances: [{
      currency: 'USD',
      total: limit,
      limit,
      used: usage,
      remaining,
      percent: limit > 0 ? usage / limit : 0,
    }],
  };
}

function parseSiliconflow(data) {
  const d = data.data || data;
  const balance = parseFloat(d.balance || d.totalBalance || 0);
  return {
    available: true,
    balances: [{ currency: 'CNY', total: balance }],
  };
}

function parseOpenai(data) {
  if (data.total_usage !== undefined) {
    return {
      available: true,
      balances: [{ currency: 'USD', total: parseFloat(data.total_usage || 0) / 100 }],
    };
  }
  return { available: true, balances: [{ currency: 'USD', total: 0 }] };
}

const PARSERS = { deepseek: parseDeepseek, kimi: parseKimi, lumai: parseLumai, openrouter: parseOpenRouter, siliconflow: parseSiliconflow, openai: parseOpenai };

// ─── HTTP 查询（Node.js 内置 https） ───
function httpsGet(hostname, path, apiKey) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname,
      path,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject({ code: res.statusCode, message: body.slice(0, 500) });
        } else {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject({ message: 'Invalid JSON response' }); }
        }
      });
    });
    req.on('error', (e) => reject({ message: e.message }));
    req.on('timeout', () => { req.destroy(); reject({ message: 'Request timeout' }); });
    req.end();
  });
}



async function queryBalance(platformId, apiKey) {
  const plat = PLATFORM_DEFS[platformId];
  if (!plat.hostname || !plat.parser) {
    return {
      status: 'no_api',
      message: `${plat.name} 不支持 REST API 查询余额，请访问网页控制台`,
      console_url: plat.console_url,
    };
  }

  // 标准 Bearer token 鉴权
  try {
    const raw = await httpsGet(plat.hostname, plat.path, apiKey);
    const parser = PARSERS[plat.parser];
    const data = parser ? parser(raw) : raw;
    return { status: 'ok', data, raw };
  } catch (e) {
    return { status: 'error', code: e.code, message: e.message };
  }
}

// ─── 从 OpenClaw 配置读取 API Key ───
function loadOpenclawKeys() {
  const keys = {};
  if (!fs.existsSync(OPENCLAW_FILE)) return keys;
  try {
    const oc = JSON.parse(fs.readFileSync(OPENCLAW_FILE, 'utf-8'));
    const vars = oc?.env?.vars || {};
    for (const [k, v] of Object.entries(vars)) {
      if (typeof v === 'string' && v.length > 5) keys[k] = v;
    }
  } catch (_) { /* ignore corrupt config */ }
  return keys;
}

function importCredentialFromSource(instanceId, source) {
  const config = loadConfig();
  const instData = config.platforms?.[instanceId];
  if (!instData) return { status: 'error', message: '未找到这个平台实例' };

  const platDef = PLATFORM_DEFS[instData.type];
  if (!platDef) return { status: 'error', message: '未知平台类型' };

  let sourceVars = {};
  if (source === 'hermes') {
    sourceVars = parseEnvFile(ENV_FILE);
  } else if (source === 'openclaw') {
    sourceVars = loadOpenclawKeys();
  } else {
    return { status: 'error', message: '不支持的导入来源' };
  }

  const envKeys = platDef.env_keys || [];
  const matchedKey = envKeys.find((key) => sourceVars[key]);
  if (!matchedKey) {
    return {
      status: 'not_found',
      message: `${CREDENTIAL_SOURCE_LABELS[source]} 中没有找到 ${platDef.name} 的 API Key`,
      expected_keys: envKeys,
    };
  }

  saveCredential(instanceId, 'key', sourceVars[matchedKey]);
  delete instData.key;
  instData.enabled = true;
  instData.credential_source = CREDENTIAL_SOURCE_LABELS[source];
  instData.credential_env = credentialEnvName(instanceId, 'key');
  saveConfig(config);

  return {
    status: 'ok',
    source: CREDENTIAL_SOURCE_LABELS[source],
    env_key: matchedKey,
    masked_key: maskCredential(sourceVars[matchedKey]),
  };
}

// ─── 配置管理 ───

// 生成实例 ID：type + 序号，如 "deepseek#1", "deepseek#2"
function generateInstanceId(type, platforms) {
  let maxNum = 0;
  for (const id of Object.keys(platforms)) {
    const match = id.match(new RegExp(`^${type}#(\\d+)$`));
    if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
  }
  return `${type}#${maxNum + 1}`;
}

// 迁移旧格式配置 → 多实例格式
function migrateConfig(config) {
  if (!config.platforms) return config;
  let migrated = false;

  // 检测旧格式：config.platforms[platId] 没有 type 字段且 platId 不含 #
  for (const [platId, platData] of Object.entries(config.platforms)) {
    if (platId.includes('#')) continue; // 已经是新格式
    if (!PLATFORM_DEFS[platId]) continue; // 未知平台，跳过

    // 旧格式 → 转为 instanceId
    const instanceId = `${platId}#1`;
    platData.type = platId;
    delete platData.no_balance_api; // 移除旧字段
    config.platforms[instanceId] = platData;
    delete config.platforms[platId];
    migrated = true;
  }

  // 迁移 layout 中的 id
  if (migrated && config.layout) {
    for (const item of config.layout) {
      if (!item.id.includes('#') && PLATFORM_DEFS[item.id]) {
        item.id = `${item.id}#1`;
        item.type = item.id.replace('#1', '');
      }
    }
  }

  return config;
}

function loadConfig() {
  let config = { platforms: {}, auto_load_env: true };

  // ─── 新路径优先：~/.config/api-panel/keys.json（用户配置目录，安全隔离）
  if (fs.existsSync(CONFIG_FILE)) {
    try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); }
    catch (_) { /* ignore corrupt config */ }
  } else {
    // 从旧路径迁移（项目内 config/keys.json → 用户配置目录）
    const oldFile = path.join(ROOT, 'config', 'keys.json');
    if (fs.existsSync(oldFile)) {
      try {
        config = JSON.parse(fs.readFileSync(oldFile, 'utf-8'));
        if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
      } catch (_) { /* ignore */ }
    }
  }

  // ─── 迁移旧格式 → 多实例格式 ───
  migrateConfig(config);

  // ─── 旧版 keys.json 中的敏感字段迁移到 App 自己的 .api_panel.env ───
  if (migrateSecretsToAppEnv(config)) saveConfig(config);

  // ─── 运行时只从 App 自己的 .api_panel.env 注入凭据 ───
  applyAppCredentials(config);
  return config;
}

function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  stripRuntimeCredentials(config);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// ─── IPC 处理 ───
function registerIpcHandlers() {
  // 获取平台实例列表（从 config.platforms 构建，每个实例独立）
  ipcMain.handle('get-platforms', () => {
    const config = loadConfig();
    const result = [];
    for (const [instanceId, instData] of Object.entries(config.platforms)) {
      const type = instData.type;
      const platDef = PLATFORM_DEFS[type];
      if (!platDef) continue;

      const key = instData.key || '';

      result.push({
        id: instanceId,       // 实例唯一 ID，如 "deepseek#1"
        type,                 // 平台类型，如 "deepseek"
        name: platDef.name,   // 平台显示名
        alias: instData.alias || platDef.name,
        has_key: !!key,
        masked_key: maskCredential(key),
        has_balance_api: !!platDef.hostname,
        auth_type: platDef.auth_type || 'bearer',
        console_url: platDef.console_url,
        enabled: instData.enabled !== false && !!key,
        defaultW: platDef.defaultW || 1,
        defaultH: platDef.defaultH || 1,
        detected_source: instData.credential_source || instData.detected_source || '',
        credential_env: instData.credential_env || credentialEnvName(instanceId, 'key'),
      });
    }
    return result;
  });

  // ─── 布局管理 ───
  ipcMain.handle('get-layout', () => {
    const config = loadConfig();
    if (!config.layout || !Array.isArray(config.layout) || config.layout.length === 0) {
      // 默认布局：每个已配置平台类型生成 #1 实例
      const defaultLayout = [];
      let col = 0, row = 0;
      for (const [platId, platDef] of Object.entries(PLATFORM_DEFS)) {
        const instanceId = `${platId}#1`;
        const hasConfig = !!config.platforms[instanceId];
        // 只为有配置的平台生成默认布局
        if (!hasConfig) continue;
        const w = platDef.defaultW || 1;
        const h = platDef.defaultH || 1;
        if (col + w > 4) { col = 0; row++; }
        defaultLayout.push({ id: instanceId, type: platId, x: col, y: row, w, h });
        col += w;
      }
      return defaultLayout;
    }
    return config.layout;
  });

  // 保存卡片布局
  ipcMain.handle('save-layout', (_event, layout) => {
    const config = loadConfig();
    config.layout = layout;
    saveConfig(config);
    return { status: 'ok' };
  });

  // 获取所有平台类型定义（用于添加卡片弹窗）
  ipcMain.handle('get-platform-defs', () => {
    const defs = {};
    for (const [id, def] of Object.entries(PLATFORM_DEFS)) {
      defs[id] = {
        name: def.name,
        defaultW: def.defaultW || 1,
        defaultH: def.defaultH || 1,
        auth_type: def.auth_type || 'bearer',
        env_keys: def.env_keys || [],
      };
    }
    return defs;
  });

  // 添加新的平台实例（创建空配置条目）
  ipcMain.handle('add-platform-instance', (_event, type) => {
    if (!PLATFORM_DEFS[type]) return { error: 'Unknown platform type' };
    const config = loadConfig();
    const instanceId = generateInstanceId(type, config.platforms);
    config.platforms[instanceId] = {
      type,
      alias: PLATFORM_DEFS[type].name,
      enabled: false,
    };
    saveConfig(config);
    return { status: 'ok', instanceId };
  });

  // 移除平台实例
  ipcMain.handle('remove-platform-instance', (_event, instanceId) => {
    const config = loadConfig();
    if (!config.platforms[instanceId]) return { error: 'Instance not found' };
    removeCredentials(instanceId);
    delete config.platforms[instanceId];
    // 同时从 layout 中移除
    if (config.layout) {
      config.layout = config.layout.filter(item => item.id !== instanceId);
    }
    saveConfig(config);
    return { status: 'ok' };
  });

  // 刷新单个平台实例
  ipcMain.handle('refresh-platform', async (_event, instanceId) => {
    const config = loadConfig();
    const instData = config.platforms[instanceId];
    if (!instData) return { error: 'Unknown instance' };
    const type = instData.type;
    if (!PLATFORM_DEFS[type]) return { error: 'Unknown platform type' };

    const key = instData.key;
    if (!key) {
      return { error: 'No API key configured' };
    }
    const result = await queryBalance(type, key);
    return {
      alias: instData.alias || PLATFORM_DEFS[type].name,
      result,
    };
  });

  // 刷新全部平台实例
  ipcMain.handle('refresh-all', async () => {
    const config = loadConfig();
    const results = {};
    const promises = Object.entries(config.platforms).map(async ([instanceId, instData]) => {
      const type = instData.type;
      const platDef = PLATFORM_DEFS[type];
      if (!platDef) return;
      const key = instData.key;
      if (!key || instData.enabled === false) return;
      results[instanceId] = {
        alias: instData.alias || platDef.name,
        result: await queryBalance(type, key),
      };
    });
    await Promise.all(promises);
    return results;
  });

  // 更新平台实例配置
  ipcMain.handle('update-platform', (_event, instanceId, updates) => {
    const config = loadConfig();
    let instData = config.platforms[instanceId];

    // 如果实例不存在（前端临时添加的），创建新条目
    if (!instData) {
      // 从 instanceId 解析 type
      const hashIdx = instanceId.indexOf('#');
      const type = hashIdx > 0 ? instanceId.slice(0, hashIdx) : instanceId;
      if (!PLATFORM_DEFS[type]) return { error: 'Unknown platform type' };
      instData = { type, alias: PLATFORM_DEFS[type].name };
      config.platforms[instanceId] = instData;
    }

    if (updates.alias !== undefined) instData.alias = updates.alias;
    if (updates.key !== undefined) {
      saveCredential(instanceId, 'key', updates.key);
      delete instData.key;
      instData.credential_source = CREDENTIAL_SOURCE_LABELS.manual;
      instData.credential_env = credentialEnvName(instanceId, 'key');
    }
    if (updates.enabled !== undefined) instData.enabled = updates.enabled;
    saveConfig(config);
    return { status: 'ok' };
  });

  // 从外部工具导入当前实例的 API Key，并统一保存到 App 自己的 .api_panel.env
  ipcMain.handle('import-platform-credential', (_event, instanceId, source) => {
    return importCredentialFromSource(instanceId, source);
  });

  // ─── 应用信息 ───
  ipcMain.handle('get-version', () => PACKAGE.version);

  // ─── 外部链接（系统默认浏览器） ───
  ipcMain.handle('open-external', (_event, url) => {
    if (!url || typeof url !== 'string') return;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
  });

  // ─── 窗口控制（无边框自定义标题栏） ───
  ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });
  ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });
  ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });
  ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  // ─── 动态调整窗口高度以适配内容（自适应卡片布局） ───
  ipcMain.handle('resize-to-content', (_event, contentHeight) => {
    if (!mainWindow || mainWindow.isMaximized()) return;
    const { screen } = require('electron');
    const display = screen.getDisplayMatching(mainWindow.getBounds());
    const maxH = display.workArea.height;
    const bounds = mainWindow.getBounds();
    const [curW] = mainWindow.getContentSize();
    const chromeH = bounds.height - mainWindow.getContentSize()[1];
    const targetH = Math.max(400, Math.min(contentHeight + chromeH, maxH));
    mainWindow.setBounds({ x: bounds.x, y: bounds.y, width: curW, height: targetH });
  });

  // ─── 检查是否首次启动（无 layout 配置） ───
  ipcMain.handle('is-first-launch', () => {
    const config = loadConfig();
    return !config.layout || !Array.isArray(config.layout) || config.layout.length === 0;
  });
}

// ─── 窗口管理 ───
let mainWindow = null;

function createWindow() {
  const savedState = loadWindowState();

  const winOpts = {
    width: 560,       // 与列表 max-width 一致
    height: 780,
    minWidth: 460,
    minHeight: 600,
    title: 'API 聚合面板',
    frame: false,
    backgroundColor: '#0a0f0a',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  // 恢复上次窗口位置/大小
  if (savedState) {
    if (savedState.x !== undefined) winOpts.x = savedState.x;
    if (savedState.y !== undefined) winOpts.y = savedState.y;
    if (savedState.width) winOpts.width = savedState.width;
    if (savedState.height) winOpts.height = savedState.height;
  }

  mainWindow = new BrowserWindow(winOpts);

  // 恢复最大化状态
  if (savedState?.maximized) {
    mainWindow.maximize();
  }

  mainWindow.loadFile(path.join(ROOT, 'src', 'index.html'));

  // 保存窗口状态（关闭时）
  mainWindow.on('close', () => {
    saveWindowState(mainWindow);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 通知渲染进程窗口最大化状态变化
  mainWindow.on('maximize', () => {
    if (mainWindow) mainWindow.webContents.send('window:maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    if (mainWindow) mainWindow.webContents.send('window:maximized', false);
  });

  // 移动/调整大小时保存（500ms 防抖）
  let saveTimer = null;
  const debouncedSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (mainWindow) saveWindowState(mainWindow);
    }, 500);
  };
  mainWindow.on('move', debouncedSave);
  mainWindow.on('resize', debouncedSave);
}

// ─── 应用生命周期 ───
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // macOS 单实例：二次激活时聚焦已有窗口
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
