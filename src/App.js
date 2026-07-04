// ⚡ API Panel — Vue 3 main app (mobile desktop style + drag & drop)
// Supports multiple instances per platform (different API Keys)

const { createApp } = Vue;

createApp({
  components: { PlatformCard, DetailSheet, SettingsModal, AddCardModal, WelcomeWizard },

  data() {
    return {
      platforms: [],
      layout: [],
      balances: {},
      statuses: {},
      todayUsages: {},
      lastUpdated: {},
      now: Date.now(),
      refreshingAll: false,
      showAddModal: false,
      showModal: false,
      editingPlatform: null,
      autoRefreshTimer: null,
      nowTickTimer: null,
      windowMaximized: false,
      appVersion: '0.0.0',
      platformDefs: {},
      showWizard: false,
      detailPlatformId: null,
      draggingId: null,
      dragOverId: null,
      showConfirmDelete: false,
      confirmDeleteTarget: null,
      pendingAddInstanceId: null,
      i18nKey: 0,
    };
  },

  computed: {
    layoutPlatforms() {
      return this.layout
        .map(item => this.platforms.find(p => p.id === item.id))
        .filter(Boolean);
    },

    availablePlatforms() {
      const seen = new Set();
      const result = [];
      for (const p of this.platforms) {
        if (!seen.has(p.type)) {
          seen.add(p.type);
          result.push({ ...p, id: p.type, name: p.name });
        }
      }
      const defs = Object.keys(this.platformDefs).length > 0
        ? this.platformDefs
        : Object.fromEntries(Object.keys(PLATFORM_ICONS).map(type => [type, {}]));
      for (const [type, def] of Object.entries(defs)) {
        if (!seen.has(type)) {
          result.push({
            id: type,
            type,
            name: def.name || type.charAt(0).toUpperCase() + type.slice(1),
            has_key: false,
            auth_type: def.auth_type || 'bearer',
            defaultW: def.defaultW || 1,
            defaultH: def.defaultH || 1,
          });
        }
      }
      return result;
    },

    detailPlatform() {
      if (!this.detailPlatformId) return null;
      return this.platforms.find(p => p.id === this.detailPlatformId);
    },

    currentTime() {
      const locale = I18N.getLocale() === 'zh-CN' ? 'zh-CN' : 'en-US';
      return new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    },

    confirmDeleteMsg() {
      const name = this.confirmDeleteTarget?.name || '';
      if (I18N.getLocale() === 'zh-CN') {
        return `确认从面板移除「<strong>${name}</strong>」？`;
      }
      return `Remove "<strong>${name}</strong>" from panel?`;
    },
  },

  async mounted() {
    try { this.appVersion = await window.electronAPI.getVersion(); } catch (_) {}

    const [platforms, layout, platformDefs] = await Promise.all([
      window.electronAPI.getPlatforms(),
      window.electronAPI.getLayout(),
      window.electronAPI.getPlatformDefs(),
    ]);
    this.platforms = platforms;
    this.layout = layout;
    this.platformDefs = platformDefs;

    if (layout.length === 0 || !platforms.some(p => p.has_key)) {
      this.showWizard = true;
    }

    this.autoRefreshTimer = setInterval(() => this.refreshAll(), 30 * 60 * 1000);
    this.nowTickTimer = setInterval(() => { this.now = Date.now(); }, 5000);

    window.electronAPI.onWindowMaximized((maximized) => {
      this.windowMaximized = maximized;
    });

    window.addEventListener('i18n:locale-changed', () => { this.i18nKey++; });

    setTimeout(() => this.refreshAll(), 500);
  },

  beforeUnmount() {
    clearInterval(this.autoRefreshTimer);
    clearInterval(this.nowTickTimer);
  },

  methods: {
    async refreshOne(instanceId) {
      const plat = this.platforms.find(p => p.id === instanceId);
      if (!plat) return;
      plat.loading = true;
      this.setStatus(instanceId, I18N.t('status.querying'), 'loading');

      try {
        const data = await window.electronAPI.refreshPlatform(instanceId);
        if (data.error) { this.setStatus(instanceId, `❌ ${data.error}`, 'error'); return; }

        if (data.result.status === 'ok') {
          this.balances[instanceId] = data.result.data;
          this.lastUpdated[instanceId] = Date.now();
          if (data.result.data.today) this.todayUsages[instanceId] = data.result.data.today;
          this.setStatus(instanceId, I18N.t('status.updated', { time: new Date().toLocaleTimeString(I18N.getLocale() === 'zh-CN' ? 'zh-CN' : 'en-US') }), 'success');
        } else if (data.result.status === 'no_api') {
          this.setStatus(instanceId,
            data.result.message + (data.result.console_url
              ? `<br><a href="${data.result.console_url}" target="_blank">${I18N.t('status.goToConsole')}</a>`
              : ''), 'no-api');
        } else {
          this.setStatus(instanceId, `❌ ${data.result.message || 'HTTP ' + data.result.code || I18N.t('status.unknownError')}`, 'error');
        }
      } catch (e) {
        this.setStatus(instanceId, I18N.t('status.networkError', { msg: e.message }), 'error');
      } finally {
        plat.loading = false;
      }
    },

    async refreshAll() {
      if (this.refreshingAll) return;
      this.refreshingAll = true;
      try {
        const targets = this.layoutPlatforms.filter(p => p.has_key && p.has_balance_api);
        await Promise.all(targets.map(p => this.refreshOne(p.id)));
      } finally {
        this.refreshingAll = false;
      }
    },

    setStatus(instanceId, msg, cls) {
      this.statuses[instanceId] = { msg, cls };
      if (cls === 'success') {
        setTimeout(() => {
          if (this.statuses[instanceId]?.cls === 'success') this.statuses[instanceId] = null;
        }, 5000);
      }
    },

    onDragStart(instanceId) {
      this.draggingId = instanceId;
    },

    onDragOver(instanceId) {
      if (instanceId && instanceId !== this.draggingId) {
        this.dragOverId = instanceId;
      }
    },

    onDrop(fromId, toId) {
      if (!fromId || !toId || fromId === toId) return;
      const fromIdx = this.layout.findIndex(l => l.id === fromId);
      const toIdx = this.layout.findIndex(l => l.id === toId);
      if (fromIdx < 0 || toIdx < 0) return;
      const [item] = this.layout.splice(fromIdx, 1);
      this.layout.splice(toIdx, 0, item);
      this.persistLayout();
      this.draggingId = null;
      this.dragOverId = null;
    },

    onDragEnd() {
      this.draggingId = null;
      this.dragOverId = null;
    },

    openDetail(instanceId) {
      if (this.draggingId) return;
      this.detailPlatformId = instanceId;
    },
    closeDetail() {
      this.detailPlatformId = null;
    },

    openSettings(plat) {
      this.editingPlatform = { ...plat };
      this.showModal = true;
    },
    async closeModal() {
      if (this.pendingAddInstanceId) {
        const rollbackId = this.pendingAddInstanceId;
        this.pendingAddInstanceId = null;
        await window.electronAPI.removePlatformInstance(rollbackId);
        const idx = this.layout.findIndex(l => l.id === rollbackId);
        if (idx >= 0) this.layout.splice(idx, 1);
        this.platforms = await window.electronAPI.getPlatforms();
      }
      this.showModal = false;
      this.editingPlatform = null;
    },
    async onSettingsSaved({ instanceId, hasNewKey }) {
      this.pendingAddInstanceId = null;
      this.platforms = await window.electronAPI.getPlatforms();
      this.closeModal();
      if (hasNewKey) {
        const plat = this.platforms.find(p => p.id === instanceId);
        if (plat?.has_balance_api) {
          await this.refreshOne(instanceId);
        }
      }
    },

    openAddModal() { this.showAddModal = true; },
    closeAddModal() { this.showAddModal = false; },

    async addCard(platformType) {
      const resp = await window.electronAPI.addPlatformInstance(platformType);
      if (resp.error) return;
      const instanceId = resp.instanceId;
      this.pendingAddInstanceId = instanceId;
      const platDef = this.platforms.find(p => p.type === platformType);
      this.layout.push({
        id: instanceId,
        type: platformType,
        x: 0, y: 0,
        w: platDef?.defaultW || 1,
        h: platDef?.defaultH || 1,
      });
      this.persistLayout();
      this.platforms = await window.electronAPI.getPlatforms();
      this.closeAddModal();
      const newPlat = this.platforms.find(p => p.id === instanceId);
      if (newPlat) {
        this.openSettings(newPlat);
      }
    },

    removeCard(instanceId) {
      const plat = this.platforms.find(p => p.id === instanceId);
      const name = plat?.alias || plat?.name || instanceId;
      this.confirmDeleteTarget = { id: instanceId, name };
      this.showConfirmDelete = true;
    },

    async confirmDelete() {
      if (!this.confirmDeleteTarget) return;
      const instanceId = this.confirmDeleteTarget.id;
      await window.electronAPI.removePlatformInstance(instanceId);
      const idx = this.layout.findIndex(l => l.id === instanceId);
      if (idx >= 0) this.layout.splice(idx, 1);
      this.platforms = await window.electronAPI.getPlatforms();
      this.showConfirmDelete = false;
      this.confirmDeleteTarget = null;
    },

    cancelDelete() {
      this.showConfirmDelete = false;
      this.confirmDeleteTarget = null;
    },

    onSettingsDelete(instanceId) {
      this.pendingAddInstanceId = null;
      this.closeModal();
      setTimeout(() => this.removeCard(instanceId), 150);
    },

    persistLayout() {
      window.electronAPI.saveLayout(
        this.layout.map(item => {
          const plat = this.platforms.find(p => p.id === item.id);
          return {
            id: item.id,
            type: item.type || plat?.type || item.id.split('#')[0],
            x: 0, y: 0, w: 1, h: 1,
          };
        })
      );
    },

    async onWizardAddCard(instanceId) {
      this.platforms = await window.electronAPI.getPlatforms();
      const plat = this.platforms.find(p => p.id === instanceId);
      if (plat && !this.layout.find(l => l.id === instanceId)) {
        this.layout.push({ id: instanceId, type: plat.type, x: 0, y: 0, w: 1, h: 1 });
        this.persistLayout();
      }
      this.showWizard = false;
      if (instanceId) {
        setTimeout(() => this.refreshOne(instanceId), 300);
      }
    },
    onWizardSkip() {
      this.showWizard = false;
    },

    minimizeWindow() { window.electronAPI.windowMinimize(); },
    toggleMaximize() { window.electronAPI.windowMaximize(); },
    closeWindow() { window.electronAPI.windowClose(); },
  },

  template: `
    <div :key="i18nKey">
    <WelcomeWizard
      v-if="showWizard"
      :platforms="platforms"
      :available-platforms="availablePlatforms"
      @add-card="onWizardAddCard"
      @skip="onWizardSkip"
    />

    <template v-if="!showWizard">
      <header class="status-bar">
        <div class="status-bar-left">⚡ ${I18N.t('app.title')}</div>
        <div class="status-bar-right">
          <span>{{ currentTime }}</span>
          <span class="version">v{{ appVersion }}</span>
          <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;font-size:0.8rem" title="Minimize" @click="minimizeWindow">─</button>
          <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;font-size:0.8rem" title="Maximize" @click="toggleMaximize">□</button>
          <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;font-size:0.8rem" title="Close" @click="closeWindow">✕</button>
        </div>
      </header>

      <main class="desktop">
        <div v-if="layoutPlatforms.length === 0" class="empty-state">
          <div class="empty-icon">📱</div>
          <div class="empty-text">${I18N.t('app.empty')}</div>
          <div class="empty-hint">${I18N.t('app.emptyHint')}</div>
        </div>

        <div v-else class="platform-list">
          <PlatformCard
            v-for="p in layoutPlatforms"
            :key="p.id"
            :platform="p"
            :balance="balances[p.id]"
            :status="statuses[p.id]"
            :today-usage="todayUsages[p.id]"
            :dragging="draggingId === p.id"
            :drag-over="dragOverId === p.id"
            :last-updated="lastUpdated[p.id]"
            :now="now"
            @open="openDetail"
            @dragstart="onDragStart"
            @dragover="onDragOver"
            @dragend="onDragEnd"
            @drop="onDrop"
            @remove="removeCard"
          />
        </div>
      </main>

      <footer class="dock">
        <button class="dock-btn primary" @click="openAddModal">
          <span class="dock-icon">＋</span>
          <span>${I18N.t('dock.add')}</span>
        </button>
        <button class="dock-btn primary" :class="{ spinning: refreshingAll }" @click="refreshAll" :disabled="refreshingAll">
          <span class="dock-icon">⟳</span>
          <span>${I18N.t('dock.refreshAll')}</span>
        </button>
      </footer>
    </template>

    <DetailSheet
      v-if="detailPlatform"
      :platform="detailPlatform"
      :balance="balances[detailPlatformId]"
      :status="statuses[detailPlatformId]"
      :today-usage="todayUsages[detailPlatformId]"
      @close="closeDetail"
      @refresh="refreshOne"
      @settings="openSettings"
    />

    <SettingsModal
      :visible="showModal"
      :platform="editingPlatform"
      @close="closeModal"
      @saved="onSettingsSaved"
      @delete="onSettingsDelete"
    />

    <AddCardModal
      :visible="showAddModal"
      :available-platforms="availablePlatforms"
      :layout="layout"
      @close="closeAddModal"
      @add="addCard"
    />

    <div v-if="showConfirmDelete" class="confirm-overlay" @click.self="cancelDelete">
      <div class="confirm-dialog">
        <div class="confirm-icon-wrap">
          <svg class="confirm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </div>
        <h3 class="confirm-title">${I18N.t('delete.title')}</h3>
        <p class="confirm-message" v-html="confirmDeleteMsg"></p>
        <p class="confirm-hint">${I18N.t('delete.hint')}</p>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-btn-cancel" @click="cancelDelete">${I18N.t('delete.cancel')}</button>
          <button class="confirm-btn confirm-btn-danger" @click="confirmDelete">${I18N.t('delete.confirm')}</button>
        </div>
      </div>
    </div>
    </div>
  `,
}).mount('#app');
