/**
 * Lyra AI Chat
 * 嵌入式AI对话浮窗模块
 *
 * 使用方式:
 * ```jsx
 * import { FloatPanel, FloatPanelTrigger, initLyraAIChat } from 'lyra-ai-chat'
 * import 'lyra-ai-chat/styles/index.css'
 *
 * // 初始化
 * initLyraAIChat({
 *   apiKey: 'your-api-key',
 *   // ... 其他配置
 * })
 *
 * // 在React组件中使用
 * function App() {
 *   return (
 *     <>
 *       <YourApp />
 *       <FloatPanel />
 *       <FloatPanelTrigger position="bottom-right" />
 *     </>
 *   )
 * }
 * ```
 */

// ============================================
// Imports
// ============================================

import { chatService, mcpService, registerBuiltinMCPs as registerBuiltinMCPsInternal } from './services.js'
import { contextActions, panelActions } from './store.js'
import { FloatPanel as FloatPanelComponent, FloatPanelTrigger as FloatPanelTriggerComponent } from './components.jsx'
import { DEFAULT_AI_CONFIG } from '../config/aiConfig.js'

// ============================================
// 组件导出
// ============================================

export {
  FloatPanel,
  FloatPanelTrigger,
  ChatPanel,
  ChatInput,
  MessageList,
  ContextStatus,
  ContextDetail
} from './components.jsx'

// ============================================
// 服务导出
// ============================================

export { mcpService, chatService, registerBuiltinMCPs } from './services.js'

// ============================================
// Store导出
// ============================================

export {
  contextStore, contextActions,
  chatStore, chatActions,
  panelStore, panelActions,
  mcpStore, mcpActions
} from './store.js'

// ============================================
// Hooks导出
// ============================================

export {
  useContextStore,
  useChatStore,
  usePanelStore,
  useMCPStore,
  useChatService,
  useMCPService,
  useDraggable,
  useResizable,
  useAutoResize,
  useContextBridge
} from './hooks.js'

// ============================================
// 初始化函数
// ============================================

/**
 * 初始化配置
 * @typedef {Object} LyraAIChatConfig
 * @property {string} [apiKey] - Claude API密钥
 * @property {string} [baseUrl] - API基础URL
 * @property {string} [model] - 默认模型
 * @property {number} [maxTokens] - 最大token数
 * @property {boolean} [registerBuiltins] - 是否注册内置MCP
 * @property {Array<Object>} [mcpServers] - 预配置的MCP服务器
 */

/**
 * 初始化 Lyra AI Chat
 * ⚠️ 注意：配置应该由 SettingsManager 管理，这个函数主要用于测试或独立使用
 * @param {LyraAIChatConfig} config
 */
export function initLyraAIChat(config = {}) {
  const {
    apiKey,
    baseUrl,
    model,
    maxTokens,
    registerBuiltins = true,
    mcpServers = []
  } = config

  // 配置API
  if (apiKey) {
    const apiConfig = {
      apiKey,
      baseUrl: baseUrl || DEFAULT_AI_CONFIG.anthropic.baseUrl,
      model: model || DEFAULT_AI_CONFIG.anthropic.model,
      maxTokens: maxTokens || DEFAULT_AI_CONFIG.anthropic.maxTokens,
      protocol: 'anthropic' // 默认使用 Anthropic 协议
    }
    chatService.configure(apiConfig)
  }

  // 注册内置MCP
  if (registerBuiltins) {
    registerBuiltinMCPsInternal()
  }

  // 添加预配置的MCP服务器
  for (const server of mcpServers) {
    mcpService.addCustomServer(server)
  }

  console.log('[Lyra AI Chat] Initialized')
}

/**
 * 添加浏览上下文消息
 * 供浏览面板调用，将查看的消息添加到AI对话上下文
 *
 * @param {import('./store').ContextMessage} message
 */
export function addBrowsingContext(message) {
  contextActions.addToContext(message)
}

/**
 * 清理指定范围的上下文
 * @param {number} fromIndex
 * @param {number} toIndex
 */
export function clearBrowsingContext(fromIndex, toIndex) {
  contextActions.clearRange(fromIndex, toIndex)
}

/**
 * 记录分支切换
 * @param {string} from
 * @param {string} to
 */
export function recordBranchSwitch(from, to) {
  contextActions.recordBranchSwitch(from, to)
}

/**
 * 打开浮窗面板
 */
export function openPanel() {
  panelActions.open()
}

/**
 * 关闭浮窗面板
 */
export function closePanel() {
  panelActions.close()
}

/**
 * 切换浮窗面板
 */
export function togglePanel() {
  panelActions.toggle()
}

// ============================================
// 默认导出
// ============================================

export default {
  // 组件
  FloatPanel: FloatPanelComponent,
  FloatPanelTrigger: FloatPanelTriggerComponent,

  // 服务
  mcpService,
  chatService,

  // 初始化
  init: initLyraAIChat,

  // 上下文操作
  addBrowsingContext,
  clearBrowsingContext,
  recordBranchSwitch,

  // 面板操作
  openPanel,
  closePanel,
  togglePanel
}
