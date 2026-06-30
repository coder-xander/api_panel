// ⚡ DetailSheet — 平台详情面板（从底部滑出）
// 显示完整余额信息、统计数据、操作按钮

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
      return { value: `${symbol}${bal.total.toFixed(2)}`, label: `总余额 (${bal.currency || 'CNY'})` };
    },

    balanceDetails() {
      if (!this.hasData) return [];
      const b = this.balance;
      if (!b.balances || !b.balances.length) return [];
      const bal = b.balances[0];
      const symbol = bal.currency === 'USD' ? '$' : '¥';
      const items = [];
      if (bal.granted !== undefined) items.push({ label: '赠送余额', value: `${symbol}${bal.granted.toFixed(2)}` });
      if (bal.topped_up !== undefined) items.push({ label: '充值余额', value: `${symbol}${bal.topped_up.toFixed(2)}` });
      if (bal.voucher !== undefined) items.push({ label: '代金券', value: `${symbol}${bal.voucher.toFixed(2)}` });
      if (bal.cash !== undefined) items.push({ label: '现金余额', value: `${symbol}${bal.cash.toFixed(2)}` });
      return items;
    },

    showLumaiStats() {
      return this.balance?.live_today || (this.balance?.models && this.balance.models.length) || this.balance?.lifetime;
    },

    showTodayUsage() {
      return this.todayUsage && !this.balance?.live_today;
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

        <!-- 头部 -->
        <div class="sheet-header">
          <div class="sheet-icon"><img :src="icon" :alt="platform.name" class="sheet-icon-img"></div>
          <div class="sheet-title">
            <h2>{{ platform.name }}</h2>
            <div class="sheet-subtitle">{{ platform.alias || '' }}</div>
          </div>
          <button class="sheet-close" @click="$emit('close')">✕</button>
        </div>

        <div class="sheet-body">
          <!-- 未配置 -->
          <template v-if="!platform.has_key">
            <div class="unconfigured-hint">
              尚未配置 API Key<br>
              点击下方"设置"按钮进行配置
            </div>
          </template>

          <!-- 无 API -->
          <template v-else-if="!platform.has_balance_api">
            <div class="unconfigured-hint">
              此平台不支持 API 查询余额
              <br v-if="platform.console_url">
              <a v-if="platform.console_url" @click.prevent="openConsole(platform.console_url)" href="#" style="color:var(--accent);text-decoration:none;cursor:pointer">→ 前往网页控制台查看</a>
            </div>
          </template>

          <!-- 有数据 -->
          <template v-else-if="mainBalance">
            <!-- 余额大字 -->
            <div class="detail-balance">
              <div class="big-number">{{ mainBalance.value }}</div>
              <div class="balance-type">{{ mainBalance.label }}</div>
            </div>

            <!-- 统计网格 -->
            <div class="detail-stats" v-if="balanceDetails.length">
              <div v-for="d in balanceDetails" :key="d.label" class="stat-card">
                <div class="stat-label">{{ d.label }}</div>
                <div class="stat-value">{{ d.value }}</div>
              </div>
            </div>

            <!-- Lumai 详细统计 -->
            <template v-if="showLumaiStats">
              <!-- 今日实时 -->
              <div v-if="balance?.live_today" class="detail-section">
                <div class="section-title">📊 今日实时</div>
                <div class="detail-stats">
                  <div class="stat-card">
                    <div class="stat-label">请求</div>
                    <div class="stat-value">{{ balance.live_today.requests }}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">输入 Token</div>
                    <div class="stat-value">{{ fmtNum(balance.live_today.input_tokens) }}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">输出 Token</div>
                    <div class="stat-value">{{ fmtNum(balance.live_today.output_tokens) }}</div>
                  </div>
                </div>
              </div>

              <!-- 按模型拆分 -->
              <div v-if="balance?.models && balance.models.length" class="detail-section">
                <div class="section-title">🤖 按模型拆分</div>
                <div class="model-list">
                  <div v-for="m in balance.models" :key="m.model" class="model-row">
                    <span class="model-name">{{ shortModel(m.model) }}</span>
                    <span class="model-meta">{{ m.requests }}次 · \${{ m.cost.toFixed(2) }}</span>
                  </div>
                </div>
              </div>

              <!-- 终身统计 -->
              <div v-if="balance?.lifetime" class="detail-section">
                <div class="section-title">📈 终身累计</div>
                <div class="detail-stats">
                  <div class="stat-card">
                    <div class="stat-label">总请求</div>
                    <div class="stat-value">{{ balance.lifetime.requests.toLocaleString() }}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">总消耗</div>
                    <div class="stat-value">\${{ balance.lifetime.cost.toFixed(2) }}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">总 Token</div>
                    <div class="stat-value">{{ fmtNum(balance.lifetime.total_tokens) }}</div>
                  </div>
                </div>
              </div>
            </template>

            <!-- 今日用量 fallback -->
            <div v-if="showTodayUsage" class="detail-section">
              <div class="section-title">{{ todayUsage.is_today ? '📊 今日用量' : '📊 最近用量 (' + todayUsage.date + ')' }}</div>
              <div class="detail-stats">
                <div class="stat-card">
                  <div class="stat-label">请求数</div>
                  <div class="stat-value">{{ todayUsage.requests }}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">消耗</div>
                  <div class="stat-value">\${{ todayUsage.cost.toFixed(4) }}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">实际扣费</div>
                  <div class="stat-value">\${{ todayUsage.actual_cost.toFixed(4) }}</div>
                </div>
              </div>
            </div>


          </template>

          <!-- 待刷新状态 -->
          <template v-else-if="platform.has_key && platform.has_balance_api">
            <div class="unconfigured-hint">点击"刷新余额"获取数据</div>
          </template>

          <!-- 状态消息 -->
          <div v-if="status?.msg" class="detail-status" :class="statusClass" v-html="status.msg"></div>

          <!-- 操作按钮 -->
          <div class="sheet-actions">
            <button v-if="platform.has_balance_api && platform.has_key" class="btn-accent" @click="$emit('refresh', platform.id)" :disabled="platform.loading">
              ⟳ 刷新余额
            </button>
            <button @click="$emit('settings', platform)">⚙ 设置</button>
            <a v-if="platform.console_url" @click.prevent="openConsole(platform.console_url)" href="#">🔗 控制台</a>
          </div>
        </div>
      </div>
    </div>
  `,
};
