// ⚡ API 聚合面板 — Electron 主进程
// 职责：IPC 处理余额查询、配置管理、窗口生命周期

const { app, BrowserWindow, ipcMain, shell } = require('electron');
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
const ENV_FILE = path.join(HOME, '.hermes', '.env');
const STATE_FILE = path.join(CONFIG_DIR, 'state.json');

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

// ─── 平台定义 ───
const PLATFORM_DEFS = {
  deepseek: {
    name: 'DeepSeek',
    hostname: 'api.deepseek.com',
    path: '/user/balance',
    method: 'GET',
    parser: 'deepseek',
    console_url: 'https://platform.deepseek.com/usage',
  },
  kimi: {
    name: 'Kimi CN',
    hostname: 'api.moonshot.cn',
    path: '/v1/users/me/balance',
    method: 'GET',
    parser: 'kimi',
    console_url: 'https://platform.kimi.com/console/account',
  },
  xiaomi: {
    name: '小米 MiMo',
    hostname: null,
    path: null,
    method: null,
    parser: null,
    console_url: 'https://platform.xiaomimimo.com/console/billing',
  },
  lumai: {
    name: 'Lumai',
    hostname: 'api.lmuai.com',
    path: '/v1/usage',
    method: 'GET',
    parser: 'lumai',
    console_url: 'https://api.lmuai.com/dashboard',
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

  // ─── 今日/最近用量（来自 daily_usage） ───
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

  // ─── 实时今日用量（usage.today，比 daily_usage 更准） ───
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

  // ─── 终身统计 ───
  if (data.usage && data.usage.total) {
    const t = data.usage.total;
    result.lifetime = {
      requests: t.requests || 0,
      cost: parseFloat(t.cost || 0),
      actual_cost: parseFloat(t.actual_cost || 0),
      total_tokens: t.total_tokens || 0,
    };
  }

  // ─── 按模型拆分 ───
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

const PARSERS = { deepseek: parseDeepseek, kimi: parseKimi, lumai: parseLumai };

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
  try {
    const raw = await httpsGet(plat.hostname, plat.path, apiKey);
    const parser = PARSERS[plat.parser];
    const data = parser ? parser(raw) : raw;
    return { status: 'ok', data, raw };
  } catch (e) {
    return { status: 'error', code: e.code, message: e.message };
  }
}

// ─── 配置管理 ───
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
        // 迁移到新路径
        if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
      } catch (_) { /* ignore */ }
    }
  }

  // 自动从 Hermes .env 注入
  if (config.auto_load_env !== false && fs.existsSync(ENV_FILE)) {
    const envVars = {};
    const lines = fs.readFileSync(ENV_FILE, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eqIdx = trimmed.indexOf('=');
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      envVars[k] = v;
    }

    const envMap = {
      DEEPSEEK_API_KEY: 'deepseek',
      KIMI_CN_API_KEY: 'kimi',
      XIAOMI_API_KEY: 'xiaomi',
      LUMAI_API_KEY: 'lumai',
    };
    for (const [envKey, platId] of Object.entries(envMap)) {
      if (envVars[envKey] && !config.platforms[platId]?.key) {
        config.platforms[platId] = config.platforms[platId] || {};
        config.platforms[platId].key = envVars[envKey];
        config.platforms[platId].alias = PLATFORM_DEFS[platId].name;
        if (!PLATFORM_DEFS[platId].hostname) {
          config.platforms[platId].no_balance_api = true;
        }
      }
    }
  }
  return config;
}

function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// ─── IPC 处理 ───
function registerIpcHandlers() {
  // 获取平台列表
  ipcMain.handle('get-platforms', () => {
    const config = loadConfig();
    const result = [];
    for (const [platId, platDef] of Object.entries(PLATFORM_DEFS)) {
      const platConfig = config.platforms[platId] || {};
      const key = platConfig.key || '';
      const maskedKey = key.length > 10
        ? key.slice(0, 6) + '****' + key.slice(-4)
        : (key ? '****' : '');
      result.push({
        id: platId,
        name: platDef.name,
        alias: platConfig.alias || platDef.name,
        has_key: !!key,
        masked_key: maskedKey,
        has_balance_api: !!platDef.hostname,
        console_url: platDef.console_url,
        enabled: platConfig.enabled !== false && !!key,
      });
    }
    return result;
  });

  // 刷新单个平台
  ipcMain.handle('refresh-platform', async (_event, platId) => {
    if (!PLATFORM_DEFS[platId]) {
      return { error: 'Unknown platform' };
    }
    const config = loadConfig();
    const platConfig = config.platforms[platId] || {};
    const key = platConfig.key;
    if (!key) {
      return { error: 'No API key configured' };
    }
    const result = await queryBalance(platId, key);
    return {
      alias: platConfig.alias || PLATFORM_DEFS[platId].name,
      result,
    };
  });

  // 刷新全部
  ipcMain.handle('refresh-all', async () => {
    const config = loadConfig();
    const results = {};
    const promises = Object.entries(PLATFORM_DEFS).map(async ([platId, platDef]) => {
      const platConfig = config.platforms[platId] || {};
      const key = platConfig.key;
      if (!key || platConfig.enabled === false) return;
      results[platId] = {
        alias: platConfig.alias || platDef.name,
        result: await queryBalance(platId, key),
      };
    });
    await Promise.all(promises);
    return results;
  });

  // 更新平台配置
  ipcMain.handle('update-platform', (_event, platId, updates) => {
    if (!PLATFORM_DEFS[platId]) {
      return { error: 'Unknown platform' };
    }
    const config = loadConfig();
    const platConfig = config.platforms[platId] = config.platforms[platId] || {};
    if (updates.alias !== undefined) platConfig.alias = updates.alias;
    if (updates.key !== undefined) platConfig.key = updates.key;
    if (updates.enabled !== undefined) platConfig.enabled = updates.enabled;
    saveConfig(config);
    return { status: 'ok' };
  });

  // ─── 应用信息 ───
  ipcMain.handle('get-version', () => PACKAGE.version);

  // ─── 外部链接（系统默认浏览器） ───
  ipcMain.handle('open-external', (_event, url) => {
    if (!url || typeof url !== 'string') return;
    // 只允许 http/https，防止 shell.openExternal 被滥用
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
}

// ─── 窗口管理 ───
let mainWindow = null;

function createWindow() {
  const savedState = loadWindowState();

  const winOpts = {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'API 聚合面板',
    frame: false,
    transparent: true,
    titleBarStyle: 'hidden',
    // 不需要 backgroundColor：transparent 窗口由 CSS 自行绘制背景
    // 否则圆角边缘会显示该颜色而非透明
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),  // electron/preload.js
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
});

app.on('window-all-closed', () => {
  app.quit();
});
