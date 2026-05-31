// Debug version — strip electronAPI calls
const { createApp } = Vue;

createApp({
  data() {
    return {
      platforms: [
        { id: 'test', name: 'Test', alias: 'Test', has_key: false, has_balance_api: false, console_url: '' }
      ],
      balances: {},
      statuses: {},
      todayUsages: {},
      refreshingAll: false,
      showModal: false,
      editingPlatform: null,
      formAlias: '',
      formKey: '',
      showKey: false,
      windowMaximized: false,
    };
  },
  mounted() {
    console.log('Vue mounted OK');
  },
  methods: {
    formatBalance() { return '--'; },
    balanceLabel() { return 'test'; },
    balanceDetails() { return []; },
    todayUsage() { return null; },
    statusMsg() { return ''; },
    statusClass() { return ''; },
    refreshAll() {},
    refreshOne() {},
    openSettings() {},
    closeModal() {},
    saveSettings() {},
    minimizeWindow() {},
    toggleMaximize() {},
    closeWindow() {},
  },
}).mount('#app');
