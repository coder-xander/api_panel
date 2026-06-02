// ⚡ PlatformCard — 列表卡片（支持拖拽排序、相对时间、删除）
// 拖拽手柄在左上角，长按拖拽，点击打开详情

const PlatformCard = {
  props: {
    platform: Object,
    balance: Object,
    status: Object,
    dragging: Boolean,   // 是否正在拖拽此卡片
    dragOver: Boolean,   // 是否有其他卡片拖拽到此卡片上方
    lastUpdated: Number, // 最后更新时间戳 (ms)
    now: Number,         // 当前时间戳 (ms)，用于实时计算相对时间
  },
  emits: ['open', 'dragstart', 'dragover', 'dragend', 'drop', 'remove'],

  computed: {
    icon() {
      return getPlatformIcon(this.platform.id) || 'assets/icons/fallback.svg';
    },

    badgeType() {
      if (this.platform.loading) return 'loading';
      return this.platform.has_key ? 'active' : 'inactive';
    },

    summary() {
      if (!this.platform.has_key) return '未配置';
      if (!this.platform.has_balance_api) return '仅控制台';
      if (!this.balance) return '待刷新';
      const b = this.balance;
      if (b.balances && b.balances.length > 0) {
        const bal = b.balances[0];
        if (bal.used !== undefined && bal.limit !== undefined) {
          const pct = bal.percent ? (bal.percent * 100).toFixed(0) : '0';
          return `${pct}%`;
        }
        const symbol = bal.currency === 'USD' ? '$' : '¥';
        return `${symbol}${bal.total.toFixed(2)}`;
      }
      return '--';
    },

    amountBadge() {
      if (!this.platform.has_key || !this.balance) return null;
      const b = this.balance;
      if (b.balances && b.balances.length > 0) {
        const bal = b.balances[0];
        if (bal.used !== undefined && bal.limit !== undefined) {
          return this.fmtNum(bal.used);
        }
        return null;
      }
      return null;
    },

    // 相对时间文本
    relativeTime() {
      if (!this.lastUpdated) return null;
      const diff = Math.floor((this.now - this.lastUpdated) / 1000);
      if (diff < 5) return '刚刚';
      if (diff < 60) return `${diff}秒前`;
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
      return `${Math.floor(diff / 86400)}天前`;
    },

    // 平台副标题（域名 / alias）
    subtitle() {
      if (this.platform.alias) return this.platform.alias;
      if (this.platform.base_url) {
        try { return new URL(this.platform.base_url).hostname; } catch (_) {}
      }
      return null;
    },
  },

  methods: {
    fmtNum(n) {
      if (n === undefined || n === null) return '--';
      if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
      return n.toLocaleString();
    },

    onDragStart(e) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.platform.id);
      this.$emit('dragstart', this.platform.id);
    },

    onDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      this.$emit('dragover', this.platform.id);
    },

    onDragLeave() {
      this.$emit('dragover', null);
    },

    onDrop(e) {
      e.preventDefault();
      const fromId = e.dataTransfer.getData('text/plain');
      this.$emit('drop', fromId, this.platform.id);
    },

    onDragEnd() {
      this.$emit('dragend');
    },

    onRemove(e) {
      e.stopPropagation();  // 阻止冒泡，不触发 open
      this.$emit('remove', this.platform.id);
    },
  },

  template: `
    <div
      class="platform-list-item"
      :class="{ 'is-dragging': dragging, 'is-drag-over': dragOver }"
      draggable="true"
      @dragstart="onDragStart"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @dragend="onDragEnd"
      @click="$emit('open', platform.id)"
    >
      <!-- 拖拽手柄 -->
      <div class="drag-handle" title="拖拽排序">⠿</div>

      <!-- 平台图标 -->
      <div class="platform-icon">
        <img :src="icon" :alt="platform.name" class="platform-icon-img">
        <span class="icon-badge" :class="badgeType"></span>
      </div>

      <!-- 平台信息（两行） -->
      <div class="platform-info">
        <div class="platform-name">{{ platform.name }}</div>
        <div class="platform-meta">
          <span v-if="subtitle" class="meta-alias">{{ subtitle }}</span>
          <span v-if="relativeTime" class="meta-time">· {{ relativeTime }}</span>
        </div>
      </div>

      <!-- 余额摘要 -->
      <div class="platform-summary">{{ summary }}</div>

      <!-- 余额金额 -->
      <div v-if="amountBadge" class="platform-amount">
        {{ amountBadge }}
      </div>

      <!-- 删除按钮（hover 显示） -->
      <button class="card-remove-btn" @click="onRemove" title="从面板移除">✕</button>
    </div>
  `,
};
