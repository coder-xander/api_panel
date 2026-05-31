// ⚡ API 聚合面板 — Vue 3 主应用（组件化）
const { createApp } = Vue;

createApp({
  components: { PlatformCard, SettingsModal },

  data() {
    return {
      platforms: [],
      balances: {},
      statuses: {},
      todayUsages: {},
      refreshingAll: false,
      showModal: false,
      editingPlatform: null,
      autoRefreshTimer: null,
      windowMaximized: false,
    };
  },

  async mounted() {
    await this.loadPlatforms();
    await this.refreshAll();
    this.autoRefreshTimer = setInterval(() => this.refreshAll(), 30 * 60 * 1000);

    window.electronAPI.onWindowMaximized((maximized) => {
      this.windowMaximized = maximized;
    });
  },

  beforeUnmount() {
    clearInterval(this.autoRefreshTimer);
  },

  methods: {
    // ─── 数据 ───
    async loadPlatforms() {
      try {
        this.platforms = await window.electronAPI.getPlatforms();
      } catch (e) {
        console.error('Failed to load platforms:', e);
      }
    },

    // ─── 刷新 ───
    async refreshOne(platId) {
      const plat = this.platforms.find(p => p.id === platId);
      if (!plat) return;
      plat.loading = true;
      this.setStatus(platId, '⏳ 正在查询...', 'loading');

      try {
        const data = await window.electronAPI.refreshPlatform(platId);
        if (data.error) { this.setStatus(platId, `❌ ${data.error}`, 'error'); return; }

        if (data.result.status === 'ok') {
          this.balances[platId] = data.result.data;
          if (data.result.data.today) this.todayUsages[platId] = data.result.data.today;
          this.setStatus(platId, `✓ 已更新 — ${new Date().toLocaleTimeString('zh-CN')}`, 'success');
        } else if (data.result.status === 'no_api') {
          this.setStatus(platId,
            data.result.message + (data.result.console_url
              ? `<br><a href="${data.result.console_url}" target="_blank">→ 前往网页控制台</a>`
              : ''), 'no-api');
        } else {
          this.setStatus(platId, `❌ ${data.result.message || 'HTTP ' + data.result.code || '未知错误'}`, 'error');
        }
      } catch (e) {
        this.setStatus(platId, `❌ 网络错误: ${e.message}`, 'error');
      } finally {
        plat.loading = false;
      }
    },

    async refreshAll() {
      this.refreshingAll = true;
      const targets = this.platforms.filter(p => p.has_key && p.has_balance_api);
      await Promise.all(targets.map(p => this.refreshOne(p.id)));
      this.refreshingAll = false;
    },

    setStatus(platId, msg, cls) {
      this.statuses[platId] = { msg, cls };
      if (cls === 'success') {
        setTimeout(() => {
          if (this.statuses[platId]?.cls === 'success') this.statuses[platId] = null;
        }, 5000);
      }
    },

    // ─── 设置弹窗 ───
    openSettings(plat) {
      this.editingPlatform = { ...plat };
      this.showModal = true;
    },

    closeModal() {
      this.showModal = false;
      this.editingPlatform = null;
    },

    async onSettingsSaved({ platId, hasNewKey }) {
      await this.loadPlatforms();
      this.closeModal();
      if (hasNewKey && this.platforms.find(p => p.id === platId)?.has_balance_api) {
        await this.refreshOne(platId);
      }
    },

    // ─── 窗口控制 ───
    minimizeWindow() { window.electronAPI.windowMinimize(); },
    toggleMaximize() { window.electronAPI.windowMaximize(); },
    closeWindow() { window.electronAPI.windowClose(); },
  },

  template: `
    <!-- ══════ 自定义标题栏 ══════ -->
    <header class="app-header">
      <div class="titlebar-drag">
        <span class="titlebar-logo">⚡ API 聚合面板</span>
      </div>
      <div class="titlebar-actions">
        <button class="titlebar-refresh" :class="{ spinning: refreshingAll }" @click="refreshAll" :disabled="refreshingAll">
          <span class="icon">⟳</span> 全部刷新
        </button>
        <div class="window-controls">
          <button class="win-btn win-btn-min" title="最小化" @click="minimizeWindow">
            <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="5.5" width="9" height="1.5" rx="0.75" fill="currentColor"/></svg>
          </button>
          <button class="win-btn win-btn-max" title="最大化" @click="toggleMaximize">
            <svg v-if="windowMaximized" width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="0" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="2" width="8" height="8" rx="1.5" fill="var(--bg-card)" stroke="currentColor" stroke-width="1.5"/></svg>
            <svg v-else width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
          </button>
          <button class="win-btn win-btn-close" title="关闭" @click="closeWindow">
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1.5" y1="1.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="10.5" y1="1.5" x2="1.5" y2="10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="cards-grid">
        <PlatformCard
          v-for="p in platforms" :key="p.id"
          :platform="p"
          :balance="balances[p.id]"
          :status="statuses[p.id]"
          :today-usage="todayUsages[p.id]"
          @refresh="refreshOne"
          @settings="openSettings"
        />
      </div>
    </main>

    <SettingsModal
      :visible="showModal"
      :platform="editingPlatform"
      @close="closeModal"
      @saved="onSettingsSaved"
    />

    <footer class="footer">
      <span>数据存储于本地 <code>config/keys.json</code></span>
      <span class="footer-dot">·</span>
      <span>每 30 分钟自动刷新</span>
      <span class="footer-dot">·</span>
      <span>Electron 1.0.0</span>
    </footer>
  `,
}).mount('#app');
