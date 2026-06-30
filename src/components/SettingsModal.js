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
      showKey: false,
      importingSource: '',
      importError: '',
      importMessage: '',
    };
  },

  watch: {
    platform(plat) {
      if (plat) {
        this.formAlias = plat.alias !== plat.name ? plat.alias : '';
        this.formKey = '';
        this.showKey = false;
        this.importError = '';
        this.importMessage = '';
        this.importingSource = '';
      }
    },
  },

  methods: {
    close() {
      this.$emit('close');
    },

    async save() {
      const instanceId = this.platform?.id;
      if (!instanceId) return;
      const updates = {};
      if (this.formAlias) updates.alias = this.formAlias;
      if (this.formKey) updates.key = this.formKey;
      updates.enabled = true;

      try {
        const resp = await window.electronAPI.updatePlatform(instanceId, updates);
        if (resp.status === 'ok') {
          this.$emit('saved', { instanceId, hasNewKey: !!this.formKey });
        }
      } catch (e) {
        console.error('Save failed:', e);
      }
    },

    async importCredential(source) {
      const instanceId = this.platform?.id;
      if (!instanceId) return;
      this.importingSource = source;
      this.importError = '';
      this.importMessage = '';

      try {
        const resp = await window.electronAPI.importPlatformCredential(instanceId, source);
        if (resp.status === 'ok') {
          this.importMessage = `已从 ${resp.source} 导入 ${resp.env_key}，并保存到 API Panel 自己的 .api_panel.env`;
          this.$emit('saved', { instanceId, hasNewKey: true });
        } else {
          this.importError = resp.message || '导入失败';
        }
      } catch (e) {
        this.importError = e.message || '导入失败';
      } finally {
        this.importingSource = '';
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

            <div v-if="platform?.has_key" class="credential-status">
              <span>当前凭据来源：{{ platform?.detected_source || 'API Panel (.api_panel.env)' }}</span>
              <code v-if="platform?.credential_env">{{ platform.credential_env }}</code>
            </div>

             <div class="import-section">
               <div class="field-label">导入 API Key</div>
               <div class="field-hint">
                 从外部工具读取一次，然后统一保存到 API Panel 自己的 .api_panel.env。
               </div>
               <div class="import-actions">
                 <button type="button" class="btn-secondary" @click="importCredential('hermes')" :disabled="!!importingSource">
                   {{ importingSource === 'hermes' ? '导入中...' : '从 Hermes Agent 导入' }}
                 </button>
                 <button type="button" class="btn-secondary" @click="importCredential('openclaw')" :disabled="!!importingSource">
                   {{ importingSource === 'openclaw' ? '导入中...' : '从 OpenClaw 导入' }}
                 </button>
               </div>
               <div v-if="importError" class="inline-error">{{ importError }}</div>
               <div v-if="importMessage" class="inline-success">{{ importMessage }}</div>
             </div>

             <label class="field">
               <span class="field-label">手动填写 API Key</span>
               <div class="key-input-wrap">
                 <input :type="showKey ? 'text' : 'password'" v-model="formKey" placeholder="输入 API Key" autocomplete="off">
                 <button type="button" class="toggle-key" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁' }}</button>
               </div>
               <div class="field-hint">手动保存后也会写入 API Panel 自己的 .api_panel.env。</div>
             </label>

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
