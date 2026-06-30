// ⚡ WelcomeWizard — 首次启动引导组件
// 当面板没有任何卡片时显示，引导用户添加第一个平台
const WelcomeWizard = {
  props: {
    platforms: Array,         // 所有已检测到的平台实例
    availablePlatforms: Array, // 去重后的平台类型列表
  },
  emits: ['add-card', 'skip'],

  data() {
    return {
      step: 0,  // 0=欢迎, 1=选择平台, 2=配置Key
      selectedPlatform: null,  // 选中的平台类型对象
      formKey: '',
      showKey: false,
    };
  },

  computed: {
    // 按来源分组的检测结果（已配置的实例）
    detectedBySource() {
      const groups = {};
      for (const p of this.platforms) {
        if (p.has_key) {
          const source = p.detected_source || '手动配置';
          if (!groups[source]) groups[source] = [];
          groups[source].push(p);
        }
      }
      return groups;
    },

    // 已配置的平台类型（去重，取第一个实例作为代表）
    configuredTypes() {
      const seen = new Set();
      const result = [];
      for (const p of this.platforms) {
        if (p.has_key && !seen.has(p.type)) {
          seen.add(p.type);
          result.push(p);  // p.id 是实例 ID，如 "deepseek#1"
        }
      }
      return result;
    },

    // 未配置的平台类型
    unconfiguredTypes() {
      const configured = new Set(this.configuredTypes.map(p => p.type));
      return this.availablePlatforms.filter(p => !configured.has(p.id));
    },

  },

  mounted() {
    if (this.configuredTypes.length > 0) {
      this.step = 1;
    }
  },

  methods: {
    selectPlatform(plat) {
      this.selectedPlatform = plat;
      this.formKey = '';
      if (plat.has_key) {
        // 已有 key，直接添加到面板（使用实例 ID）
        this.$emit('add-card', plat.id);
      } else {
        this.step = 2;
      }
    },

    async saveAndAdd() {
      const type = this.selectedPlatform?.type || this.selectedPlatform?.id;
      if (!type) return;
      const updates = {};
      if (this.formKey) updates.key = this.formKey;
      updates.enabled = true;

      // 创建新实例
      const resp = await window.electronAPI.addPlatformInstance(type);
      if (resp.error) return;

      // 保存配置到新实例
      await window.electronAPI.updatePlatform(resp.instanceId, updates);

      // 通知父组件添加到面板（传实例 ID，避免重复创建）
      this.$emit('add-card', resp.instanceId);
    },

    addAllDetected() {
      // 一键添加所有已检测到的平台实例
      for (const p of this.configuredTypes) {
        this.$emit('add-card', p.id);  // 使用实例 ID
      }
    },

    skip() {
      this.$emit('skip');
    },
  },

  template: `
    <div class="wizard-overlay">
      <div class="wizard">
        <!-- 步骤 0：欢迎 + 自动检测结果 -->
        <div v-if="step === 0" class="wizard-step">
          <div class="wizard-icon">⚡</div>
          <h1 class="wizard-title">欢迎使用 API 聚合面板</h1>
          <p class="wizard-subtitle">多平台 AI API 用量一目了然</p>

          <div v-if="configuredTypes.length > 0" class="wizard-detect">
            <div class="wizard-detect-title">已保存到 API Panel 的 API Key</div>
            <div class="wizard-detect-list">
              <div v-for="(instances, source) in detectedBySource" :key="source" class="wizard-detect-group">
                <div class="wizard-detect-source">来源：{{ source }}</div>
                <div v-for="p in instances" :key="p.id" class="wizard-detect-item">
                  <span class="wizard-detect-name">{{ p.name }}</span>
                  <span class="wizard-detect-key">{{ p.masked_key }}</span>
                </div>
              </div>
            </div>
            <button class="btn-primary wizard-btn" @click="addAllDetected">
              一键添加所有已保存的平台
            </button>
            <button class="btn-secondary wizard-btn" @click="step = 1">
              手动选择要添加的平台 →
            </button>
          </div>

          <div v-else class="wizard-empty">
            <p class="wizard-empty-text">还没有保存到 API Panel 的 API Key</p>
            <p class="wizard-empty-hint">可以手动填写；添加卡片后也能在设置里从 Hermes Agent 或 OpenClaw 导入</p>
            <button class="btn-primary wizard-btn" @click="step = 1">
              开始配置 →
            </button>
          </div>

          <button class="wizard-skip" @click="skip">跳过引导，直接进入面板</button>
        </div>

        <!-- 步骤 1：选择平台 -->
        <div v-if="step === 1" class="wizard-step">
          <div class="wizard-header">
            <button class="wizard-back" @click="step = 0">← 返回</button>
            <h2 class="wizard-step-title">选择平台</h2>
          </div>

          <!-- 已有 Key 的平台类型 -->
          <div v-if="configuredTypes.length > 0" class="wizard-section">
            <div class="wizard-section-title">已保存 Key（点击直接添加）</div>
            <div class="wizard-platform-grid">
              <div v-for="p in configuredTypes" :key="p.id"
                   class="wizard-platform-card detected"
                   @click="selectPlatform(p)">
                <div class="wizard-platform-name">{{ p.name }}</div>
                <div class="wizard-platform-key">{{ p.masked_key }}</div>
                <div class="wizard-platform-source">{{ p.detected_source || '已配置' }}</div>
              </div>
            </div>
          </div>

          <!-- 未配置的平台类型 -->
          <div class="wizard-section">
            <div class="wizard-section-title">⚙️ 手动配置</div>
            <div class="wizard-platform-grid">
              <div v-for="p in unconfiguredTypes" :key="p.id"
                   class="wizard-platform-card"
                   @click="selectPlatform(p)">
                <div class="wizard-platform-name">{{ p.name }}</div>
                <div class="wizard-platform-hint">需要 API Key</div>
              </div>
            </div>
          </div>

          <button class="wizard-skip" @click="skip">跳过，稍后配置</button>
        </div>

        <!-- 步骤 2：配置 Key -->
        <div v-if="step === 2 && selectedPlatform" class="wizard-step">
          <div class="wizard-header">
            <button class="wizard-back" @click="step = 1">← 返回</button>
            <h2 class="wizard-step-title">配置 {{ selectedPlatform.name }}</h2>
          </div>

          <label class="field">
            <span class="field-label">API Key</span>
            <div class="key-input-wrap">
              <input :type="showKey ? 'text' : 'password'" v-model="formKey" placeholder="输入 API Key" autocomplete="off">
              <button type="button" class="toggle-key" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁' }}</button>
            </div>
          </label>

          <div class="form-actions">
            <button class="btn-primary" @click="saveAndAdd" :disabled="!formKey">
              💾 保存并添加到面板
            </button>
            <button class="btn-secondary" @click="step = 1">取消</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
