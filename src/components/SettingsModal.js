// ⚡ SettingsModal — Platform settings modal component (instance-based)
// Supports editing instance config, deleting instance

const SettingsModal = {
  props: {
    visible: Boolean,
    platform: Object,
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
      i18nKey: 0,
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
          this.importMessage = I18N.t('settings.importSuccess', { envKey: resp.env_key, source: resp.source });
          this.$emit('saved', { instanceId, hasNewKey: true });
        } else {
          this.importError = resp.message || I18N.t('settings.importFailed');
        }
      } catch (e) {
        this.importError = e.message || I18N.t('settings.importFailed');
      } finally {
        this.importingSource = '';
      }
    },

    deleteInstance() {
      this.$emit('delete', this.platform?.id);
    },

    setLocale(locale) {
      I18N.setLocale(locale);
      window.electronAPI.saveLanguage?.(locale);
    },
  },

  template: `
    <div v-if="visible" class="modal-overlay" @click.self="close">
      <div class="modal settings-modal">
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
              <span class="field-label">${I18N.t('settings.alias')}</span>
              <input type="text" v-model="formAlias" :placeholder="I18N.t('settings.aliasPlaceholder', { name: platform?.name || '' })">
            </label>

            <div v-if="platform?.has_key" class="credential-status">
              <span>${I18N.t('settings.currentSource')}{{ platform?.detected_source || 'API Panel (.api_panel.env)' }}</span>
              <code v-if="platform?.credential_env">{{ platform.credential_env }}</code>
            </div>

             <div class="import-section">
               <div class="field-label">${I18N.t('settings.importKey')}</div>
               <div class="field-hint">
                 ${I18N.t('settings.importHint')}
               </div>
               <div class="import-actions">
                 <button type="button" class="btn-secondary" @click="importCredential('hermes')" :disabled="!!importingSource">
                   {{ importingSource === 'hermes' ? I18N.t('settings.importing') : I18N.t('settings.fromHermes') }}
                 </button>
                 <button type="button" class="btn-secondary" @click="importCredential('openclaw')" :disabled="!!importingSource">
                   {{ importingSource === 'openclaw' ? I18N.t('settings.importing') : I18N.t('settings.fromOpenClaw') }}
                 </button>
               </div>
               <div v-if="importError" class="inline-error">{{ importError }}</div>
               <div v-if="importMessage" class="inline-success">{{ importMessage }}</div>
             </div>

             <label class="field">
               <span class="field-label">${I18N.t('settings.manualKey')}</span>
               <div class="key-input-wrap">
                 <input :type="showKey ? 'text' : 'password'" v-model="formKey" :placeholder="I18N.t('settings.manualKeyPlaceholder')" autocomplete="off">
                 <button type="button" class="toggle-key" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁' }}</button>
               </div>
               <div class="field-hint">${I18N.t('settings.manualKeyHint')}</div>
             </label>

            <div class="form-actions">
              <button type="submit" class="btn-primary">${I18N.t('settings.save')}</button>
              <button type="button" class="btn-secondary" @click="close">${I18N.t('settings.cancel')}</button>
            </div>
          </form>

          <div class="settings-language-section">
            <div class="field-label">${I18N.t('settings.language')}</div>
            <div class="language-selector">
              <button type="button" class="lang-btn" :class="{ active: I18N.getLocale() === 'en' }" @click="setLocale('en')">
                English
              </button>
              <button type="button" class="lang-btn" :class="{ active: I18N.getLocale() === 'zh-CN' }" @click="setLocale('zh-CN')">
                中文
              </button>
            </div>
          </div>

          <div class="settings-danger-zone">
            <button class="btn-danger" @click="deleteInstance">
              ${I18N.t('settings.removeInstance')}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
