// ⚡ DetailSheet — Platform detail panel (slides up from bottom)
// Shows full balance info, statistics, action buttons

const DetailSheet = {
  props: {
    platform: Object,
    balance: Object,
    status: Object,
    todayUsage: Object,
  },
  emits: ['close', 'refresh', 'settings'],

  computed: {
    icon() {
      return getPlatformIcon(this.platform?.id) || 'assets/icons/fallback.svg';
    },

    hasData() {
      return this.platform?.has_key && this.platform?.has_balance_api && this.balance;
    },

    mainBalance() {
      if (!this.hasData) return null;
      const b = this.balance;
      if (!b.balances || !b.balances.length) return null;
      const bal = b.balances[0];
      const symbol = bal.currency === 'USD' ? '$' : '¥';
      return { value: `${symbol}${bal.total.toFixed(2)}`, label: `${I18N.t('card.totalBalance')} (${bal.currency || 'CNY'})` };
    },

    balanceDetails() {
      if (!this.hasData) return [];
      const b = this.balance;
      if (!b.balances || !b.balances.length) return [];
      const bal = b.balances[0];
      const symbol = bal.currency === 'USD' ? '$' : '¥';
      const items = [];
      const t = I18N.t;
      if (bal.granted !== undefined) items.push({ label: t('card.granted'), value: `${symbol}${bal.granted.toFixed(2)}` });
      if (bal.topped_up !== undefined) items.push({ label: t('card.toppedUp'), value: `${symbol}${bal.topped_up.toFixed(2)}` });
      if (bal.voucher !== undefined) items.push({ label: t('card.voucher'), value: `${symbol}${bal.voucher.toFixed(2)}` });
      if (bal.cash !== undefined) items.push({ label: t('card.cash'), value: `${symbol}${bal.cash.toFixed(2)}` });
      return items;
    },

    showLumaiStats() {
      return this.balance?.live_today || (this.balance?.models && this.balance.models.length) || this.balance?.lifetime;
    },

    showTodayUsage() {
      return this.todayUsage && !this.balance?.live_today;
    },

    todayUsageTitle() {
      if (!this.todayUsage) return '';
      if (this.todayUsage.is_today) return '📊 ' + I18N.t('card.todayUsage');
      return '📊 ' + I18N.t('card.recentUsage', { date: this.todayUsage.date });
    },

    statusClass() {
      return this.status?.cls || '';
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
    shortModel(name) {
      return name.replace('claude-', '').replace('deepseek-', '').replace('gpt-', '');
    },
    openConsole(url) {
      window.electronAPI.openExternal(url);
    },
  },

  template: `
    <div>
      <div class="detail-overlay" @click.self="$emit('close')"></div>
      <div class="detail-sheet" @click.stop>
        <div class="sheet-handle"></div>

        <div class="sheet-header">
          <div class="sheet-icon"><img :src="icon" :alt="platform.name" class="sheet-icon-img"></div>
          <div class="sheet-title">
            <h2>{{ platform.name }}</h2>
            <div class="sheet-subtitle">{{ platform.alias || '' }}</div>
          </div>
          <button class="sheet-close" @click="$emit('close')">✕</button>
        </div>

        <div class="sheet-body">
          <template v-if="!platform.has_key">
            <div class="unconfigured-hint">
              ${I18N.t('detail.notConfigured')}<br>
              ${I18N.t('detail.notConfiguredHint')}
            </div>
          </template>

          <template v-else-if="!platform.has_balance_api">
            <div class="unconfigured-hint">
              ${I18N.t('detail.noApiQuery')}
              <br v-if="platform.console_url">
              <a v-if="platform.console_url" @click.prevent="openConsole(platform.console_url)" href="#" style="color:var(--accent);text-decoration:none;cursor:pointer">${I18N.t('detail.goToConsole')}</a>
            </div>
          </template>

          <template v-else-if="mainBalance">
            <div class="detail-balance">
              <div class="big-number">{{ mainBalance.value }}</div>
              <div class="balance-type">{{ mainBalance.label }}</div>
            </div>

            <div class="detail-stats" v-if="balanceDetails.length">
              <div v-for="d in balanceDetails" :key="d.label" class="stat-card">
                <div class="stat-label">{{ d.label }}</div>
                <div class="stat-value">{{ d.value }}</div>
              </div>
            </div>

            <template v-if="showLumaiStats">
              <div v-if="balance?.live_today" class="detail-section">
                <div class="section-title">📊 ${I18N.t('card.todayUsage')}</div>
                <div class="detail-stats">
                  <div class="stat-card">
                    <div class="stat-label">${I18N.t('card.requestsStat')}</div>
                    <div class="stat-value">{{ balance.live_today.requests }}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">${I18N.t('card.inputTokens')}</div>
                    <div class="stat-value">{{ fmtNum(balance.live_today.input_tokens) }}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">${I18N.t('card.outputTokens')}</div>
                    <div class="stat-value">{{ fmtNum(balance.live_today.output_tokens) }}</div>
                  </div>
                </div>
              </div>

              <div v-if="balance?.models && balance.models.length" class="detail-section">
                <div class="section-title">🤖 ${I18N.t('card.byModel')}</div>
                <div class="model-list">
                  <div v-for="m in balance.models" :key="m.model" class="model-row">
                    <span class="model-name">{{ shortModel(m.model) }}</span>
                    <span class="model-meta">{{ m.requests }} ${I18N.t('card.requests')} · \${{ m.cost.toFixed(2) }}</span>
                  </div>
                </div>
              </div>

              <div v-if="balance?.lifetime" class="detail-section">
                <div class="section-title">📈 ${I18N.t('card.lifetime')}</div>
                <div class="detail-stats">
                  <div class="stat-card">
                    <div class="stat-label">${I18N.t('card.totalRequests')}</div>
                    <div class="stat-value">{{ balance.lifetime.requests.toLocaleString() }}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">${I18N.t('card.totalCost')}</div>
                    <div class="stat-value">\${{ balance.lifetime.cost.toFixed(2) }}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">${I18N.t('card.totalTokens')}</div>
                    <div class="stat-value">{{ fmtNum(balance.lifetime.total_tokens) }}</div>
                  </div>
                </div>
              </div>
            </template>

            <div v-if="showTodayUsage" class="detail-section">
              <div class="section-title">{{ todayUsageTitle }}</div>
              <div class="detail-stats">
                <div class="stat-card">
                  <div class="stat-label">${I18N.t('card.requestsStat')}</div>
                  <div class="stat-value">{{ todayUsage.requests }}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">${I18N.t('card.totalCost')}</div>
                  <div class="stat-value">\${{ todayUsage.cost.toFixed(4) }}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">${I18N.t('card.actualCost')}</div>
                  <div class="stat-value">\${{ todayUsage.actual_cost.toFixed(4) }}</div>
                </div>
              </div>
            </div>

          </template>

          <template v-else-if="platform.has_key && platform.has_balance_api">
            <div class="unconfigured-hint">${I18N.t('detail.clickToRefresh')}</div>
          </template>

          <div v-if="status?.msg" class="detail-status" :class="statusClass" v-html="status.msg"></div>

          <div class="sheet-actions">
            <button v-if="platform.has_balance_api && platform.has_key" class="btn-accent" @click="$emit('refresh', platform.id)" :disabled="platform.loading">
              ⟳ ${I18N.t('detail.refresh')}
            </button>
            <button @click="$emit('settings', platform)">⚙ ${I18N.t('detail.settings')}</button>
            <a v-if="platform.console_url" @click.prevent="openConsole(platform.console_url)" href="#">🔗 ${I18N.t('detail.console')}</a>
          </div>
        </div>
      </div>
    </div>
  `,
};
