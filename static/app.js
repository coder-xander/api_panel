// ⚡ API 聚合面板 — Vue 3 前端（Electron IPC 版 + 自定义标题栏）
const { createApp } = Vue;

createApp({
  data() {
    return {
      platforms: [],
      balances: {},
      statuses: {},
      todayUsages: {},
      refreshingAll: false,
      showModal: false,
      editingPlatform: null,
      formAlias: '',
      formKey: '',
      showKey: false,
      autoRefreshTimer: null,
      // 窗口最大化状态
      windowMaximized: false,
    };
  },

  async mounted() {
    await this.loadPlatforms();
    await this.refreshAll();
    this.autoRefreshTimer = setInterval(() => {
      this.refreshAll();
    }, 30 * 60 * 1000);

    // 监听窗口最大化事件
    window.electronAPI.onWindowMaximized((maximized) => {
      this.windowMaximized = maximized;
    });
  },

  beforeUnmount() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }
  },

  methods: {
    // ─── 数据加载 ───
    async loadPlatforms() {
      try {
        this.platforms = await window.electronAPI.getPlatforms();
      } catch (e) {
        console.error('Failed to load platforms:', e);
      }
    },

    // ─── 余额查询 ───
    async refreshOne(platId) {
      const plat = this.platforms.find(p => p.id === platId);
      if (!plat) return;
      plat.loading = true;
      this.setStatus(platId, '⏳ 正在查询...', 'loading');

      try {
        const data = await window.electronAPI.refreshPlatform(platId);

        if (data.error) {
          this.setStatus(platId, `❌ ${data.error}`, 'error');
          return;
        }

        if (data.result.status === 'ok') {
          this.balances[platId] = data.result.data;
          if (data.result.data.today) {
            this.todayUsages[platId] = data.result.data.today;
          }
          const ts = new Date().toLocaleTimeString('zh-CN');
          this.setStatus(platId, `✓ 已更新 — ${ts}`, 'success');
        } else if (data.result.status === 'no_api') {
          this.setStatus(platId,
            data.result.message +
              (data.result.console_url
                ? `<br><a href="${data.result.console_url}" target="_blank">→ 前往网页控制台</a>`
                : ''),
            'no-api');
        } else {
          this.setStatus(platId,
            `❌ ${data.result.message || 'HTTP ' + data.result.code || '未知错误'}`,
            'error');
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

    // ─── 显示格式化 ───
    formatBalance(platId) {
      const b = this.balances[platId];
      if (!b || !b.balances || !b.balances.length) return '--';
      const bal = b.balances[0];
      const symbol = bal.currency === 'USD' ? '$' : '¥';
      return `${symbol}${bal.total.toFixed(2)}`;
    },

    balanceLabel(platId) {
      const b = this.balances[platId];
      if (!b || !b.balances || !b.balances.length) return '点击刷新获取余额';
      return `总余额 (${b.balances[0].currency || 'CNY'})`;
    },

    balanceDetails(platId) {
      const b = this.balances[platId];
      if (!b || !b.balances || !b.balances.length) return [];
      const bal = b.balances[0];
      const symbol = bal.currency === 'USD' ? '$' : '¥';
      const items = [];

      if (bal.granted !== undefined) {
        items.push({ label: '赠送余额', value: `${symbol}${bal.granted.toFixed(2)}` });
      }
      if (bal.topped_up !== undefined) {
        items.push({ label: '充值余额', value: `${symbol}${bal.topped_up.toFixed(2)}` });
      }
      if (bal.voucher !== undefined) {
        items.push({ label: '代金券', value: `${symbol}${bal.voucher.toFixed(2)}` });
      }
      if (bal.cash !== undefined) {
        items.push({ label: '现金余额', value: `${symbol}${bal.cash.toFixed(2)}` });
      }
      return items;
    },

    todayUsage(platId) {
      return this.todayUsages[platId] || null;
    },

    setStatus(platId, msg, cls) {
      this.statuses[platId] = { msg, cls };
      if (cls === 'success') {
        setTimeout(() => {
          if (this.statuses[platId]?.cls === 'success') {
            this.statuses[platId] = null;
          }
        }, 5000);
      }
    },

    statusMsg(platId) {
      return this.statuses[platId]?.msg || '';
    },

    statusClass(platId) {
      return this.statuses[platId]?.cls || '';
    },

    // ─── 设置弹窗 ───
    openSettings(plat) {
      this.editingPlatform = plat;
      this.formAlias = plat.alias !== plat.name ? plat.alias : '';
      this.formKey = '';
      this.showKey = false;
      this.showModal = true;
    },

    closeModal() {
      this.showModal = false;
      this.editingPlatform = null;
    },

    async saveSettings() {
      const platId = this.editingPlatform?.id;
      if (!platId) return;
      const updates = {};
      if (this.formAlias) updates.alias = this.formAlias;
      if (this.formKey) updates.key = this.formKey;
      updates.enabled = true;
      try {
        const resp = await window.electronAPI.updatePlatform(platId, updates);
        if (resp.status === 'ok') {
          await this.loadPlatforms();
          this.closeModal();
          if (this.formKey && this.platforms.find(p => p.id === platId)?.has_balance_api) {
            await this.refreshOne(platId);
          }
        }
      } catch (e) {
        console.error('Save failed:', e);
      }
    },

    // ─── 窗口控制 ───
    minimizeWindow() {
      window.electronAPI.windowMinimize();
    },
    toggleMaximize() {
      window.electronAPI.windowMaximize();
    },
    closeWindow() {
      window.electronAPI.windowClose();
    },
  },
}).mount('#app');
