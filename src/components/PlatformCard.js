// ⚡ PlatformCard — 列表卡片（精简美观版）
// 只有两层半：名称+余额 / 元信息+今日用量 / 进度条（仅装饰）

const PlatformCard = {
  props: {
    platform: Object,
    balance: Object,
    status: Object,
    todayUsage: Object,
    dragging: Boolean,
    dragOver: Boolean,
    lastUpdated: Number,
    now: Number,
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

    // 主余额
    balanceLabel() {
      if (!this.platform.has_key) return '--';
      if (!this.balance?.balances?.length) return null;
      const bal = this.balance.balances[0];
      if (bal.used !== undefined && bal.limit !== undefined) {
        return { value: `${this.fmtNum(bal.used)} / ${this.fmtNum(bal.limit)}`, unit: null };
      }
      const symbol = bal.currency === 'USD' ? '$' : '¥';
      return { value: `${symbol}${bal.total.toFixed(2)}`, unit: bal.currency || null };
    },

    // 今日用量（核心副信息）
    todayText() {
      if (this.todayUsage) {
        const cost = this.todayUsage.cost ?? this.todayUsage.actual_cost;
        const parts = [];
        if (cost !== undefined) parts.push(`$${cost.toFixed(4)}`);
        if (this.todayUsage.requests !== undefined) parts.push(`${this.todayUsage.requests}次`);
        return parts.length ? parts.join(' · ') : null;
      }
      const live = this.balance?.live_today;
      if (live) {
        const parts = [`${live.requests}次`];
        if (live.input_tokens !== undefined) parts.push(`${this.fmtNum(live.input_tokens)}入`);
        if (live.output_tokens !== undefined) parts.push(`${this.fmtNum(live.output_tokens)}出`);
        return parts.join(' · ');
      }
      return null;
    },

    // 进度条（仅 Token Plan 场景，装饰性）
    progressPct() {
      const bal = this.balance?.balances?.[0];
      if (!bal) return null;
      // Token Plan
      if (bal.used !== undefined && bal.limit !== undefined && bal.limit > 0) {
        return Math.round(Math.min((bal.used / bal.limit) * 100, 100));
      }
      // 月用量
      const month = this.balance?.monthUsage;
      if (month?.limit > 0) {
        return Math.round(Math.min((month.used / month.limit) * 100, 100));
      }
      return null;
    },

    subtitle() {
      if (this.platform.alias) return this.platform.alias;
      if (this.platform.base_url) {
        try { return new URL(this.platform.base_url).hostname; } catch (_) {}
      }
      return null;
    },

    relativeTime() {
      if (!this.lastUpdated) return null;
      const diff = Math.floor((this.now - this.lastUpdated) / 1000);
      if (diff < 10) return '刚刚';
      if (diff < 60) return `${diff}秒前`;
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
      return `${Math.floor(diff / 86400)}天前`;
    },

    // 状态（只判断新鲜度，不额外显示文字）
    isFresh() {
      if (!this.lastUpdated) return null;
      return Date.now() - this.lastUpdated < 3600000; // 1小时内算新鲜
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
    onDragLeave() { this.$emit('dragover', null); },
    onDrop(e) {
      e.preventDefault();
      const fromId = e.dataTransfer.getData('text/plain');
      this.$emit('drop', fromId, this.platform.id);
    },
    onDragEnd() { this.$emit('dragend'); },
    onRemove(e) {
      e.stopPropagation();
      this.$emit('remove', this.platform.id);
    },
  },

  template: `
    <div
      class="platform-list-item"
      :class="{
        'is-dragging': dragging,
        'is-drag-over': dragOver,
        'no-key': !platform.has_key
      }"
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

      <!-- 图标 -->
      <div class="platform-icon">
        <img :src="icon" :alt="platform.name" class="platform-icon-img">
        <span class="icon-badge" :class="badgeType"></span>
      </div>

      <!-- 内容区 -->
      <div class="card-body">
        <!-- 第一行：名称（左）+ 余额（右） -->
        <div class="card-row top-row">
          <div class="name-wrap">
            <span class="card-name">{{ platform.name }}</span>
            <span v-if="subtitle" class="card-domain">{{ subtitle }}</span>
          </div>
          <div v-if="balanceLabel" class="bal-group">
            <span class="bal-num">{{ balanceLabel.value }}</span>
            <span v-if="balanceLabel.unit" class="bal-currency">{{ balanceLabel.unit }}</span>
          </div>
          <div v-else class="bal-group bal-empty">
            <span class="bal-num">{{ platform.has_key ? '待刷新' : '未配置' }}</span>
          </div>
        </div>

        <!-- 第二行：时间（左）+ 今日用量（右） -->
        <div class="card-row meta-row">
          <div class="meta-group">
            <span v-if="relativeTime" class="meta-time" :class="{ 'stale': isFresh === false }">{{ relativeTime }}</span>
            <span v-if="isFresh === false" class="meta-stale">· 过期</span>
          </div>
          <span v-if="todayText" class="today-pill">
            <span class="today-icon">📊</span>
            {{ todayText }}
          </span>
        </div>

        <!-- 第三行：进度条（极简装饰线） -->
        <div v-if="progressPct !== null" class="card-row bar-row">
          <div class="progress-line">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 删除 -->
      <button class="card-remove-btn" @click="onRemove" title="从面板移除">✕</button>
    </div>
  `,
};
