// ⚡ SettingsModal — 平台设置弹窗组件（实例版）
// 支持编辑实例配置、删除实例
const SettingsModal = {
  props: {
    visible: Boolean,
    platform: Object,  // 平台实例对象
  },
  emits: ['close', 'saved', 'delete'],

  data() {
    return {
      formAlias: '',
      formKey: '',
      formCookie: '',
      showKey: false,
      showCookie: false,
      extracting: false,
      extractError: '',
      defaultBrowser: '浏览器',
    };
  },

  computed: {
    isCookieAuth() {
      return this.platform?.auth_type === 'cookie';
    },
  },

  watch: {
    platform(plat) {
      if (plat) {
        this.formAlias = plat.alias !== plat.name ? plat.alias : '';
        this.formKey = '';
        this.formCookie = '';
        this.showKey = false;
        this.showCookie = false;
        this.extractError = '';
        if (plat.auth_type === 'cookie') this.fetchDefaultBrowser();
      }
    },
  },

  methods: {
    close() {
      this.$emit('close');
    },

    async fetchDefaultBrowser() {
      try {
        this.defaultBrowser = await window.electronAPI.getDefaultBrowser();
      } catch (_) { /* ignore */ }
    },

    async save() {
      const instanceId = this.platform?.id;
      if (!instanceId) return;
      const updates = {};
      if (this.formAlias) updates.alias = this.formAlias;
      if (this.formKey) updates.key = this.formKey;
      if (this.formCookie) updates.cookie = this.formCookie;
      updates.enabled = true;

      try {
        const resp = await window.electronAPI.updatePlatform(instanceId, updates);
        if (resp.status === 'ok') {
          this.$emit('saved', { instanceId, hasNewKey: !!(this.formKey || this.formCookie) });
        }
      } catch (e) {
        console.error('Save failed:', e);
      }
    },

    async extractCookie() {
      this.extracting = true;
      this.extractError = '';

      try {
        const result = await window.electronAPI.mimoExtractCookie();
        if (result.cookie) {
          this.formCookie = result.cookie;
          if (result.browser) this.defaultBrowser = result.browser;
        } else {
          this.extractError = result.error || '提取失败';
        }
      } catch (e) {
        this.extractError = e.message || '提取失败';
      } finally {
        this.extracting = false;
      }
    },

    deleteInstance() {
      // 关闭设置弹窗，通知父组件显示确认删除弹窗
      this.$emit('delete', this.platform?.id);
    },
  },

  template: `
    <div v-if="visible" class="modal-overlay" @click.self="close">
      <div class="modal settings-modal">
        <!-- 头部 -->
        <div class="settings-header">
          <div class="settings-header-content">
            <h2 class="modal-title">{{ platform?.name }}</h2>
            <span v-if="platform?.id" class="settings-instance-badge">{{ platform.id }}</span>
          </div>
          <button class="modal-close" @click="close">&times;</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="save">
            <label class="field">
              <span class="field-label">别名</span>
              <input type="text" v-model="formAlias" :placeholder="'给这个实例起个名字（默认: ' + (platform?.name || '') + ')'">
            </label>

            <!-- Cookie 鉴权平台（MiMo） -->
            <template v-if="isCookieAuth">
              <label class="field">
                <span class="field-label">小米账号 Cookie</span>
                <div class="field-hint">
                  从 {{ defaultBrowser }} 自动提取（需先在 {{ defaultBrowser }} 中登录 platform.xiaomimimo.com）
                </div>
                <div style="margin-bottom:10px">
                  <button type="button" class="btn-primary" @click="extractCookie" :disabled="extracting" style="width:100%">
                    {{ extracting ? '⏳ 正在从 ' + defaultBrowser + ' 提取...' : '🔑 从 ' + defaultBrowser + ' 一键提取 Cookie' }}
                  </button>
                </div>
                <div v-if="extractError" style="color:var(--danger);font-size:0.8rem;margin-bottom:8px">
                  ❌ {{ extractError }}
                </div>
                <div v-if="formCookie" style="color:var(--success);font-size:0.8rem;margin-bottom:8px">
                  ✅ Cookie 已获取（{{ formCookie.length }} 字符）
                </div>
                <div class="key-input-wrap">
                  <textarea v-model="formCookie" rows="3" placeholder="或手动粘贴 Cookie" style="resize:vertical;font-family:monospace;font-size:12px"></textarea>
                </div>
              </label>
            </template>

            <!-- 标准 Bearer token 平台 -->
            <template v-else>
              <label class="field">
                <span class="field-label">API Key</span>
                <div class="key-input-wrap">
                  <input :type="showKey ? 'text' : 'password'" v-model="formKey" placeholder="输入 API Key" autocomplete="off">
                  <button type="button" class="toggle-key" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁' }}</button>
                </div>
              </label>
            </template>

            <div class="form-actions">
              <button type="submit" class="btn-primary">💾 保存</button>
              <button type="button" class="btn-secondary" @click="close">取消</button>
            </div>
          </form>

          <!-- 删除实例按钮 -->
          <div class="settings-danger-zone">
            <button class="btn-danger" @click="deleteInstance">
              🗑 移除此实例
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
