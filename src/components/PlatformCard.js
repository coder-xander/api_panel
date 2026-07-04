// ⚡ PlatformCard — List card (clean, compact)
// Two and a half rows: name+balance / meta+today usage / progress bar (decorative only)

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

    todayText() {
      const t = I18N.t;
      if (this.todayUsage) {
        const cost = this.todayUsage.cost ?? this.todayUsage.actual_cost;
        const parts = [];
        if (cost !== undefined) parts.push(`$${cost.toFixed(4)}`);
        if (this.todayUsage.requests !== undefined) parts.push(`${this.todayUsage.requests}${t('card.requests')}`);
        return parts.length ? parts.join(' · ') : null;
      }
      const live = this.balance?.live_today;
      if (live) {
        const parts = [`${this.fmtNum(live.requests)}${t('card.requests')}`];
        if (live.input_tokens !== undefined) parts.push(`${this.fmtNum(live.input_tokens)}${t('card.input')}`);
        if (live.output_tokens !== undefined) parts.push(`${this.fmtNum(live.output_tokens)}${t('card.output')}`);
        return parts.join(' · ');
      }
      return null;
    },

    progressPct() {
      const bal = this.balance?.balances?.[0];
      if (!bal) return null;
      if (bal.used !== undefined && bal.limit !== undefined && bal.limit > 0) {
        return Math.round(Math.min((bal.used / bal.limit) * 100, 100));
      }
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
      const t = I18N.t;
      if (diff < 10) return t('card.justNow');
      if (diff < 60) return t('card.secondsAgo', { n: diff });
      if (diff < 3600) return t('card.minutesAgo', { n: Math.floor(diff / 60) });
      if (diff < 86400) return t('card.hoursAgo', { n: Math.floor(diff / 3600) });
      return t('card.daysAgo', { n: Math.floor(diff / 86400) });
    },

    isFresh() {
      if (!this.lastUpdated) return null;
      return Date.now() - this.lastUpdated < 3600000;
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
      <div class="drag-handle" :title="I18N.t('card.drag')">⠿</div>

      <div class="platform-icon">
        <img :src="icon" :alt="platform.name" class="platform-icon-img">
        <span class="icon-badge" :class="badgeType"></span>
      </div>

      <div class="card-body">
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
            <span class="bal-num">{{ platform.has_key ? I18N.t('app.pendingRefresh') : I18N.t('app.unconfigured') }}</span>
          </div>
        </div>

        <div class="card-row meta-row">
          <div class="meta-group">
            <span v-if="relativeTime" class="meta-time" :class="{ 'stale': isFresh === false }">{{ relativeTime }}</span>
            <span v-if="isFresh === false" class="meta-stale">· ${I18N.t('card.expired')}</span>
          </div>
          <span v-if="todayText" class="today-pill">
            <span class="today-icon">📊</span>
            {{ todayText }}
          </span>
        </div>

        <div v-if="progressPct !== null" class="card-row bar-row">
          <div class="progress-line">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <button class="card-remove-btn" @click="onRemove" :title="I18N.t('card.remove')">✕</button>
    </div>
  `,
};
