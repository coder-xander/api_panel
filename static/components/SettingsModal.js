// ⚡ SettingsModal — 平台设置弹窗组件
const SettingsModal = {
  props: {
    visible: Boolean,
    platform: Object,
  },
  emits: ['close', 'saved'],

  data() {
    return {
      formAlias: '',
      formKey: '',
      showKey: false,
    };
  },

  watch: {
    // 弹窗打开时初始化表单
    platform(plat) {
      if (plat) {
        this.formAlias = plat.alias !== plat.name ? plat.alias : '';
        this.formKey = '';
        this.showKey = false;
      }
    },
  },

  methods: {
    close() {
      this.$emit('close');
    },

    async save() {
      const platId = this.platform?.id;
      if (!platId) return;
      const updates = {};
      if (this.formAlias) updates.alias = this.formAlias;
      if (this.formKey) updates.key = this.formKey;
      updates.enabled = true;

      try {
        const resp = await window.electronAPI.updatePlatform(platId, updates);
        if (resp.status === 'ok') {
          this.$emit('saved', { platId, hasNewKey: !!this.formKey });
        }
      } catch (e) {
        console.error('Save failed:', e);
      }
    },
  },

  template: `
    <div v-if="visible" class="modal-overlay" @click.self="close">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">设置 — {{ platform?.name }}</h2>
          <button class="modal-close" @click="close">&times;</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="save">
            <label class="field">
              <span class="field-label">别名</span>
              <input type="text" v-model="formAlias" placeholder="给这个平台起个名字">
            </label>
            <label class="field">
              <span class="field-label">API Key</span>
              <div class="key-input-wrap">
                <input :type="showKey ? 'text' : 'password'" v-model="formKey" placeholder="输入 API Key" autocomplete="off">
                <button type="button" class="toggle-key" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁' }}</button>
              </div>
            </label>
            <div class="form-actions">
              <button type="submit" class="btn-primary">💾 保存</button>
              <button type="button" class="btn-secondary" @click="close">取消</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
};
