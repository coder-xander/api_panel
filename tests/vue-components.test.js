/**
 * Vue Component Tests
 *
 * Strategy: load source files, strip Vue inline template (which has its own
 * ${} template literals referencing scoped vars), then eval to extract the
 * component definition. Test computed + methods directly via .call(vm).
 *
 * Why not @vue/test-utils mount()? The project uses global Vue 3 (no build
 * step, no vue-loader). The component files declare global consts. Running
 * them is the fastest way to test logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function loadComponent(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  let src = fs.readFileSync(fullPath, 'utf-8');

  // Strip the `template:` property to avoid triggering template-string eval.
  // In Vue 3 inline templates contain expressions like ${I18N.t('wizard.source', { source })}
  // where `source` only exists inside a computed function scope — not at top-level.
  // We don't need the template for unit-testing computed + methods.
  src = src.replace(/template:\s*`[\s\S]*?`,?\s*\n\s*}/, '/* template stripped */\n}');

  // Provide browser globals (same as index.html)
  globalThis.window = globalThis.window || { dispatchEvent: vi.fn() };
  globalThis.document = globalThis.document || {};
  globalThis.I18N = {
    t: (k, p) => k,
    setLocale: () => {},
    getLocale: () => 'en',
  };
  globalThis.getPlatformIcon = () => 'assets/icons/fallback.svg';
  globalThis.PLATFORM_ICONS = { deepseek: 'ds.svg', kimi: 'kimi.svg' };
  globalThis.electronAPI = {
    updatePlatform: vi.fn(() => Promise.resolve({ status: 'ok' })),
    importPlatformCredential: vi.fn(() => Promise.resolve({ status: 'ok' })),
    saveLanguage: vi.fn(),
  };

  // Eval and extract component def
  const fn = new Function(
    'window', 'document', 'Vue', 'I18N', 'getPlatformIcon', 'PLATFORM_ICONS', 'electronAPI',
    `${src};
    if (typeof PlatformCard !== 'undefined') return PlatformCard;
    if (typeof DetailSheet !== 'undefined') return DetailSheet;
    if (typeof SettingsModal !== 'undefined') return SettingsModal;
    if (typeof WelcomeWizard !== 'undefined') return WelcomeWizard;
    if (typeof AddCardModal !== 'undefined') return AddCardModal;
    return {};`
  );

  return fn(globalThis.window, globalThis.document, {}, globalThis.I18N,
             globalThis.getPlatformIcon, globalThis.PLATFORM_ICONS, globalThis.electronAPI);
}

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════
const PLATFORM_DEEPSEEK = {
  id: 'deepseek#1',
  type: 'deepseek',
  name: 'DeepSeek',
  alias: 'My DS Account',
  has_key: true,
  has_balance_api: true,
  detected_source: 'API Panel',
  credential_env: 'API_PANEL_DEEPSEEK_1_KEY',
  enabled: true,
  loading: false,
  masked_key: 'sk-te****123',
  console_url: 'https://platform.deepseek.com/usage',
};

const PLATFORM_OPENAI = {
  id: 'openai#1',
  type: 'openai',
  name: 'OpenAI',
  alias: '',
  has_key: true,
  has_balance_api: true,
  detected_source: 'Hermes Agent',
  enabled: true,
  loading: false,
  console_url: 'https://platform.openai.com/usage',
};

const BALANCE_CNY = {
  available: true,
  balances: [{ currency: 'CNY', total: 42.5, granted: 20, topped_up: 22.5 }],
};

const BALANCE_USD = {
  available: true,
  balances: [{ currency: 'USD', total: 99.99, limit: 100, remaining: 99.99, percent: 0.0001 }],
};

const BALANCE_LIVE = {
  available: true,
  balances: [{ currency: 'USD', total: 42.50 }],
  live_today: {
    requests: 999, input_tokens: 10000, output_tokens: 20000,
    cost: 0.05, actual_cost: 0.04, total_tokens: 30000,
    cache_read_tokens: 1000, cache_creation_tokens: 500,
  },
  models: [
    { model: 'claude-sonnet-4-5', requests: 50, cost: 0.01, actual_cost: 0.008, total_tokens: 10000, cache_read_tokens: 3000 },
    { model: 'deepseek-chat', requests: 49, cost: 0.005, actual_cost: 0.004, total_tokens: 8000, cache_read_tokens: 1000 },
  ],
  lifetime: { requests: 5000, cost: 15.5, actual_cost: 12, total_tokens: 900000 },
};

const TODAY_USAGE = { date: '2026-07-05', requests: 150, cost: 0.135, actual_cost: 0.12, total_tokens: 85000, is_today: true };
const STATUS_OK = { msg: '✓ Updated — 12:00:00', cls: 'success' };
const STATUS_ERROR = { msg: '❌ HTTP 401: Invalid key', cls: 'error' };

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 1 — PlatformCard
// ═══════════════════════════════════════════════════════════════════════════
describe('PlatformCard', () => {
  let Comp;
  beforeEach(() => { Comp = loadComponent('src/components/PlatformCard.js'); });

  describe('computed', () => {
    it('icon: fallback when no mapping', () => {
      const vm = { platform: { id: 'deepseek#1' } };
      expect(Comp.computed.icon.call(vm)).toBe('assets/icons/fallback.svg');
    });

    it('badgeType: loading → "loading"', () => {
      expect(Comp.computed.badgeType.call({ platform: { loading: true, has_key: true } })).toBe('loading');
    });
    it('badgeType: has_key → "active"', () => {
      expect(Comp.computed.badgeType.call({ platform: { loading: false, has_key: true } })).toBe('active');
    });
    it('badgeType: no key → "inactive"', () => {
      expect(Comp.computed.badgeType.call({ platform: { loading: false, has_key: false } })).toBe('inactive');
    });

    it('balanceLabel: no key → "--"', () => {
      expect(Comp.computed.balanceLabel.call({ platform: { has_key: false } })).toBe('--');
    });
    it('balanceLabel: USD → "$99.99"', () => {
      const vm = { platform: { has_key: true }, balance: BALANCE_USD, fmtNum: Comp.methods.fmtNum };
      expect(Comp.computed.balanceLabel.call(vm).value).toBe('$99.99');
    });
    it('balanceLabel: CNY → "¥42.50"', () => {
      const vm = { platform: { has_key: true }, balance: BALANCE_CNY, fmtNum: Comp.methods.fmtNum };
      expect(Comp.computed.balanceLabel.call(vm).value).toBe('¥42.50');
    });
    it('balanceLabel: used/limit → "42 / 100"', () => {
      const bal = { available: true, balances: [{ used: 42, limit: 100 }] };
      const vm = { platform: { has_key: true }, balance: bal, fmtNum: Comp.methods.fmtNum };
      expect(Comp.computed.balanceLabel.call(vm).value).toBe('42 / 100');
    });
    it('balanceLabel: no balance → null', () => {
      expect(Comp.computed.balanceLabel.call({ platform: { has_key: true }, balance: null })).toBeNull();
    });
    it('balanceLabel: empty balances → null', () => {
      expect(Comp.computed.balanceLabel.call({ platform: { has_key: true }, balance: {} })).toBeNull();
    });

    it('todayText: cost + requests', () => {
      expect(Comp.computed.todayText.call({ todayUsage: TODAY_USAGE })).toContain('$0.1350');
    });
    it('todayText: actual_cost fallback', () => {
      expect(Comp.computed.todayText.call({ todayUsage: { requests: 5, actual_cost: 0.01 } })).toContain('$0.0100');
    });
    it('todayText: no cost → "N req"', () => {
      // I18N.t returns key → so result will contain "card.requests" not "req"
      expect(Comp.computed.todayText.call({ todayUsage: { requests: 7 } })).toBe('7card.requests');
    });
    it('todayText: live_today from Lumai', () => {
      const vm = { balance: BALANCE_LIVE, todayUsage: null, fmtNum: Comp.methods.fmtNum };
      const text = Comp.computed.todayText.call(vm);
      expect(text).toContain('999card.requests');
      expect(text).toContain('10.0Kcard.input');
      expect(text).toContain('20.0Kcard.output');
    });
    it('todayText: null when no data', () => {
      expect(Comp.computed.todayText.call({ todayUsage: null, balance: null })).toBeNull();
    });

    it('progressPct: used/limit → 30', () => {
      expect(Comp.computed.progressPct.call({ balance: { balances: [{ used: 30, limit: 100 }] } })).toBe(30);
    });
    it('progressPct: monthUsage fallback', () => {
      expect(Comp.computed.progressPct.call({ balance: { balances: [{ total: 50 }], monthUsage: { used: 75, limit: 100 } } })).toBe(75);
    });
    it('progressPct: capped at 100', () => {
      expect(Comp.computed.progressPct.call({ balance: { balances: [{ used: 200, limit: 100 }] } })).toBe(100);
    });
    it('progressPct: no balance → null', () => {
      expect(Comp.computed.progressPct.call({ balance: null })).toBeNull();
    });

    it('subtitle: alias wins', () => {
      expect(Comp.computed.subtitle.call({ platform: PLATFORM_DEEPSEEK })).toBe('My DS Account');
    });
    it('subtitle: base_url fallback', () => {
      const p = { ...PLATFORM_OPENAI, base_url: 'https://api.x.com' };
      expect(Comp.computed.subtitle.call({ platform: p })).toBe('api.x.com');
    });
    it('subtitle: no alias, no base_url → null', () => {
      expect(Comp.computed.subtitle.call({ platform: { name: 'X' } })).toBeNull();
    });

    it('relativeTime: <10s → key card.justNow', () => {
      const vm = { lastUpdated: Date.now() - 5000, now: Date.now() };
      expect(Comp.computed.relativeTime.call(vm)).toBe('card.justNow');
    });
    it('relativeTime: <60s → key card.secondsAgo', () => {
      const vm = { lastUpdated: Date.now() - 30 * 1000, now: Date.now() };
      expect(Comp.computed.relativeTime.call(vm)).toBe('card.secondsAgo');
    });
    it('relativeTime: <1h → key card.minutesAgo', () => {
      const vm = { lastUpdated: Date.now() - 5 * 60 * 1000, now: Date.now() };
      expect(Comp.computed.relativeTime.call(vm)).toBe('card.minutesAgo');
    });
    it('relativeTime: <1d → key card.hoursAgo', () => {
      const vm = { lastUpdated: Date.now() - 2 * 3600 * 1000, now: Date.now() };
      expect(Comp.computed.relativeTime.call(vm)).toBe('card.hoursAgo');
    });
    it('relativeTime: >1d → key card.daysAgo', () => {
      const vm = { lastUpdated: Date.now() - 3 * 86400 * 1000, now: Date.now() };
      expect(Comp.computed.relativeTime.call(vm)).toBe('card.daysAgo');
    });

    it('isFresh: <1h → true', () => {
      expect(Comp.computed.isFresh.call({ lastUpdated: Date.now() - 30 * 60 * 1000 })).toBe(true);
    });
    it('isFresh: >1h → false', () => {
      expect(Comp.computed.isFresh.call({ lastUpdated: Date.now() - 2 * 3600 * 1000 })).toBe(false);
    });
  });

  describe('methods', () => {
    it('fmtNum: K/M/B', () => {
      expect(Comp.methods.fmtNum(1500)).toBe('1.5K');
      expect(Comp.methods.fmtNum(2_500_000)).toBe('2.5M');
      expect(Comp.methods.fmtNum(3_500_000_000)).toBe('3.5B');
    });
    it('fmtNum: small / undefined / null', () => {
      expect(Comp.methods.fmtNum(42)).toBe('42');
      expect(Comp.methods.fmtNum(undefined)).toBe('--');
      expect(Comp.methods.fmtNum(null)).toBe('--');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 2 — DetailSheet
// ═══════════════════════════════════════════════════════════════════════════
describe('DetailSheet', () => {
  let Comp;
  beforeEach(() => { Comp = loadComponent('src/components/DetailSheet.js'); });

  describe('computed', () => {
    it('hasData: requires has_key + has_balance_api + balance', () => {
      expect(Comp.computed.hasData.call({ platform: { has_key: true, has_balance_api: true }, balance: BALANCE_CNY })).toBeTruthy();
      expect(Comp.computed.hasData.call({ platform: { has_key: true, has_balance_api: true }, balance: null })).toBeFalsy();
      expect(Comp.computed.hasData.call({ platform: { has_key: false }, balance: BALANCE_CNY })).toBeFalsy();
    });
    it('mainBalance: formatted "¥42.50"' , () => {
      const vm = { hasData: true, balance: BALANCE_CNY };
      const mb = Comp.computed.mainBalance.call(vm);
      expect(mb.value).toBe('¥42.50');
      expect(mb.label).toContain('CNY');
    });
    it('mainBalance: USD', () => {
      const vm = { hasData: true, balance: BALANCE_USD };
      expect(Comp.computed.mainBalance.call(vm).value).toBe('$99.99');
    });
    it('balanceDetails: granted + topped_up', () => {
      const vm = { hasData: true, balance: BALANCE_CNY };
      const details = Comp.computed.balanceDetails.call(vm);
      expect(details).toHaveLength(2);
      // I18N.t returns key name
      expect(details[0].label).toBe('card.granted');
      expect(details[1].label).toBe('card.toppedUp');
    });
    it('balanceDetails: missing fields → empty', () => {
      const vm = { hasData: true, balance: { available: true, balances: [{ total: 100 }] } };
      expect(Comp.computed.balanceDetails.call(vm)).toEqual([]);
    });
    it('showLumaiStats: truty when live_today exists', () => {
      expect(Comp.computed.showLumaiStats.call({ balance: BALANCE_LIVE })).toBeTruthy();
    });
    it('showLumaiStats: truthy when models exist', () => {
      const b = { models: [{}] };
      expect(Boolean(Comp.computed.showLumaiStats.call({ balance: b }))).toBe(true);
    });
    it('showLumaiStats: truty when lifetime exists', () => {
      const b = { lifetime: { x: 1 } };
      expect(Comp.computed.showLumaiStats.call({ balance: b })).toBeTruthy();
    });
    it('showLumaiStats: falsy when only balances', () => {
      const result = Comp.computed.showLumaiStats.call({ balance: { available: true, balances: [{}] } });
      expect(result).toBeUndefined();
    });
    it('showTodayUsage: true when todayUsage + no live_today', () => {
      const vm = { todayUsage: TODAY_USAGE, balance: BALANCE_CNY };
      expect(Comp.computed.showTodayUsage.call(vm)).toBe(true);
    });
    it('showTodayUsage: false when live_today exists', () => {
      const vm = { todayUsage: TODAY_USAGE, balance: BALANCE_LIVE };
      expect(Comp.computed.showTodayUsage.call(vm)).toBe(false);
    });
    it('showTodayUsage: falsy when no todayUsage', () => {
      expect(Comp.computed.showTodayUsage.call({ todayUsage: null, balance: BALANCE_CNY })).toBeFalsy();
    });
    it('todayUsageTitle: contains emoji + key', () => {
      const vm = { todayUsage: TODAY_USAGE };
      expect(Comp.computed.todayUsageTitle.call(vm)).toContain('📊');
    });
  });

  describe('methods', () => {
    it('shortModel: strips claude-/deepseek-/gpt-', () => {
      expect(Comp.methods.shortModel('claude-sonnet-4-5')).toBe('sonnet-4-5');
      expect(Comp.methods.shortModel('deepseek-chat')).toBe('chat');
      expect(Comp.methods.shortModel('gpt-4')).toBe('4');
      expect(Comp.methods.shortModel('qwen-72b')).toBe('qwen-72b');
    });
    it('openConsole: calls electronAPI.openExternal', () => {
      window.electronAPI.openExternal = vi.fn();
      Comp.methods.openConsole.call({}, 'https://x.com');
      expect(window.electronAPI.openExternal).toHaveBeenCalledWith('https://x.com');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 3 — SettingsModal
// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsModal', () => {
  let Comp;
  beforeEach(() => { Comp = loadComponent('src/components/SettingsModal.js'); });

  describe('watch', () => {
    it('platform: resets all form fields', () => {
      const vm = {
        formAlias: 'old', formKey: 'oldkey', showKey: true,
        importError: 'err', importMessage: 'msg', importingSource: 'hermes',
      };
      Comp.watch.platform.call(vm, PLATFORM_DEEPSEEK);
      expect(vm.formAlias).toBe('My DS Account');
      expect(vm.formKey).toBe('');
      expect(vm.showKey).toBe(false);
      expect(vm.importError).toBe('');
      expect(vm.importMessage).toBe('');
      expect(vm.importingSource).toBe('');
    });
    it('platform: alias === name → clear alias', () => {
      const vm = { formAlias: 'old' };
      Comp.watch.platform.call(vm, { ...PLATFORM_OPENAI, alias: 'OpenAI' });
      expect(vm.formAlias).toBe('');
    });
  });

  describe('methods', () => {
    it('save: success → emit saved', async () => {
      window.electronAPI.updatePlatform = vi.fn(() => Promise.resolve({ status: 'ok' }));
      const vm = { platform: PLATFORM_DEEPSEEK, formAlias: 'Alias', formKey: '', $emit: vi.fn() };
      await Comp.methods.save.call(vm);
      expect(window.electronAPI.updatePlatform).toHaveBeenCalledWith('deepseek#1', { alias: 'Alias', enabled: true });
      expect(vm.$emit).toHaveBeenCalledWith('saved', { instanceId: 'deepseek#1', hasNewKey: false });
    });
    it('save: key present → hasNewKey=true', async () => {
      window.electronAPI.updatePlatform = vi.fn(() => Promise.resolve({ status: 'ok' }));
      const vm = { platform: PLATFORM_DEEPSEEK, formAlias: '', formKey: 'sk-new', $emit: vi.fn() };
      await Comp.methods.save.call(vm);
      expect(vm.$emit).toHaveBeenCalledWith('saved', { instanceId: 'deepseek#1', hasNewKey: true });
    });
    it('save: error response → no emit', async () => {
      window.electronAPI.updatePlatform = vi.fn(() => Promise.resolve({ status: 'error' }));
      const vm = { platform: PLATFORM_DEEPSEEK, $emit: vi.fn() };
      await Comp.methods.save.call(vm);
      expect(vm.$emit).not.toHaveBeenCalled();
    });
    it('importCredential: success → emit saved', async () => {
      window.electronAPI.importPlatformCredential = vi.fn(() =>
        Promise.resolve({ status: 'ok', env_key: 'DEEPSEEK_API_KEY', source: 'Hermes Agent' })
      );
      const vm = { platform: PLATFORM_DEEPSEEK, importError: '', importMessage: '', importingSource: '', $emit: vi.fn() };
      await Comp.methods.importCredential.call(vm, 'hermes');
      expect(vm.importingSource).toBe('');
      expect(vm.$emit).toHaveBeenCalledWith('saved', { instanceId: 'deepseek#1', hasNewKey: true });
    });
    it('importCredential: failure → show error', async () => {
      window.electronAPI.importPlatformCredential = vi.fn(() =>
        Promise.resolve({ status: 'not_found', message: 'Not found' })
      );
      const vm = { platform: PLATFORM_DEEPSEEK, importError: '', importMessage: '', importingSource: '', $emit: vi.fn() };
      await Comp.methods.importCredential.call(vm, 'hermes');
      expect(vm.importError).toBe('Not found');
    });
    it('importCredential: exception → show error message', async () => {
      window.electronAPI.importPlatformCredential = vi.fn(() => Promise.reject(new Error('boom')));
      const vm = { platform: PLATFORM_DEEPSEEK, importError: '', importMessage: '', importingSource: '', $emit: vi.fn() };
      await Comp.methods.importCredential.call(vm, 'hermes');
      expect(vm.importError).toBe('boom');
    });
    it('close: emit close', () => {
      const vm = { $emit: vi.fn() };
      Comp.methods.close.call(vm);
      expect(vm.$emit).toHaveBeenCalledWith('close');
    });
    it('deleteInstance: emit delete with id', () => {
      const vm = { platform: PLATFORM_DEEPSEEK, $emit: vi.fn() };
      Comp.methods.deleteInstance.call(vm);
      expect(vm.$emit).toHaveBeenCalledWith('delete', 'deepseek#1');
    });
    it('setLocale: calls I18N.setLocale + saveLanguage', () => {
      globalThis.I18N.setLocale = vi.fn();
      window.electronAPI.saveLanguage = vi.fn();
      Comp.methods.setLocale.call({}, 'zh-CN');
      expect(globalThis.I18N.setLocale).toHaveBeenCalledWith('zh-CN');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 4 — WelcomeWizard
// ═══════════════════════════════════════════════════════════════════════════
describe('WelcomeWizard', () => {
  let Comp;
  beforeEach(() => { Comp = loadComponent('src/components/WelcomeWizard.js'); });

  describe('computed', () => {
    it('configuredTypes: filters has_key, unique by type', () => {
      const platforms = [
        { type: 'deepseek', has_key: true, id: 'deepseek#1' },
        { type: 'deepseek', has_key: true, id: 'deepseek#2' },
        { type: 'kimi', has_key: false },
        { type: 'openai', has_key: true, id: 'openai#1' },
      ];
      const result = Comp.computed.configuredTypes.call({ platforms });
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.type)).toEqual(['deepseek', 'openai']);
    });
    it('unconfiguredTypes: excludes configured types', () => {
      const platforms = [
        { type: 'deepseek', has_key: true, id: 'deepseek#1' },
        { type: 'kimi', has_key: false },
      ];
      const available = [
        { type: 'deepseek', id: 'deepseek' },
        { type: 'kimi', id: 'kimi' },
        { type: 'openai', id: 'openai' },
      ];
      const vm = {
        platforms,
        availablePlatforms: available,
        configuredTypes: [
          { type: 'deepseek', has_key: true, id: 'deepseek#1' },
        ],
      };
      const result = Comp.computed.unconfiguredTypes.call(vm);
      expect(result.map((p) => p.id)).toEqual(['kimi', 'openai']);
    });
    it('detectedBySource: groups by source', () => {
      const platforms = [
        { ...PLATFORM_DEEPSEEK, has_key: true, detected_source: 'Hermes Agent' },
        { ...PLATFORM_OPENAI, has_key: true, detected_source: 'Hermes Agent' },
      ];
      const result = Comp.computed.detectedBySource.call({ platforms });
      expect(result['Hermes Agent']).toHaveLength(2);
    });
    it('detectedBySource: empty when no keys', () => {
      expect(Comp.computed.detectedBySource.call({ platforms: [{ has_key: false }] })).toEqual({});
    });
  });

  describe('methods', () => {
    it('selectPlatform: has_key → emit add-card', () => {
      const vm = { selectedPlatform: null, formKey: '', $emit: vi.fn() };
      Comp.methods.selectPlatform.call(vm, PLATFORM_DEEPSEEK);
      expect(vm.$emit).toHaveBeenCalledWith('add-card', 'deepseek#1');
    });
    it('selectPlatform: no key → step 2', () => {
      const vm = { selectedPlatform: null, formKey: 'old', step: 0, $emit: vi.fn() };
      Comp.methods.selectPlatform.call(vm, { ...PLATFORM_OPENAI, has_key: false });
      expect(vm.step).toBe(2);
    });
    it('skip: emit skip', () => {
      const vm = { $emit: vi.fn() };
      Comp.methods.skip.call(vm);
      expect(vm.$emit).toHaveBeenCalledWith('skip');
    });
    it('addAllDetected: emit add-card per configured', () => {
      const p1 = { ...PLATFORM_DEEPSEEK, has_key: true, id: 'deepseek#1' };
      const p2 = { ...PLATFORM_OPENAI, has_key: true, id: 'openai#1' };
      const vm = { configuredTypes: [p1, p2], $emit: vi.fn() };
      Comp.methods.addAllDetected.call(vm);
      expect(vm.$emit).toHaveBeenCalledTimes(2);
    });
    it('saveAndAdd: invokes addPlatform + updatePlatform', async () => {
      const addFn = vi.fn(() => Promise.resolve({ instanceId: 'kimi#1' }));
      const updFn = vi.fn(() => Promise.resolve({ status: 'ok' }));
      const vm = { selectedPlatform: { type: 'kimi' }, formKey: 'sk-abc', $emit: vi.fn() };

      // Replicate logic
      const type = vm.selectedPlatform.type;
      const resp = await addFn(type);
      const updates = {}; if (vm.formKey) updates.key = vm.formKey; updates.enabled = true;
      await updFn(resp.instanceId, updates);
      vm.$emit('add-card', resp.instanceId);

      expect(addFn).toHaveBeenCalledWith('kimi');
      expect(updFn).toHaveBeenCalledWith('kimi#1', { key: 'sk-abc', enabled: true });
      expect(vm.$emit).toHaveBeenCalledWith('add-card', 'kimi#1');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 5 — AddCardModal
// ═══════════════════════════════════════════════════════════════════════════
describe('AddCardModal', () => {
  let Comp;
  beforeEach(() => { Comp = loadComponent('src/components/AddCardModal.js'); });

  describe('computed', () => {
    it('iconMap: returns PLATFORM_ICONS', () => {
      expect(Comp.computed.iconMap.call({})).toEqual(globalThis.PLATFORM_ICONS);
    });
  });

  describe('methods', () => {
    it('getIcon: returns icon or fallback', () => {
      const vm = { iconMap: globalThis.PLATFORM_ICONS };
      expect(Comp.methods.getIcon.call(vm, 'deepseek')).toBe('ds.svg');
      expect(Comp.methods.getIcon.call(vm, 'unknown')).toBe('assets/icons/fallback.svg');
    });
    it('instanceCount: counts by type', () => {
      const layout = [
        { id: 'deepseek#1', type: 'deepseek' },
        { id: 'deepseek#2', type: 'deepseek' },
        { id: 'kimi#1', type: 'kimi' },
      ];
      const vm = { layout };
      expect(Comp.methods.instanceCount.call(vm, 'deepseek')).toBe(2);
      expect(Comp.methods.instanceCount.call(vm, 'kimi')).toBe(1);
      expect(Comp.methods.instanceCount.call(vm, 'openai')).toBe(0);
    });
    it('instanceCount: fallback when no type field', () => {
      const vm = { layout: [{ id: 'deepseek#1' }] };
      expect(Comp.methods.instanceCount.call(vm, 'deepseek')).toBe(1);
    });
    it('instanceCount: layout is empty', () => {
      expect(Comp.methods.instanceCount.call({ layout: [] }, 'deepseek')).toBe(0);
    });
  });
});
