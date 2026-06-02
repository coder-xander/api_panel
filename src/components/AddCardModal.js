// ⚡ AddCardModal — 添加卡片弹窗组件
// 所有平台类型始终可添加（支持同平台多实例）
const AddCardModal = {
  props: {
    visible: Boolean,
    availablePlatforms: Array,  // 去重后的平台类型列表
    layout: Array,              // 当前布局，用于统计实例数
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
    // 统计某平台类型已添加的实例数
    // layout item.id 格式为 "deepseek#1"，availablePlatforms p.id 为 "deepseek"
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
          <h2 class="modal-title">➕ 添加平台</h2>
          <button class="modal-close" @click="$emit('close')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="add-card-hint">每个平台可添加多次，用于配置不同的 API Key</div>
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
                  {{ instanceCount(p.id) }} 个已添加
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
