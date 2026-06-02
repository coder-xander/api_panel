// ⚡ PLATFORM_ICONS — 全局平台图标映射
// 所有图标来自 LobeHub 官方 SVG 图标集（@lobehub/icons-static-svg）
// 未配置的平台使用通用图标 fallback
const PLATFORM_ICONS = {
  deepseek:    'assets/icons/deepseek.svg',
  kimi:        'assets/icons/kimi.svg',
  xiaomi:      'assets/icons/xiaomi.svg',
  lumai:       'assets/icons/lumai.svg',
  openrouter:  'assets/icons/openrouter.svg',
  openai:      'assets/icons/openai.svg',
  anthropic:   'assets/icons/anthropic.svg',
  gemini:      'assets/icons/gemini.svg',
  groq:        'assets/icons/groq.svg',
  siliconflow: 'assets/icons/siliconflow.svg',
  together:    'assets/icons/together.svg',
  volcengine:  'assets/icons/volcengine.svg',
  zhipu:       'assets/icons/zhipu.svg',
  minimax:     'assets/icons/minimax.svg',
};

// 获取平台图标路径，支持实例 ID（如 "deepseek#1"）和类型 ID（如 "deepseek"）
function getPlatformIcon(id) {
  const type = id.includes('#') ? id.split('#')[0] : id;
  return PLATFORM_ICONS[type] || null;
}
