// ⚡ PlatformCard — 单个平台余额卡片组件
const PlatformCard = {
  props: {
    platform: Object,
    balance: Object,
    status: Object,
    todayUsage: Object,
  },
  emits: ['refresh', 'settings'],

  methods: {
    openConsole(url) {
      window.electronAPI.openExternal(url);
    },

    formatBalance() {
      const b = this.balance;
      if (!b || !b.balances || !b.balances.length) return '--';
      const bal = b.balances[0];
      const symbol = bal.currency === 'USD' ? '$' : '¥';
      return `${symbol}${bal.total.toFixed(2)}`;
    },

    balanceLabel() {
      const b = this.balance;
      if (!b || !b.balances || !b.balances.length) return '点击刷新获取余额';
      return `总余额 (${b.balances[0].currency || 'CNY'})`;
    },

    balanceDetails() {
      const b = this.balance;
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

    // 格式化大数字（K/M/B）
    fmtNum(n) {
      if (n === undefined || n === null) return '--';
      if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
      return n.toLocaleString();
    },

    // 模型名简称
    shortModel(name) {
      return name.replace('claude-', '').replace('deepseek-', '').replace('gpt-', '');
    },

    statusClass() {
      return this.status?.cls || '';
    },
  },

  template: `
    <div class="card">
      <!-- 头部 -->
      <div class="card-header">
        <div>
          <div class="card-title">{{ platform.name }}</div>
          <div class="card-alias">{{ platform.alias }}</div>
        </div>
        <span class="card-badge" :class="platform.has_key ? 'active' : 'inactive'">
          {{ platform.has_key ? '● 已配置' : '○ 未配置' }}
        </span>
      </div>

      <!-- 未配置 -->
      <template v-if="!platform.has_key">
        <div class="card-status no-api">尚未配置 API Key，点击下方按钮设置</div>
      </template>
      <!-- 无 API -->
      <template v-else-if="!platform.has_balance_api">
        <div class="card-status no-api">
          此平台不支持 API 查询余额
          <br v-if="platform.console_url">
          <a v-if="platform.console_url" @click.prevent="openConsole(platform.console_url)" href="#" style="color:var(--accent);text-decoration:none;cursor:pointer">→ 前往网页控制台查看</a>
        </div>
      </template>
      <!-- 有数据 -->
      <template v-else>
        <div class="balance-value">{{ formatBalance() }}</div>
        <div class="balance-label">{{ balanceLabel() }}</div>
        <div class="balance-details">
          <div v-for="d in balanceDetails()" :key="d.label" class="balance-detail-item">
            <span class="label">{{ d.label }}</span><br>
            <span class="value">{{ d.value }}</span>
          </div>
        </div>

        <!-- 今日实时用量（Lumai） -->
        <div v-if="balance?.live_today" class="detail-section">
          <div class="section-title">📊 今日实时</div>
          <div class="mini-grid">
            <div><span class="label">请求</span><br><span class="value">{{ balance.live_today.requests }}</span></div>
            <div><span class="label">输入 Token</span><br><span class="value">{{ fmtNum(balance.live_today.input_tokens) }}</span></div>
            <div><span class="label">输出 Token</span><br><span class="value">{{ fmtNum(balance.live_today.output_tokens) }}</span></div>
            <div><span class="label">缓存读取</span><br><span class="value">{{ fmtNum(balance.live_today.cache_read_tokens) }}</span></div>
          </div>
        </div>

        <!-- 按模型拆分（Lumai） -->
        <div v-if="balance?.models && balance.models.length" class="detail-section">
          <div class="section-title">🤖 按模型拆分</div>
          <div class="model-list">
            <div v-for="m in balance.models" :key="m.model" class="model-row">
              <span class="model-name">{{ shortModel(m.model) }}</span>
              <span class="model-meta">{{ m.requests }}次 · \${{ m.cost.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- 终身统计（Lumai） -->
        <div v-if="balance?.lifetime" class="detail-section">
          <div class="section-title">📈 终身累计</div>
          <div class="mini-grid">
            <div><span class="label">总请求</span><br><span class="value">{{ balance.lifetime.requests.toLocaleString() }}</span></div>
            <div><span class="label">总消耗</span><br><span class="value">\${{ balance.lifetime.cost.toFixed(2) }}</span></div>
            <div><span class="label">总 Token</span><br><span class="value">{{ fmtNum(balance.lifetime.total_tokens) }}</span></div>
          </div>
        </div>

        <!-- 今日用量（daily_usage fallback） -->
        <div v-if="todayUsage && !balance?.live_today" class="detail-section">
          <div class="section-title">{{ todayUsage.is_today ? '📊 今日用量' : '📊 最近用量 (' + todayUsage.date + ')' }}</div>
          <div class="mini-grid">
            <div><span class="label">请求数</span><br><span class="value">{{ todayUsage.requests }}</span></div>
            <div><span class="label">消耗</span><br><span class="value">\${{ todayUsage.cost.toFixed(4) }}</span></div>
            <div><span class="label">实际扣费</span><br><span class="value">\${{ todayUsage.actual_cost.toFixed(4) }}</span></div>
          </div>
        </div>
      </template>

      <!-- 状态 -->
      <div v-if="status?.msg" class="card-status" :class="statusClass()" v-html="status.msg"></div>

      <!-- 按钮 -->
      <div class="card-actions">
        <button v-if="platform.has_balance_api && platform.has_key" @click="$emit('refresh', platform.id)" :disabled="platform.loading">
          ⟳ 刷新余额
        </button>
        <button @click="$emit('settings', platform)">⚙ 设置</button>
        <a v-if="platform.console_url" @click.prevent="openConsole(platform.console_url)" href="#" class="btn-console">🔗 控制台</a>
      </div>
    </div>
  `,
};
