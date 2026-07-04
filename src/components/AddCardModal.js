// ⚡ AddCardModal — Add card modal component
// All platform types always addable (supports multiple instances per platform)

const AddCardModal = {
  props: {
    visible: Boolean,
    availablePlatforms: Array,
    layout: Array,
  },
  emits: ['close', 'add'],

  computed: {
    iconMap() {
      return PLATFORM_ICONS;
    },
  },

  methods: {
    getIcon(type) {
      return this.iconMap[type] || 'assets/icons/fallback.svg';
    },
    instanceCount(type) {
      return this.layout.filter(item => {
        const itemType = item.type || (item.id.includes('#') ? item.id.split('#')[0] : item.id);
        return itemType === type;
      }).length;
    },
  },

  template: `
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${I18N.t('add.title')}</h2>
          <button class="modal-close" @click="$emit('close')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="add-card-hint">${I18N.t('add.hint')}</div>
          <div class="add-card-list">
            <div
              v-for="p in availablePlatforms" :key="p.id"
              class="add-card-item"
              @click="$emit('add', p.id)"
            >
              <div style="display:flex;align-items:center;gap:10px">
                <img :src="getIcon(p.id)" :alt="p.name" class="add-card-icon">
                <span class="add-card-name">{{ p.name }}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <span v-if="instanceCount(p.id) > 0" class="add-card-count">
                  ${I18N.t('add.instanceCount', { n: instanceCount(p.id) })}
                </span>
                <span v-if="p.has_key" style="font-size:0.7rem;color:var(--accent)">●</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
