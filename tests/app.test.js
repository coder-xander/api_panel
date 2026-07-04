/**
 * app.test.js — Tests for src/App.js
 *
 * Strategy: load App.js source, strip template, eval to extract the component
 * definition. Test computed properties and methods directly via .call(vm).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function loadApp() {
  const fullPath = path.join(ROOT, 'src/App.js');
  let src = fs.readFileSync(fullPath, 'utf-8');

  // Strip the template to avoid template-literal eval issues
  src = src.replace(/template:\s*`[\s\S]*?`,?\s*\n\s*\}\.mount/, '/* template stripped */\n}.mount');

  // Provide globals
  globalThis.window = globalThis.window || { dispatchEvent: vi.fn(), addEventListener: vi.fn() };
  globalThis.document = globalThis.document || {};
  globalThis.I18N = {
    t: (k, p) => p ? k + JSON.stringify(p) : k,
    setLocale: vi.fn(),
    getLocale: () => 'en',
  };
  globalThis.getPlatformIcon = () => 'assets/icons/fallback.svg';
  globalThis.PLATFORM_ICONS = {
    deepseek: 'assets/icons/deepseek.svg',
    kimi: 'assets/icons/kimi.svg',
    lumai: 'assets/icons/lumai.svg',
    openrouter: 'assets/icons/openrouter.svg',
    openai: 'assets/icons/openai.svg',
  };
  globalThis.PlatformCard = {};
  globalThis.DetailSheet = {};
  globalThis.SettingsModal = {};
  globalThis.AddCardModal = {};
  globalThis.WelcomeWizard = {};
  globalThis.Vue = { createApp: (def) => def };

  const fn = new Function(
    'window', 'document', 'Vue', 'I18N', 'getPlatformIcon', 'PLATFORM_ICONS',
    'PlatformCard', 'DetailSheet', 'SettingsModal', 'AddCardModal', 'WelcomeWizard',
    `${src};
    return typeof appDef !== 'undefined' ? appDef : null;`
  );

  // We need to capture the createApp argument. Patch Vue.createApp.
  let capturedDef = null;
  globalThis.Vue = { createApp: (def) => { capturedDef = def; return { mount: () => {} }; } };

  fn(globalThis.window, globalThis.document, globalThis.Vue, globalThis.I18N,
     globalThis.getPlatformIcon, globalThis.PLATFORM_ICONS,
     globalThis.PlatformCard, globalThis.DetailSheet, globalThis.SettingsModal,
     globalThis.AddCardModal, globalThis.WelcomeWizard);

  return capturedDef;
}

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════
const PLATFORM_DEEPSEEK = {
  id: 'deepseek#1', type: 'deepseek', name: 'DeepSeek', alias: 'My DS',
  has_key: true, has_balance_api: true, enabled: true, loading: false,
};

const PLATFORM_KIMI = {
  id: 'kimi#1', type: 'kimi', name: 'Kimi CN', alias: '',
  has_key: true, has_balance_api: true, enabled: true, loading: false,
};

const PLATFORM_OPENAI = {
  id: 'openai#1', type: 'openai', name: 'OpenAI', alias: '',
  has_key: true, has_balance_api: true, enabled: true, loading: false,
};

const PLATFORM_NO_KEY = {
  id: 'anthropic#1', type: 'anthropic', name: 'Claude', alias: '',
  has_key: false, has_balance_api: false, enabled: false, loading: false,
};

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 1 — data() defaults
// ═══════════════════════════════════════════════════════════════════════════
describe('App data defaults', () => {
  let App;
  beforeEach(() => { App = loadApp(); });

  it('has empty platforms array', () => {
    expect(App.data().platforms).toEqual([]);
  });

  it('has empty layout array', () => {
    expect(App.data().layout).toEqual([]);
  });

  it('has empty balances object', () => {
    expect(App.data().balances).toEqual({});
  });

  it('refreshingAll defaults to false', () => {
    expect(App.data().refreshingAll).toBe(false);
  });

  it('showWizard defaults to false', () => {
    expect(App.data().showWizard).toBe(false);
  });

  it('showModal defaults to false', () => {
    expect(App.data().showModal).toBe(false);
  });

  it('showAddModal defaults to false', () => {
    expect(App.data().showAddModal).toBe(false);
  });

  it('appVersion defaults to "0.0.0"', () => {
    expect(App.data().appVersion).toBe('0.0.0');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 2 — computed: layoutPlatforms
// ═══════════════════════════════════════════════════════════════════════════
describe('App computed: layoutPlatforms', () => {
  let App;
  beforeEach(() => { App = loadApp(); });

  it('maps layout items to platform objects', () => {
    const vm = {
      layout: [{ id: 'deepseek#1' }, { id: 'kimi#1' }],
      platforms: [PLATFORM_DEEPSEEK, PLATFORM_KIMI],
    };
    const result = App.computed.layoutPlatforms.call(vm);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('deepseek#1');
    expect(result[1].id).toBe('kimi#1');
  });

  it('filters out layout items with no matching platform', () => {
    const vm = {
      layout: [{ id: 'deepseek#1' }, { id: 'nonexistent#99' }],
      platforms: [PLATFORM_DEEPSEEK],
    };
    const result = App.computed.layoutPlatforms.call(vm);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('deepseek#1');
  });

  it('returns empty array when layout is empty', () => {
    const vm = { layout: [], platforms: [PLATFORM_DEEPSEEK] };
    expect(App.computed.layoutPlatforms.call(vm)).toEqual([]);
  });

  it('preserves layout order', () => {
    const vm = {
      layout: [{ id: 'kimi#1' }, { id: 'deepseek#1' }],
      platforms: [PLATFORM_DEEPSEEK, PLATFORM_KIMI],
    };
    const result = App.computed.layoutPlatforms.call(vm);
    expect(result[0].id).toBe('kimi#1');
    expect(result[1].id).toBe('deepseek#1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 3 — computed: availablePlatforms
// ═══════════════════════════════════════════════════════════════════════════
describe('App computed: availablePlatforms', () => {
  let App;
  beforeEach(() => { App = loadApp(); });

  it('deduplicates platforms by type', () => {
    const ds2 = { ...PLATFORM_DEEPSEEK, id: 'deepseek#2' };
    const vm = {
      platforms: [PLATFORM_DEEPSEEK, ds2],
      platformDefs: {},
    };
    const result = App.computed.availablePlatforms.call(vm);
    const deepseekEntries = result.filter(p => p.type === 'deepseek');
    expect(deepseekEntries).toHaveLength(1);
  });

  it('includes unconfigured platform types from PLATFORM_ICONS', () => {
    const vm = {
      platforms: [PLATFORM_DEEPSEEK],
      platformDefs: {},
    };
    const result = App.computed.availablePlatforms.call(vm);
    const types = result.map(p => p.type);
    expect(types).toContain('kimi');
    expect(types).toContain('openai');
  });

  it('unconfigured platforms have has_key=false', () => {
    const vm = {
      platforms: [PLATFORM_DEEPSEEK],
      platformDefs: {},
    };
    const result = App.computed.availablePlatforms.call(vm);
    const kimi = result.find(p => p.type === 'kimi');
    expect(kimi.has_key).toBe(false);
  });

  it('uses platformDefs when available', () => {
    const vm = {
      platforms: [PLATFORM_DEEPSEEK],
      platformDefs: {
        siliconflow: { name: 'SiliconFlow', defaultW: 1, defaultH: 1 },
      },
    };
    const result = App.computed.availablePlatforms.call(vm);
    const sf = result.find(p => p.type === 'siliconflow');
    expect(sf).toBeDefined();
    expect(sf.name).toBe('SiliconFlow');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 4 — computed: detailPlatform
// ═══════════════════════════════════════════════════════════════════════════
describe('App computed: detailPlatform', () => {
  let App;
  beforeEach(() => { App = loadApp(); });

  it('returns matching platform by detailPlatformId', () => {
    const vm = {
      detailPlatformId: 'deepseek#1',
      platforms: [PLATFORM_DEEPSEEK, PLATFORM_KIMI],
    };
    const result = App.computed.detailPlatform.call(vm);
    expect(result.id).toBe('deepseek#1');
  });

  it('returns null when detailPlatformId is null', () => {
    const vm = {
      detailPlatformId: null,
      platforms: [PLATFORM_DEEPSEEK],
    };
    expect(App.computed.detailPlatform.call(vm)).toBeNull();
  });

  it('returns undefined when no match found', () => {
    const vm = {
      detailPlatformId: 'nonexistent#99',
      platforms: [PLATFORM_DEEPSEEK],
    };
    expect(App.computed.detailPlatform.call(vm)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 5 — computed: confirmDeleteMsg
// ═══════════════════════════════════════════════════════════════════════════
describe('App computed: confirmDeleteMsg', () => {
  let App;
  beforeEach(() => { App = loadApp(); });

  it('zh-CN message includes platform name', () => {
    globalThis.I18N.getLocale = () => 'zh-CN';
    const vm = { confirmDeleteTarget: { name: 'My DeepSeek' } };
    const result = App.computed.confirmDeleteMsg.call(vm);
    expect(result).toContain('My DeepSeek');
    expect(result).toContain('确认');
  });

  it('en message includes platform name', () => {
    globalThis.I18N.getLocale = () => 'en';
    const vm = { confirmDeleteTarget: { name: 'My DeepSeek' } };
    const result = App.computed.confirmDeleteMsg.call(vm);
    expect(result).toContain('My DeepSeek');
    expect(result).toContain('Remove');
  });

  it('handles missing target name', () => {
    globalThis.I18N.getLocale = () => 'en';
    const vm = { confirmDeleteTarget: null };
    const result = App.computed.confirmDeleteMsg.call(vm);
    expect(result).toContain('Remove');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 6 — methods: setStatus
// ═══════════════════════════════════════════════════════════════════════════
describe('App methods: setStatus', () => {
  let App;
  beforeEach(() => { App = loadApp(); });

  it('sets status with msg and cls', () => {
    const vm = { statuses: {} };
    App.methods.setStatus.call(vm, 'deepseek#1', 'Updated', 'success');
    expect(vm.statuses['deepseek#1']).toEqual({ msg: 'Updated', cls: 'success' });
  });

  it('success status auto-clears after timeout', () => {
    vi.useFakeTimers();
    const vm = { statuses: {} };
    App.methods.setStatus.call(vm, 'deepseek#1', 'Updated', 'success');
    expect(vm.statuses['deepseek#1'].cls).toBe('success');
    vi.advanceTimersByTime(5001);
    expect(vm.statuses['deepseek#1']).toBeNull();
    vi.useRealTimers();
  });

  it('error status does NOT auto-clear', () => {
    vi.useFakeTimers();
    const vm = { statuses: {} };
    App.methods.setStatus.call(vm, 'deepseek#1', 'Failed', 'error');
    vi.advanceTimersByTime(10000);
    expect(vm.statuses['deepseek#1'].cls).toBe('error');
    vi.useRealTimers();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 7 — methods: onDrop (drag & drop layout reordering)
// ═══════════════════════════════════════════════════════════════════════════
describe('App methods: onDrop', () => {
  let App;
  beforeEach(() => { App = loadApp(); });

  it('reorders layout items', () => {
    const vm = {
      layout: [
        { id: 'a#1', type: 'a' },
        { id: 'b#1', type: 'b' },
        { id: 'c#1', type: 'c' },
      ],
      persistLayout: vi.fn(),
    };
    App.methods.onDrop.call(vm, 'c#1', 'a#1');
    expect(vm.layout.map(i => i.id)).toEqual(['c#1', 'a#1', 'b#1']);
  });

  it('no-op when fromId equals toId', () => {
    const vm = {
      layout: [{ id: 'a#1' }],
      persistLayout: vi.fn(),
    };
    App.methods.onDrop.call(vm, 'a#1', 'a#1');
    expect(vm.persistLayout).not.toHaveBeenCalled();
  });

  it('no-op when fromId not found', () => {
    const vm = {
      layout: [{ id: 'a#1' }],
      persistLayout: vi.fn(),
    };
    App.methods.onDrop.call(vm, 'nonexistent#1', 'a#1');
    expect(vm.persistLayout).not.toHaveBeenCalled();
  });

  it('clears dragging state after drop', () => {
    const vm = {
      layout: [{ id: 'a#1' }, { id: 'b#1' }],
      draggingId: 'a#1',
      dragOverId: 'b#1',
      persistLayout: vi.fn(),
    };
    App.methods.onDrop.call(vm, 'a#1', 'b#1');
    expect(vm.draggingId).toBeNull();
    expect(vm.dragOverId).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 8 — methods: openDetail / closeDetail
// ═══════════════════════════════════════════════════════════════════════════
describe('App methods: openDetail / closeDetail', () => {
  let App;
  beforeEach(() => { App = loadApp(); });

  it('openDetail sets detailPlatformId', () => {
    const vm = { detailPlatformId: null, draggingId: null };
    App.methods.openDetail.call(vm, 'deepseek#1');
    expect(vm.detailPlatformId).toBe('deepseek#1');
  });

  it('openDetail does nothing while dragging', () => {
    const vm = { detailPlatformId: null, draggingId: 'someId' };
    App.methods.openDetail.call(vm, 'deepseek#1');
    expect(vm.detailPlatformId).toBeNull();
  });

  it('closeDetail resets detailPlatformId', () => {
    const vm = { detailPlatformId: 'deepseek#1' };
    App.methods.closeDetail.call(vm);
    expect(vm.detailPlatformId).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 9 — methods: persistLayout
// ═══════════════════════════════════════════════════════════════════════════
describe('App methods: persistLayout', () => {
  let App;
  beforeEach(() => { App = loadApp(); });

  it('calls saveLayout with normalized items', () => {
    const saveLayoutMock = vi.fn();
    globalThis.window.electronAPI.saveLayout = saveLayoutMock;
    const vm = {
      layout: [{ id: 'deepseek#1', type: 'deepseek', x: 0, y: 0, w: 1, h: 1 }],
      platforms: [PLATFORM_DEEPSEEK],
    };
    App.methods.persistLayout.call(vm);
    expect(saveLayoutMock).toHaveBeenCalledWith([
      { id: 'deepseek#1', type: 'deepseek', x: 0, y: 0, w: 1, h: 1 },
    ]);
  });

  it('derives type from platforms when item.type missing', () => {
    const saveLayoutMock = vi.fn();
    globalThis.window.electronAPI.saveLayout = saveLayoutMock;
    const vm = {
      layout: [{ id: 'deepseek#1' }],
      platforms: [PLATFORM_DEEPSEEK],
    };
    App.methods.persistLayout.call(vm);
    expect(saveLayoutMock).toHaveBeenCalledWith([
      { id: 'deepseek#1', type: 'deepseek', x: 0, y: 0, w: 1, h: 1 },
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 10 — methods: removeCard / confirmDelete / cancelDelete
// ═══════════════════════════════════════════════════════════════════════════
describe('App methods: removeCard / confirmDelete / cancelDelete', () => {
  let App;
  beforeEach(() => { App = loadApp(); });

  it('removeCard sets confirm target and shows dialog', () => {
    const vm = { confirmDeleteTarget: null, showConfirmDelete: false, platforms: [PLATFORM_DEEPSEEK] };
    App.methods.removeCard.call(vm, 'deepseek#1');
    expect(vm.showConfirmDelete).toBe(true);
    expect(vm.confirmDeleteTarget.id).toBe('deepseek#1');
    expect(vm.confirmDeleteTarget.name).toBe('My DS');
  });

  it('confirmDelete removes platform and hides dialog', async () => {
    globalThis.window.electronAPI.removePlatformInstance = vi.fn(() => Promise.resolve());
    globalThis.window.electronAPI.getPlatforms = vi.fn(() => Promise.resolve([]));
    const vm = {
      confirmDeleteTarget: { id: 'deepseek#1', name: 'DeepSeek' },
      showConfirmDelete: true,
      layout: [{ id: 'deepseek#1', type: 'deepseek' }],
    };
    await App.methods.confirmDelete.call(vm);
    expect(vm.showConfirmDelete).toBe(false);
    expect(vm.confirmDeleteTarget).toBeNull();
  });

  it('cancelDelete hides dialog without removing', () => {
    const vm = {
      confirmDeleteTarget: { id: 'deepseek#1', name: 'DeepSeek' },
      showConfirmDelete: true,
    };
    App.methods.cancelDelete.call(vm);
    expect(vm.showConfirmDelete).toBe(false);
    expect(vm.confirmDeleteTarget).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 11 — methods: window controls
// ═══════════════════════════════════════════════════════════════════════════
describe('App methods: window controls', () => {
  let App;
  beforeEach(() => { App = loadApp(); });

  it('minimizeWindow calls electronAPI.windowMinimize', () => {
    const mock = vi.fn();
    globalThis.window.electronAPI.windowMinimize = mock;
    App.methods.minimizeWindow.call({});
    expect(mock).toHaveBeenCalled();
  });

  it('toggleMaximize calls electronAPI.windowMaximize', () => {
    const mock = vi.fn();
    globalThis.window.electronAPI.windowMaximize = mock;
    App.methods.toggleMaximize.call({});
    expect(mock).toHaveBeenCalled();
  });

  it('closeWindow calls electronAPI.windowClose', () => {
    const mock = vi.fn();
    globalThis.window.electronAPI.windowClose = mock;
    App.methods.closeWindow.call({});
    expect(mock).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 12 — methods: onDragStart / onDragOver / onDragEnd
// ═══════════════════════════════════════════════════════════════════════════
describe('App methods: drag state management', () => {
  let App;
  beforeEach(() => { App = loadApp(); });

  it('onDragStart sets draggingId', () => {
    const vm = { draggingId: null };
    App.methods.onDragStart.call(vm, 'deepseek#1');
    expect(vm.draggingId).toBe('deepseek#1');
  });

  it('onDragOver sets dragOverId if different from dragging', () => {
    const vm = { draggingId: 'deepseek#1', dragOverId: null };
    App.methods.onDragOver.call(vm, 'kimi#1');
    expect(vm.dragOverId).toBe('kimi#1');
  });

  it('onDragOver does not set dragOverId for self', () => {
    const vm = { draggingId: 'deepseek#1', dragOverId: null };
    App.methods.onDragOver.call(vm, 'deepseek#1');
    expect(vm.dragOverId).toBeNull();
  });

  it('onDragEnd clears both draggingId and dragOverId', () => {
    const vm = { draggingId: 'deepseek#1', dragOverId: 'kimi#1' };
    App.methods.onDragEnd.call(vm);
    expect(vm.draggingId).toBeNull();
    expect(vm.dragOverId).toBeNull();
  });
});
