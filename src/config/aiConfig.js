/**
 * AI API 配置默认值（2026版本）
 * 统一管理 AI 模型配置，避免重复定义
 */

/**
 * AI配置默认值
 */
export const DEFAULT_AI_CONFIG = {
  anthropic: {
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-opus-4-5-20251101',
    maxTokens: 4096
  },
  openai: {
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-2024-11-20',
    maxTokens: 4096
  }
};

/**
 * 获取默认配置
 * @param {string} protocol - 'anthropic' 或 'openai'
 * @returns {Object} 配置对象
 */
export function getDefaultConfig(protocol = 'anthropic') {
  return DEFAULT_AI_CONFIG[protocol] || DEFAULT_AI_CONFIG.anthropic;
}

export default DEFAULT_AI_CONFIG;
