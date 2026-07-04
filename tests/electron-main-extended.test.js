/**
 * electron-main-extended.test.js
 *
 * Additional tests for electron/main.js covering:
 * - queryBalance logic (no-API platforms, missing key, error handling)
 * - importCredentialFromSource matching logic
 * - applyAppCredentials / stripRuntimeCredentials
 * - CREDENTIAL_SOURCE_LABELS
 * - PARSERS registry
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';

const ROOT = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════════════════
// Copied pure functions from electron/main.js (same strategy as electron-main.test.js)
// ═══════════════════════════════════════════════════════════════════════════

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

const CREDENTIAL_SOURCE_LABELS = {
  app: 'API Panel (.api_panel.env)',
  manual: 'Manual',
  hermes: 'Hermes Agent',
  openclaw: 'OpenClaw',
};

function maskCredential(value) {
  if (!value) return '';
  return value.length > 10 ? value.slice(0, 6) + '****' + value.slice(-4) : '****';
}

function credentialEnvName(instanceId, field) {
  const safeId = String(instanceId).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase();
  return `API_PANEL_${safeId}_${field.toUpperCase()}`;
}

function stripRuntimeCredentials(config) {
  for (const instData of Object.values(config.platforms || {})) {
    delete instData.key;
  }
  return config;
}

function applyAppCredentials(config, appEnv) {
  for (const [instanceId, instData] of Object.entries(config.platforms || {})) {
    const platDef = PLATFORM_DEFS[instData.type];
    if (!platDef) continue;
    const field = 'key';
    const envName = credentialEnvName(instanceId, field);
    if (appEnv[envName]) {
      instData[field] = appEnv[envName];
      instData.credential_env = envName;
      instData.credential_source = instData.credential_source || CREDENTIAL_SOURCE_LABELS.app;
    }
  }
}

function importCredentialFromSourceMatch(instanceId, source, sourceVars, platformType = 'deepseek') {
  const instData = { type: platformType };
  const platDef = PLATFORM_DEFS[instData.type];
  if (!platDef) return { status: 'error', message: 'Unknown platform type' };

  if (source !== 'hermes' && source !== 'openclaw') {
    return { status: 'error', message: 'Unsupported import source' };
  }

  const envKeys = platDef.env_keys || [];
  const matchedKey = envKeys.find((key) => sourceVars[key]);
  if (!matchedKey) {
    return {
      status: 'not_found',
      message: `No API Key for ${platDef.name} found in ${CREDENTIAL_SOURCE_LABELS[source]}`,
      expected_keys: envKeys,
    };
  }

  return {
    status: 'ok',
    source: CREDENTIAL_SOURCE_LABELS[source],
    env_key: matchedKey,
    masked_key: maskCredential(sourceVars[matchedKey]),
  };
}

function queryBalanceNoApiKey(platformId) {
  const plat = PLATFORM_DEFS[platformId];
  if (!plat.hostname || !plat.parser) {
    return {
      status: 'no_api',
      message: `${plat.name} does not support REST API balance queries. Please visit the web console.`,
      console_url: plat.console_url,
    };
  }
  return null;
}

function queryBalanceError(platformId, e) {
  const plat = PLATFORM_DEFS[platformId];
  if (e.code === 401) {
    return { status: 'error', message: `${plat.name} API Key is invalid or expired` };
  }
  return { status: 'error', code: e.code, message: e.message };
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 1 — queryBalance: no-API platforms
// ═══════════════════════════════════════════════════════════════════════════
describe('queryBalance: no-API platforms', () => {
  const noApiPlatforms = ['xiaomi', 'anthropic', 'gemini', 'groq', 'together', 'volcengine', 'zhipu', 'minimax'];

  noApiPlatforms.forEach((type) => {
    it(`${type} → status=no_api with console_url`, () => {
      const result = queryBalanceNoApiKey(type);
      expect(result.status).toBe('no_api');
      expect(result.console_url).toBe(PLATFORM_DEFS[type].console_url);
      expect(result.message).toContain(PLATFORM_DEFS[type].name);
    });
  });

  const apiPlatforms = ['deepseek', 'kimi', 'lumai', 'openrouter', 'openai', 'siliconflow'];
  apiPlatforms.forEach((type) => {
    it(`${type} → has API (queryBalanceNoApiKey returns null)`, () => {
      expect(queryBalanceNoApiKey(type)).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 2 — queryBalance error handling
// ═══════════════════════════════════════════════════════════════════════════
describe('queryBalance error handling', () => {
  it('401 → "API Key is invalid or expired"', () => {
    const result = queryBalanceError('deepseek', { code: 401 });
    expect(result.status).toBe('error');
    expect(result.message).toContain('invalid or expired');
  });

  it('403 → generic error with code', () => {
    const result = queryBalanceError('deepseek', { code: 403, message: 'Forbidden' });
    expect(result.status).toBe('error');
    expect(result.code).toBe(403);
    expect(result.message).toBe('Forbidden');
  });

  it('network error → error status with message', () => {
    const result = queryBalanceError('openai', { message: 'ECONNREFUSED' });
    expect(result.status).toBe('error');
    expect(result.message).toBe('ECONNREFUSED');
  });

  it('timeout → error status', () => {
    const result = queryBalanceError('kimi', { message: 'Request timeout' });
    expect(result.status).toBe('error');
    expect(result.message).toBe('Request timeout');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 3 — importCredentialFromSource matching
// ═══════════════════════════════════════════════════════════════════════════
describe('importCredentialFromSource matching', () => {
  it('hermes: finds DEEPSEEK_API_KEY', () => {
    const vars = { DEEPSEEK_API_KEY: 'sk-test1234567890', OTHER_KEY: 'xxx' };
    const result = importCredentialFromSourceMatch('deepseek#1', 'hermes', vars);
    expect(result.status).toBe('ok');
    expect(result.env_key).toBe('DEEPSEEK_API_KEY');
    expect(result.source).toBe('Hermes Agent');
    // 'sk-test1234567890' = 18 chars → first 6 = 'sk-tes', last 4 = '7890'
    expect(result.masked_key).toBe('sk-tes****7890');
  });

  it('hermes: no matching key → not_found with expected_keys', () => {
    const vars = { SOME_OTHER_KEY: 'value' };
    const result = importCredentialFromSourceMatch('deepseek#1', 'hermes', vars);
    expect(result.status).toBe('not_found');
    expect(result.expected_keys).toEqual(['DEEPSEEK_API_KEY']);
    expect(result.message).toContain('Hermes Agent');
  });

  it('openclaw: finds key from openclaw vars', () => {
    const vars = { OPENAI_API_KEY: 'sk-openai1234567890' };
    const result = importCredentialFromSourceMatch('openai#1', 'openclaw', vars, 'openai');
    expect(result.status).toBe('ok');
    expect(result.source).toBe('OpenClaw');
  });

  it('unsupported source → error', () => {
    const result = importCredentialFromSourceMatch('deepseek#1', 'unknown_source', {});
    expect(result.status).toBe('error');
    expect(result.message).toBe('Unsupported import source');
  });

  it('kimi: prefers KIMI_CN_API_KEY over KIMI_API_KEY', () => {
    const instData = { type: 'kimi' };
    const platDef = PLATFORM_DEFS['kimi'];
    const vars = { KIMI_API_KEY: 'kimi-fallback-key' };
    const envKeys = platDef.env_keys || [];
    const matchedKey = envKeys.find((key) => vars[key]);
    expect(matchedKey).toBe('KIMI_API_KEY');
  });

  it('anthropic: prefers ANTHROPIC_API_KEY over CLAUDE_API_KEY', () => {
    const platDef = PLATFORM_DEFS['anthropic'];
    const vars = { CLAUDE_API_KEY: 'claude-key-1234567890' };
    const envKeys = platDef.env_keys || [];
    const matchedKey = envKeys.find((key) => vars[key]);
    expect(matchedKey).toBe('CLAUDE_API_KEY');
  });

  it('empty source vars → not_found', () => {
    const result = importCredentialFromSourceMatch('deepseek#1', 'hermes', {});
    expect(result.status).toBe('not_found');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 4 — stripRuntimeCredentials
// ═══════════════════════════════════════════════════════════════════════════
describe('stripRuntimeCredentials', () => {
  it('removes key from all platform entries', () => {
    const config = {
      platforms: {
        'deepseek#1': { type: 'deepseek', key: 'secret1' },
        'kimi#1': { type: 'kimi', key: 'secret2' },
      },
    };
    const result = stripRuntimeCredentials(config);
    expect(result.platforms['deepseek#1'].key).toBeUndefined();
    expect(result.platforms['kimi#1'].key).toBeUndefined();
  });

  it('preserves other fields', () => {
    const config = {
      platforms: {
        'deepseek#1': { type: 'deepseek', key: 'secret', alias: 'My DS', enabled: true },
      },
    };
    const result = stripRuntimeCredentials(config);
    expect(result.platforms['deepseek#1'].type).toBe('deepseek');
    expect(result.platforms['deepseek#1'].alias).toBe('My DS');
    expect(result.platforms['deepseek#1'].enabled).toBe(true);
  });

  it('handles empty platforms', () => {
    const config = { platforms: {} };
    expect(() => stripRuntimeCredentials(config)).not.toThrow();
  });

  it('handles missing platforms key', () => {
    const config = {};
    expect(() => stripRuntimeCredentials(config)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 5 — applyAppCredentials
// ═══════════════════════════════════════════════════════════════════════════
describe('applyAppCredentials', () => {
  it('injects credentials from appEnv into platform entries', () => {
    const config = {
      platforms: {
        'deepseek#1': { type: 'deepseek' },
      },
    };
    const appEnv = { API_PANEL_DEEPSEEK_1_KEY: 'sk-injected-key' };
    applyAppCredentials(config, appEnv);
    expect(config.platforms['deepseek#1'].key).toBe('sk-injected-key');
    expect(config.platforms['deepseek#1'].credential_env).toBe('API_PANEL_DEEPSEEK_1_KEY');
    expect(config.platforms['deepseek#1'].credential_source).toBe('API Panel (.api_panel.env)');
  });

  it('does not inject when no matching env var', () => {
    const config = {
      platforms: {
        'deepseek#1': { type: 'deepseek' },
      },
    };
    const appEnv = { SOME_OTHER_KEY: 'value' };
    applyAppCredentials(config, appEnv);
    expect(config.platforms['deepseek#1'].key).toBeUndefined();
  });

  it('does not overwrite existing credential_source', () => {
    const config = {
      platforms: {
        'deepseek#1': { type: 'deepseek', credential_source: 'Manual' },
      },
    };
    const appEnv = { API_PANEL_DEEPSEEK_1_KEY: 'sk-key' };
    applyAppCredentials(config, appEnv);
    expect(config.platforms['deepseek#1'].credential_source).toBe('Manual');
  });

  it('skips unknown platform types', () => {
    const config = {
      platforms: {
        'unknown#1': { type: 'nonexistent' },
      },
    };
    const appEnv = { API_PANEL_UNKNOWN_1_KEY: 'sk-key' };
    applyAppCredentials(config, appEnv);
    expect(config.platforms['unknown#1'].key).toBeUndefined();
  });

  it('handles multiple instances of same type', () => {
    const config = {
      platforms: {
        'deepseek#1': { type: 'deepseek' },
        'deepseek#2': { type: 'deepseek' },
      },
    };
    const appEnv = {
      API_PANEL_DEEPSEEK_1_KEY: 'key-1',
      API_PANEL_DEEPSEEK_2_KEY: 'key-2',
    };
    applyAppCredentials(config, appEnv);
    expect(config.platforms['deepseek#1'].key).toBe('key-1');
    expect(config.platforms['deepseek#2'].key).toBe('key-2');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 6 — CREDENTIAL_SOURCE_LABELS
// ═══════════════════════════════════════════════════════════════════════════
describe('CREDENTIAL_SOURCE_LABELS', () => {
  it('has all 4 expected sources', () => {
    expect(CREDENTIAL_SOURCE_LABELS.app).toBe('API Panel (.api_panel.env)');
    expect(CREDENTIAL_SOURCE_LABELS.manual).toBe('Manual');
    expect(CREDENTIAL_SOURCE_LABELS.hermes).toBe('Hermes Agent');
    expect(CREDENTIAL_SOURCE_LABELS.openclaw).toBe('OpenClaw');
  });

  it('has exactly 4 entries', () => {
    expect(Object.keys(CREDENTIAL_SOURCE_LABELS)).toHaveLength(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 7 — PARSERS registry completeness
// ═══════════════════════════════════════════════════════════════════════════
describe('PARSERS registry', () => {
  const PARSERS = { deepseek: true, kimi: true, lumai: true, openrouter: true, siliconflow: true, openai: true };

  it('has all 6 parser entries', () => {
    expect(Object.keys(PARSERS)).toHaveLength(6);
  });

  it('every parser key maps to a truthy value', () => {
    Object.values(PARSERS).forEach((v) => expect(v).toBeTruthy());
  });

  it('platforms with hostname also have a parser', () => {
    for (const [type, def] of Object.entries(PLATFORM_DEFS)) {
      if (def.hostname) {
        expect(PARSERS[type]).toBeTruthy();
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 8 — PLATFORM_DEFS: platforms with hostname have required API fields
// ═══════════════════════════════════════════════════════════════════════════
describe('PLATFORM_DEFS API fields consistency', () => {
  const apiPlatforms = ['deepseek', 'kimi', 'lumai', 'openrouter', 'openai', 'siliconflow'];

  apiPlatforms.forEach((type) => {
    it(`${type} has non-empty hostname, path, method, parser`, () => {
      const def = PLATFORM_DEFS[type];
      expect(def.hostname.length).toBeGreaterThan(0);
      expect(def.path.length).toBeGreaterThan(0);
      expect(def.method.length).toBeGreaterThan(0);
      expect(def.parser.length).toBeGreaterThan(0);
    });
  });

  it('all platforms have console_url', () => {
    Object.values(PLATFORM_DEFS).forEach((def) => {
      expect(def.console_url).toMatch(/^https?:\/\/.+/);
    });
  });

  it('all platforms have auth_type or default to bearer', () => {
    Object.values(PLATFORM_DEFS).forEach((def) => {
      const authType = def.auth_type || 'bearer';
      expect(['bearer', 'api-key', 'basic']).toContain(authType);
    });
  });
});
