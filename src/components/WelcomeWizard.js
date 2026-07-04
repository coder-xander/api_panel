// ⚡ WelcomeWizard — First-launch wizard component
// Shown when panel has no cards, guides user to add first platform

const WelcomeWizard = {
  props: {
    platforms: Array,
    availablePlatforms: Array,
  },
  emits: ['add-card', 'skip'],

  data() {
    return {
      step: 0,
      selectedPlatform: null,
      formKey: '',
      showKey: false,
    };
  },

  computed: {
    detectedBySource() {
      const groups = {};
      for (const p of this.platforms) {
        if (p.has_key) {
          const source = p.detected_source || I18N.t('wizard.manual');
          if (!groups[source]) groups[source] = [];
          groups[source].push(p);
        }
      }
      return groups;
    },

    configuredTypes() {
      const seen = new Set();
      const result = [];
      for (const p of this.platforms) {
        if (p.has_key && !seen.has(p.type)) {
          seen.add(p.type);
          result.push(p);
        }
      }
      return result;
    },

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

      const resp = await window.electronAPI.addPlatformInstance(type);
      if (resp.error) return;

      await window.electronAPI.updatePlatform(resp.instanceId, updates);
      this.$emit('add-card', resp.instanceId);
    },

    addAllDetected() {
      for (const p of this.configuredTypes) {
        this.$emit('add-card', p.id);
      }
    },

    skip() {
      this.$emit('skip');
    },
  },

  template: `
    <div class="wizard-overlay">
      <div class="wizard">
        <div v-if="step === 0" class="wizard-step">
          <div class="wizard-icon">⚡</div>
          <h1 class="wizard-title">${I18N.t('wizard.welcome')}</h1>
          <p class="wizard-subtitle">${I18N.t('wizard.subtitle')}</p>

          <div v-if="configuredTypes.length > 0" class="wizard-detect">
            <div class="wizard-detect-title">${I18N.t('wizard.savedKeys')}</div>
            <div class="wizard-detect-list">
              <div v-for="(instances, source) in detectedBySource" :key="source" class="wizard-detect-group">
                <div class="wizard-detect-source">${I18N.t('wizard.source', { source })}</div>
                <div v-for="p in instances" :key="p.id" class="wizard-detect-item">
                  <span class="wizard-detect-name">{{ p.name }}</span>
                  <span class="wizard-detect-key">{{ p.masked_key }}</span>
                </div>
              </div>
            </div>
            <button class="btn-primary wizard-btn" @click="addAllDetected">
              ${I18N.t('wizard.addAll')}
            </button>
            <button class="btn-secondary wizard-btn" @click="step = 1">
              ${I18N.t('wizard.manualSelect')}
            </button>
          </div>

          <div v-else class="wizard-empty">
            <p class="wizard-empty-text">${I18N.t('wizard.noSavedKeys')}</p>
            <p class="wizard-empty-hint">${I18N.t('wizard.noSavedHint')}</p>
            <button class="btn-primary wizard-btn" @click="step = 1">
              ${I18N.t('wizard.startConfig')}
            </button>
          </div>

          <button class="wizard-skip" @click="skip">${I18N.t('wizard.skip')}</button>
        </div>

        <div v-if="step === 1" class="wizard-step">
          <div class="wizard-header">
            <button class="wizard-back" @click="step = 0">${I18N.t('wizard.back')}</button>
            <h2 class="wizard-step-title">${I18N.t('wizard.selectPlatform')}</h2>
          </div>

          <div v-if="configuredTypes.length > 0" class="wizard-section">
            <div class="wizard-section-title">${I18N.t('wizard.configured')}</div>
            <div class="wizard-platform-grid">
              <div v-for="p in configuredTypes" :key="p.id"
                   class="wizard-platform-card detected"
                   @click="selectPlatform(p)">
                <div class="wizard-platform-name">{{ p.name }}</div>
                <div class="wizard-platform-key">{{ p.masked_key }}</div>
                <div class="wizard-platform-source">{{ p.detected_source || '${I18N.t('wizard.manual')}' }}</div>
              </div>
            </div>
          </div>

          <div class="wizard-section">
            <div class="wizard-section-title">${I18N.t('wizard.manualConfig')}</div>
            <div class="wizard-platform-grid">
              <div v-for="p in unconfiguredTypes" :key="p.id"
                   class="wizard-platform-card"
                   @click="selectPlatform(p)">
                <div class="wizard-platform-name">{{ p.name }}</div>
                <div class="wizard-platform-hint">${I18N.t('wizard.needsKey')}</div>
              </div>
            </div>
          </div>

          <button class="wizard-skip" @click="skip">${I18N.t('wizard.skipLater')}</button>
        </div>

        <div v-if="step === 2 && selectedPlatform" class="wizard-step">
          <div class="wizard-header">
            <button class="wizard-back" @click="step = 1">${I18N.t('wizard.back')}</button>
            <h2 class="wizard-step-title">${I18N.t('wizard.configKey', { name: selectedPlatform.name })}</h2>
          </div>

          <label class="field">
            <span class="field-label">${I18N.t('wizard.apiKey')}</span>
            <div class="key-input-wrap">
              <input :type="showKey ? 'text' : 'password'" v-model="formKey" :placeholder="I18N.t('wizard.apiKeyPlaceholder')" autocomplete="off">
              <button type="button" class="toggle-key" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁' }}</button>
            </div>
          </label>

          <div class="form-actions">
            <button class="btn-primary" @click="saveAndAdd" :disabled="!formKey">
              ${I18N.t('wizard.saveAndAdd')}
            </button>
            <button class="btn-secondary" @click="step = 1">${I18N.t('settings.cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
