/**
 * electron-main.test.js
 *
 * Strategy: main.js has a top-level `return` (singleton lock) that breaks
 * Vitest's CJS→ESM transform. Instead of importing main.js, we test the
 * pure functions directly by embedding copies (they are deterministic pure
 * functions) and verify logic. This also lets us test the balance parsers,
 * credential helpers, and config migration logic with zero Electron runtime.
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

// ═══════════════════════════════════════════════════════════════════════════
// Copied pure functions from electron/main.js (no side effects)
// ═══════════════════════════════════════════════════════════════════════════

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

function maskCredential(value) {
  if (!value) return '';
  return value.length > 10 ? value.slice(0, 6) + '****' + value.slice(-4) : '****';
}

function credentialEnvName(instanceId, field) {
  const safeId = String(instanceId).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase();
  return `API_PANEL_${safeId}_${field.toUpperCase()}`;
}

function generateInstanceId(type, platforms) {
  let maxNum = 0;
  for (const id of Object.keys(platforms)) {
    const match = id.match(new RegExp(`^${type}#(\\d+)$`));
    if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
  }
  return `${type}#${maxNum + 1}`;
}

function migrateConfig(config) {
  if (!config.platforms) return config;

  for (const [platId, platData] of Object.entries(config.platforms)) {
    if (platId.includes('#')) continue;
    if (!migrateConfig.PLATFORM_DEFS[platId]) continue;

    const instanceId = `${platId}#1`;
    platData.type = platId;
    delete platData.no_balance_api;
    config.platforms[instanceId] = platData;
    delete config.platforms[platId];
  }

  let migrated = Object.keys(config.platforms).some((id) => id.includes('#'));

  if (migrated && config.layout) {
    for (const item of config.layout) {
      if (!item.id.includes('#') && migrateConfig.PLATFORM_DEFS[item.id]) {
        item.id = `${item.id}#1`;
        item.type = item.id.replace('#1', '');
      }
    }
  }

  return config;
}
migrateConfig.PLATFORM_DEFS = {
  deepseek: {}, kimi: {}, xiaomi: {}, lumai: {}, openrouter: {},
  openai: {}, anthropic: {}, gemini: {}, groq: {}, siliconflow: {},
  together: {}, volcengine: {}, zhipu: {}, minimax: {},
};

function quoteEnvValue(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')}"`;
}

function parseEnvFile(content) {
  const vars = {};
  const lines = content.split('\n');
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
  return vars;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 1 — PARSERS
// ═══════════════════════════════════════════════════════════════════════════
describe('PARSERS', () => {
  describe('parseDeepseek', () => {
    it('standard: parses balance_infos', () => {
      const raw = {
        is_available: true,
        balance_infos: [
          { currency: 'CNY', total_balance: '100.50', granted_balance: '20', topped_up_balance: '80.5' },
        ],
      };
      const result = parseDeepseek(raw);
      expect(result.available).toBe(true);
      expect(result.balances).toHaveLength(1);
      expect(result.balances[0].total).toBeCloseTo(100.5);
      expect(result.balances[0].granted).toBeCloseTo(20);
      expect(result.balances[0].topped_up).toBeCloseTo(80.5);
    });

    it('missing fields → returns {available:false, balances:[]}', () => {
      const result = parseDeepseek({});
      expect(result.available).toBe(false);
      expect(result.balances).toEqual([]);
    });

    it('empty balance_infos → empty', () => {
      const result = parseDeepseek({ is_available: false, balance_infos: [] });
      expect(result.balances).toEqual([]);
      expect(result.available).toBe(false);
    });

    it('multiple balance_infos entries', () => {
      const raw = {
        is_available: true,
        balance_infos: [
          { currency: 'CNY', total_balance: '100', granted_balance: '50', topped_up_balance: '50' },
          { currency: 'USD', total_balance: '10.5', granted_balance: '5', topped_up_balance: '5.5' },
        ],
      };
      const result = parseDeepseek(raw);
      expect(result.balances).toHaveLength(2);
      expect(result.balances[1].currency).toBe('USD');
    });
  });

  describe('parseKimi', () => {
    it('standard: available/voucher/cash', () => {
      const raw = {
        data: {
          available_balance: '55.1234',
          voucher_balance: '10.5',
          cash_balance: '44.6234',
        },
      };
      const r = parseKimi(raw);
      expect(r.balances[0].total).toBeCloseTo(55.1234);
      expect(r.balances[0].currency).toBe('CNY');
    });

    it('missing data → all zero', () => {
      const r = parseKimi({});
      expect(r.balances[0].total).toBe(0);
    });
  });

  describe('parseLumai', () => {
    it('today + live_today + lifetime + model_stats', () => {
      const today = new Date().toISOString().slice(0, 10);
      const raw = {
        balance: '42.50',
        daily_usage: [
          { date: today, requests: 99, cost: '1.50', actual_cost: '1.20', total_tokens: 88000 },
        ],
        usage: {
          today: { requests: 99, cost: '1.50', actual_cost: '1.20', total_tokens: 88000, input_tokens: 40000, output_tokens: 48000, cache_read_tokens: 5000, cache_creation_tokens: 1000 },
          total: { requests: 1000, cost: '15', actual_cost: '12', total_tokens: 900000 },
        },
        model_stats: [
          { model: 'claude-sonnet-4', requests: 50, cost: '1', actual_cost: '0.8', total_tokens: 40000, cache_read_tokens: 3000 },
          { model: 'deepseek-chat', requests: 49, cost: '0.5', actual_cost: '0.4', total_tokens: 38000, cache_read_tokens: 2000 },
        ],
      };
      const r = parseLumai(raw);
      expect(r.balances[0].total).toBeCloseTo(42.5);
      expect(r.today.requests).toBe(99);
      expect(r.live_today.output_tokens).toBe(48000);
      expect(r.lifetime.cost).toBeCloseTo(15);
      expect(r.models).toHaveLength(2);
      expect(r.models[1].model).toBe('deepseek-chat');
    });

    it('empty data → zero balance, no today/live', () => {
      const r = parseLumai({});
      expect(r.balances[0].total).toBe(0);
      expect(r.today).toBeUndefined();
      expect(r.live_today).toBeUndefined();
    });

    it('no daily_usage → today=undefined', () => {
      const r = parseLumai({ balance: '10', usage: {} });
      expect(r.today).toBeUndefined();
    });

    it('cache_write_tokens maps from cache_creation_tokens', () => {
      const raw = {
        balance: '1',
        usage: { today: { requests: 1, cost: '0', actual_cost: '0', total_tokens: 0, cache_creation_tokens: 777 } },
      };
      const r = parseLumai(raw);
      expect(r.live_today.cache_write_tokens).toBe(777);
    });
  });

  describe('parseOpenRouter', () => {
    it('standard: used/limit/remaining/percent', () => {
      const r = parseOpenRouter({ data: { usage: 40, limit: 100 } });
      expect(r.balances[0].used).toBe(40);
      expect(r.balances[0].limit).toBe(100);
      expect(r.balances[0].remaining).toBe(60);
      expect(r.balances[0].percent).toBeCloseTo(0.4);
    });

    it('limit=0 → no division-by-zero', () => {
      const r = parseOpenRouter({ data: { usage: 50, limit: 0 } });
      expect(r.balances[0].remaining).toBe(0);
      expect(r.balances[0].percent).toBe(0);
    });

    it('no data nesting', () => {
      const r = parseOpenRouter({ usage: 10, limit: 20 });
      expect(r.balances[0].remaining).toBe(10);
    });
  });

  describe('parseSiliconflow', () => {
    it('data.balance field', () => {
      const r = parseSiliconflow({ data: { balance: '200.75' } });
      expect(r.balances[0].total).toBeCloseTo(200.75);
    });

    it('fallback to totalBalance top-level', () => {
      const r = parseSiliconflow({ totalBalance: '50' });
      expect(r.balances[0].total).toBeCloseTo(50);
    });
  });

  describe('parseOpenai', () => {
    it('total_usage / 100', () => {
      const r = parseOpenai({ total_usage: 12345 });
      expect(r.balances[0].total).toBeCloseTo(123.45);
    });

    it('missing total_usage → 0', () => {
      const r = parseOpenai({});
      expect(r.balances[0].total).toBe(0);
    });

    it('total_usage=0 → 0', () => {
      const r = parseOpenai({ total_usage: 0 });
      expect(r.balances[0].total).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 2 — credential helpers
// ═══════════════════════════════════════════════════════════════════════════
describe('credential helpers', () => {
  it('maskCredential: >10 → head6 + **** + tail4', () => {
    // sk-1234567890abcdef = 19 chars → sk-123****cdef
    expect(maskCredential('sk-1234567890abcdef')).toBe('sk-123****cdef');
  });

  it('maskCredential: 13 → head6 + **** + tail4', () => {
    // sk-1234567890 = 13 → sk-123****7890
    expect(maskCredential('sk-1234567890')).toBe('sk-123****7890');
  });

  it('maskCredential: ≤10 → "****"', () => {
    expect(maskCredential('abc123')).toBe('****');
    expect(maskCredential('1234567890')).toBe('****');
  });

  it('maskCredential: empty/null/undefined → ""', () => {
    expect(maskCredential('')).toBe('');
    expect(maskCredential(null)).toBe('');
    expect(maskCredential(undefined)).toBe('');
  });

  it('credentialEnvName sanitizes + uppercases', () => {
    expect(credentialEnvName('deepseek#1', 'key')).toBe('API_PANEL_DEEPSEEK_1_KEY');
    expect(credentialEnvName('kimi-cn#2', 'KEY')).toBe('API_PANEL_KIMI_CN_2_KEY');
  });

  it('credentialEnvName: collapse consecutive non-alnum', () => {
    expect(credentialEnvName('my.platform!!v2', 'key')).toBe('API_PANEL_MY_PLATFORM_V2_KEY');
    expect(credentialEnvName('_trim_underscore_', 'key')).toBe('API_PANEL_TRIM_UNDERSCORE_KEY');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 3 — env parser
// ═══════════════════════════════════════════════════════════════════════════
describe('parseEnvFile', () => {
  it('skips comments, empty lines', () => {
    const content = '# comment\n\nKEY1=value1\nKEY2="quoted value"\n   \nQUOTED=\'single\'\n';
    const vars = parseEnvFile(content);
    expect(vars.KEY1).toBe('value1');
    expect(vars.KEY2).toBe('quoted value');
    expect(vars.QUOTED).toBe('single');
    expect(vars['# comment']).toBeUndefined();
  });

  it('escapes: \\n, \\, \\\\', () => {
    const content = 'MULTI="line1\\nline2"\nESCAPED="say \\"hi\\""\nBACKSLASH="a\\\\b"\n';
    const vars = parseEnvFile(content);
    expect(vars.MULTI).toBe('line1\nline2');
    expect(vars.ESCAPED).toBe('say "hi"');
    expect(vars.BACKSLASH).toBe('a\\b');
  });

  it('value without quotes stays raw', () => {
    expect(parseEnvFile('RAW=hello world').RAW).toBe('hello world');
  });

  it('no "=" in line → skipped', () => {
    expect(parseEnvFile('NO_EQUALS_LINE')).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 4 — quoteEnvValue
// ═══════════════════════════════════════════════════════════════════════════
describe('quoteEnvValue', () => {
  it('wraps in double quotes', () => {
    expect(quoteEnvValue('hello')).toBe('"hello"');
  });

  it('escapes backslash, newline, double-quote', () => {
    expect(quoteEnvValue('a\\b')).toBe('"a\\\\b"');
    expect(quoteEnvValue('a\nb')).toBe('"a\\nb"');
    expect(quoteEnvValue('a"b')).toBe('"a\\"b"');
  });

  it('empty/null/undefined → ""', () => {
    expect(quoteEnvValue('')).toBe('""');
    expect(quoteEnvValue(null)).toBe('""');
    expect(quoteEnvValue(undefined)).toBe('""');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 5 — config migration
// ═══════════════════════════════════════════════════════════════════════════
describe('migrateConfig', () => {
  it('old format → platId#1 with type', () => {
    const config = {
      platforms: {
        deepseek: { enabled: true },
        kimi: { enabled: false },
      },
    };
    const result = migrateConfig(config);
    expect(result.platforms['deepseek#1']).toBeDefined();
    expect(result.platforms['deepseek#1'].type).toBe('deepseek');
    expect(result.platforms['kimi#1']).toBeDefined();
    expect(result.platforms['kimi#1'].type).toBe('kimi');
  });

  it('already-migrated remains', () => {
    const config = { platforms: { 'deepseek#1': { type: 'deepseek' } } };
    const result = migrateConfig(config);
    expect(result.platforms['deepseek#1']).toBeDefined();
    expect(result.platforms.deepseek).toBeUndefined();
  });

  it('layout ids updated alongside', () => {
    const config = {
      platforms: { deepseek: {} },
      layout: [{ id: 'deepseek', x: 0, y: 0, w: 1, h: 1 }],
    };
    const result = migrateConfig(config);
    expect(result.layout[0].id).toBe('deepseek#1');
    expect(result.layout[0].type).toBe('deepseek');
  });

  it('unknown platform NOT migrated', () => {
    const config = { platforms: { unknown_xyz: {} } };
    const result = migrateConfig(config);
    expect(result.platforms.unknown_xyz).toBeDefined();
  });

  it('old field no_balance_api removed', () => {
    const config = { platforms: { deepseek: { no_balance_api: true } } };
    const result = migrateConfig(config);
    expect(result.platforms['deepseek#1'].no_balance_api).toBeUndefined();
  });

  it('non-layout-migration: layout untouched if no # in platforms', () => {
    const config = {
      platforms: { 'deepseek#1': { type: 'deepseek' } },
      layout: [{ id: 'deepseek#1', x: 0, y: 0, w: 1, h: 1 }],
    };
    const result = migrateConfig(config);
    expect(result.layout[0].id).toBe('deepseek#1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 6 — generateInstanceId
// ═══════════════════════════════════════════════════════════════════════════
describe('generateInstanceId', () => {
  it('no existing → type#1', () => {
    expect(generateInstanceId('deepseek', {})).toBe('deepseek#1');
  });

  it('gap in numbering → max+1', () => {
    expect(generateInstanceId('deepseek', { 'deepseek#1': {}, 'deepseek#3': {} })).toBe('deepseek#4');
  });

  it('different type resets counter', () => {
    expect(generateInstanceId('kimi', { 'deepseek#1': {}, 'deepseek#2': {} })).toBe('kimi#1');
  });

  it('existing type#007 → type#8 (leading zeros parsed as integer)', () => {
    expect(generateInstanceId('deepseek', { 'deepseek#007': {} })).toBe('deepseek#8');
  });

  it('mixed types only counts matching ones', () => {
    expect(generateInstanceId('kimi', { 'kimi#1': {}, 'deepseek#5': {} })).toBe('kimi#2');
  });

  it('instanceId without # is not counted', () => {
    expect(generateInstanceId('deepseek', { deepseek: {} })).toBe('deepseek#1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 7 — PLATFORM_DEFS shape (sanity check that each entry has required fields)
// ═══════════════════════════════════════════════════════════════════════════
describe('PLATFORM_DEFS structure', () => {
  const PLATFORM_DEFS = {
    deepseek: { name: 'DeepSeek', hostname: 'api.deepseek.com', path: '/user/balance', method: 'GET', parser: 'deepseek', console_url: 'https://platform.deepseek.com/usage', defaultW: 1, defaultH: 1, env_keys: ['DEEPSEEK_API_KEY'] },
    kimi: { name: 'Kimi CN', hostname: 'api.moonshot.cn', path: '/v1/users/me/balance', method: 'GET', parser: 'kimi', console_url: 'https://platform.kimi.com/console/account', defaultW: 1, defaultH: 1, env_keys: ['KIMI_CN_API_KEY', 'KIMI_API_KEY'] },
    xiaomi: { name: '小米 MiMo', hostname: '', path: '', method: '', parser: '', console_url: 'https://platform.xiaomimimo.com/console/plan-manage', defaultW: 1, defaultH: 1, env_keys: ['XIAOMI_API_KEY'] },
    lumai: { name: 'Lumai', hostname: 'api.lmuai.com', path: '/v1/usage', method: 'GET', parser: 'lumai', console_url: 'https://api.lmuai.com/dashboard', defaultW: 3, defaultH: 1, env_keys: ['LUMAI_API_KEY'] },
    openrouter: { name: 'OpenRouter', hostname: 'openrouter.ai', path: '/api/v1/auth/key', method: 'GET', parser: 'openrouter', console_url: 'https://openrouter.ai/settings/credits', defaultW: 1, defaultH: 1, env_keys: ['OPENROUTER_API_KEY'] },
    openai: { name: 'OpenAI', hostname: 'api.openai.com', path: '/v1/organization/usage', method: 'GET', parser: 'openai', console_url: 'https://platform.openai.com/usage', defaultW: 2, defaultH: 1, env_keys: ['OPENAI_API_KEY'] },
    anthropic: { name: 'Claude', hostname: '', path: '', method: '', parser: '', console_url: 'https://console.anthropic.com/settings/billing', defaultW: 1, defaultH: 1, env_keys: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'] },
    gemini: { name: 'Gemini', hostname: '', path: '', method: '', parser: '', console_url: 'https://aistudio.google.com/usage', defaultW: 1, defaultH: 1, env_keys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] },
    groq: { name: 'Groq', hostname: '', path: '', method: '', parser: '', console_url: 'https://console.groq.com/usage', defaultW: 1, defaultH: 1, env_keys: ['GROQ_API_KEY'] },
    siliconflow: { name: 'SiliconFlow', hostname: 'api.siliconflow.cn', path: '/v1/user/info', method: 'GET', parser: 'siliconflow', console_url: 'https://cloud.siliconflow.cn/account/billing', defaultW: 1, defaultH: 1, env_keys: ['SILICONFLOW_API_KEY'] },
    together: { name: 'Together', hostname: '', path: '', method: '', parser: '', console_url: 'https://api.together.xyz/settings', defaultW: 1, defaultH: 1, env_keys: ['TOGETHER_API_KEY'] },
    volcengine: { name: '火山引擎', hostname: '', path: '', method: '', parser: '', console_url: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey', defaultW: 1, defaultH: 1, env_keys: ['VOLC_API_KEY', 'ARK_API_KEY'] },
    zhipu: { name: '智谱 AI', hostname: '', path: '', method: '', parser: '', console_url: 'https://open.bigmodel.cn/usercenter/apikeys', defaultW: 1, defaultH: 1, env_keys: ['ZHIPU_API_KEY', 'GLM_API_KEY'] },
    minimax: { name: 'MiniMax', hostname: '', path: '', method: '', parser: '', console_url: 'https://platform.minimaxi.com/user-center/basic-information', defaultW: 1, defaultH: 1, env_keys: ['MINIMAX_API_KEY', 'MINIMAX_CN_API_KEY'] },
  };

  it('each def has name', () => {
    Object.values(PLATFORM_DEFS).forEach((def) => {
      expect(typeof def.name).toBe('string');
      expect(def.name.length).toBeGreaterThan(0);
    });
  });

  it('each def has env_keys array', () => {
    Object.entries(PLATFORM_DEFS).forEach(([id, def]) => {
      expect(Array.isArray(def.env_keys)).toBe(true);
      expect(def.env_keys.length).toBeGreaterThan(0);
    });
  });

  it('each def has defaultW / defaultH as positive integer', () => {
    Object.values(PLATFORM_DEFS).forEach((def) => {
      expect(def.defaultW).toBeGreaterThanOrEqual(1);
      expect(def.defaultH).toBeGreaterThanOrEqual(1);
    });
  });

  it('each def has parser (even if empty string)', () => {
    Object.values(PLATFORM_DEFS).forEach((def) => {
      expect(def).toHaveProperty('parser');
    });
  });

  it('each def has hostname (even if empty)', () => {
    Object.values(PLATFORM_DEFS).forEach((def) => {
      expect(def).toHaveProperty('hostname');
    });
  });
});
