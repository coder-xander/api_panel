// ⚡ API 聚合面板 — Vue 3 主应用（手机桌面风格 + 拖拽排序）
// 支持同平台多实例（不同 API Key）

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
      lastUpdated: {},      // { [instanceId]: timestamp } 每个实例最后更新时间
      now: Date.now(),      // 当前时间，定时刷新驱动相对时间计算
      refreshingAll: false,
      showAddModal: false,
      showModal: false,
      editingPlatform: null,
      autoRefreshTimer: null,
      nowTickTimer: null,   // 定时刷新 now 的计时器
      windowMaximized: false,
      appVersion: '0.0.0',
      showWizard: false,
      detailPlatformId: null,  // 实例 ID
      // 拖拽状态
      draggingId: null,    // 正在拖拽的实例 ID
      dragOverId: null,    // 拖拽悬停的目标实例 ID
      // 删除确认
      showConfirmDelete: false,
      confirmDeleteTarget: null,  // { id, name }
    };
  },

  computed: {
    // 按 layout 顺序排列的平台实例
    layoutPlatforms() {
      return this.layout
        .map(item => this.platforms.find(p => p.id === item.id))
        .filter(Boolean);
    },

    // 所有平台类型（去重，用于添加弹窗，始终可添加多实例）
    availablePlatforms() {
      // 构建去重的平台类型列表
      const seen = new Set();
      const result = [];
      for (const p of this.platforms) {
        if (!seen.has(p.type)) {
          seen.add(p.type);
          result.push({ ...p, id: p.type, name: p.name });
        }
      }
      // 补充 config 中不存在的平台类型
      // （通过 PLATFORM_ICONS 获取完整列表）
      for (const type of Object.keys(PLATFORM_ICONS)) {
        if (!seen.has(type)) {
          result.push({
            id: type,
            type,
            name: type.charAt(0).toUpperCase() + type.slice(1),
            has_key: false,
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
      return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    },
  },

  async mounted() {
    try { this.appVersion = await window.electronAPI.getVersion(); } catch (_) {}

    const [platforms, layout] = await Promise.all([
      window.electronAPI.getPlatforms(),
      window.electronAPI.getLayout(),
    ]);
    this.platforms = platforms;
    this.layout = layout;

    if (layout.length === 0 || !platforms.some(p => p.has_key)) {
      this.showWizard = true;
    }

    this.autoRefreshTimer = setInterval(() => this.refreshAll(), 30 * 60 * 1000);
    // 每 5 秒刷新一次 now，驱动相对时间显示
    this.nowTickTimer = setInterval(() => { this.now = Date.now(); }, 5000);

    window.electronAPI.onWindowMaximized((maximized) => {
      this.windowMaximized = maximized;
    });

    setTimeout(() => this.refreshAll(), 500);
  },

  beforeUnmount() {
    clearInterval(this.autoRefreshTimer);
    clearInterval(this.nowTickTimer);
  },

  methods: {
    // ─── 数据 ───
    async refreshOne(instanceId) {
      const plat = this.platforms.find(p => p.id === instanceId);
      if (!plat) return;
      plat.loading = true;
      this.setStatus(instanceId, '⏳ 正在查询...', 'loading');

      try {
        const data = await window.electronAPI.refreshPlatform(instanceId);
        if (data.error) { this.setStatus(instanceId, `❌ ${data.error}`, 'error'); return; }

        if (data.result.status === 'ok') {
          this.balances[instanceId] = data.result.data;
          this.lastUpdated[instanceId] = Date.now();  // 记录更新时间
          if (data.result.data.today) this.todayUsages[instanceId] = data.result.data.today;
          this.setStatus(instanceId, `✓ 已更新 — ${new Date().toLocaleTimeString('zh-CN')}`, 'success');
        } else if (data.result.status === 'no_api') {
          this.setStatus(instanceId,
            data.result.message + (data.result.console_url
              ? `<br><a href="${data.result.console_url}" target="_blank">→ 前往网页控制台</a>`
              : ''), 'no-api');
        } else {
          this.setStatus(instanceId, `❌ ${data.result.message || 'HTTP ' + data.result.code || '未知错误'}`, 'error');
        }
      } catch (e) {
        this.setStatus(instanceId, `❌ 网络错误: ${e.message}`, 'error');
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

    // ─── 拖拽排序 ───
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
      // 移动：从原位取出，插入目标位
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

    // ─── 详情面板 ───
    openDetail(instanceId) {
      // 拖拽时不打开详情
      if (this.draggingId) return;
      this.detailPlatformId = instanceId;
    },
    closeDetail() {
      this.detailPlatformId = null;
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
    async onSettingsSaved({ instanceId, hasNewKey }) {
      // 重新加载平台数据
      this.platforms = await window.electronAPI.getPlatforms();
      this.closeModal();
      if (hasNewKey) {
        const plat = this.platforms.find(p => p.id === instanceId);
        if (plat?.has_balance_api) {
          await this.refreshOne(instanceId);
        }
      }
    },

    // ─── 添加卡片（多实例支持） ───
    openAddModal() { this.showAddModal = true; },
    closeAddModal() { this.showAddModal = false; },

    async addCard(platformType) {
      // 1. 通过后端创建新实例，获得 instanceId
      const resp = await window.electronAPI.addPlatformInstance(platformType);
      if (resp.error) return;
      const instanceId = resp.instanceId;

      // 2. 添加到 layout
      const platDef = this.platforms.find(p => p.type === platformType);
      this.layout.push({
        id: instanceId,
        type: platformType,
        x: 0, y: 0,
        w: platDef?.defaultW || 1,
        h: platDef?.defaultH || 1,
      });
      this.persistLayout();

      // 3. 刷新平台列表
      this.platforms = await window.electronAPI.getPlatforms();

      // 4. 关闭添加弹窗
      this.closeAddModal();

      // 5. 自动打开设置弹窗
      const newPlat = this.platforms.find(p => p.id === instanceId);
      if (newPlat) {
        this.openSettings(newPlat);
      }
    },

    // ─── 移除卡片（确认弹窗） ───
    removeCard(instanceId) {
      const plat = this.platforms.find(p => p.id === instanceId);
      const name = plat?.alias || plat?.name || instanceId;
      this.confirmDeleteTarget = { id: instanceId, name };
      this.showConfirmDelete = true;
    },

    async confirmDelete() {
      if (!this.confirmDeleteTarget) return;
      const instanceId = this.confirmDeleteTarget.id;

      // 通过后端移除实例（同时清理 config 和 layout）
      await window.electronAPI.removePlatformInstance(instanceId);

      // 从本地 layout 移除
      const idx = this.layout.findIndex(l => l.id === instanceId);
      if (idx >= 0) this.layout.splice(idx, 1);

      // 刷新平台列表
      this.platforms = await window.electronAPI.getPlatforms();

      this.showConfirmDelete = false;
      this.confirmDeleteTarget = null;
    },

    cancelDelete() {
      this.showConfirmDelete = false;
      this.confirmDeleteTarget = null;
    },

    // 设置弹窗中点击「移除此实例」
    onSettingsDelete(instanceId) {
      this.closeModal();
      // 延迟一帧让设置弹窗关闭动画完成后再弹确认框
      setTimeout(() => this.removeCard(instanceId), 150);
    },

    // ─── 持久化布局（保留 type 字段） ───
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

    // ─── 引导回调（wizard 传入实例 ID，如 "deepseek#1"） ───
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

    // ─── 窗口控制 ───
    minimizeWindow() { window.electronAPI.windowMinimize(); },
    toggleMaximize() { window.electronAPI.windowMaximize(); },
    closeWindow() { window.electronAPI.windowClose(); },
  },

  template: `
    <!-- ══════ 首次启动引导 ══════ -->
    <WelcomeWizard
      v-if="showWizard"
      :platforms="platforms"
      :available-platforms="availablePlatforms"
      @add-card="onWizardAddCard"
      @skip="onWizardSkip"
    />

    <template v-if="!showWizard">
      <!-- ══════ 顶部状态栏 ══════ -->
      <header class="status-bar">
        <div class="status-bar-left">⚡ API 聚合面板</div>
        <div class="status-bar-right">
          <span>{{ currentTime }}</span>
          <span class="version">v{{ appVersion }}</span>
          <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;font-size:0.8rem" title="最小化" @click="minimizeWindow">─</button>
          <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;font-size:0.8rem" title="最大化" @click="toggleMaximize">□</button>
          <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;font-size:0.8rem" title="关闭" @click="closeWindow">✕</button>
        </div>
      </header>

      <!-- ══════ 桌面网格（可拖拽） ══════ -->
      <main class="desktop">
        <div v-if="layoutPlatforms.length === 0" class="empty-state">
          <div class="empty-icon">📱</div>
          <div class="empty-text">面板为空</div>
          <div class="empty-hint">点击底部 ＋ 添加平台卡片</div>
        </div>

        <div v-else class="platform-list">
          <PlatformCard
            v-for="p in layoutPlatforms"
            :key="p.id"
            :platform="p"
            :balance="balances[p.id]"
            :status="statuses[p.id]"
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

      <!-- ══════ 底部 Dock 栏 ══════ -->
      <footer class="dock">
        <button class="dock-btn primary" @click="openAddModal">
          <span class="dock-icon">＋</span>
          <span>添加</span>
        </button>
        <button class="dock-btn primary" :class="{ spinning: refreshingAll }" @click="refreshAll" :disabled="refreshingAll">
          <span class="dock-icon">⟳</span>
          <span>刷新全部</span>
        </button>
      </footer>
    </template>

    <!-- ══════ 详情面板 ══════ -->
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

    <!-- ══════ 设置弹窗 ══════ -->
    <SettingsModal
      :visible="showModal"
      :platform="editingPlatform"
      @close="closeModal"
      @saved="onSettingsSaved"
      @delete="onSettingsDelete"
    />

    <!-- ══════ 添加卡片弹窗 ══════ -->
    <AddCardModal
      :visible="showAddModal"
      :available-platforms="availablePlatforms"
      :layout="layout"
      @close="closeAddModal"
      @add="addCard"
    />

    <!-- ══════ 删除确认弹窗 ══════ -->
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
        <h3 class="confirm-title">移除平台</h3>
        <p class="confirm-message">
          确认从面板移除「<strong>{{ confirmDeleteTarget?.name }}</strong>」？
        </p>
        <p class="confirm-hint">API Key 配置将一并删除</p>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-btn-cancel" @click="cancelDelete">取消</button>
          <button class="confirm-btn confirm-btn-danger" @click="confirmDelete">移除</button>
        </div>
      </div>
    </div>
  `,
}).mount('#app');
