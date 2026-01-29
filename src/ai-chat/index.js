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

// 内部 imports - 用于初始化函数和默认导出
import { chatService as chatServiceInternal } from './services/ChatService.js'
import { mcpService as mcpServiceInternal, registerBuiltinMCPs as registerBuiltinMCPsInternal } from './services/MCPService.js'
import { settingsActions as settingsActionsInternal, contextActions as contextActionsInternal, panelActions as panelActionsInternal } from './store/index.js'
import { FloatPanel as FloatPanelComponent, FloatPanelTrigger as FloatPanelTriggerComponent } from './components/FloatPanel.jsx'

// ============================================
// 组件导出
// ============================================

export { FloatPanel, FloatPanelTrigger } from './components/FloatPanel.jsx'
export { ChatPanel } from './components/ChatPanel/index.jsx'
export { ManagePanel } from './components/ManagePanel/index.jsx'
export { MessageList } from './components/ChatPanel/MessageList.jsx'
export { ChatInput } from './components/ChatPanel/ChatInput.jsx'
export { ContextStatus, ContextDetail } from './components/ChatPanel/ContextStatus.jsx'
export { MCPServerList } from './components/ManagePanel/MCPServerList.jsx'
export { APISettings } from './components/ManagePanel/APISettings.jsx'

// 通用组件
export * from './components/Common/index.jsx'

// ============================================
// 服务导出
// ============================================

export { mcpService, registerBuiltinMCPs } from './services/MCPService.js'
export { chatService } from './services/ChatService.js'

// ============================================
// Store导出
// ============================================

export {
  contextStore, contextActions,
  chatStore, chatActions,
  panelStore, panelActions,
  mcpStore, mcpActions,
  settingsStore, settingsActions
} from './store/index.js'

// ============================================
// Hooks导出
// ============================================

export {
  useContextStore,
  useChatStore,
  usePanelStore,
  useMCPStore,
  useSettingsStore,
  useChatService,
  useMCPService,
  useDraggable,
  useResizable,
  useAutoResize,
  useContextBridge
} from './hooks/index.js'

// ============================================
// 类型导出 (JSDoc类型参考)
// ============================================

// 类型定义在 types/index.js 中，通过 JSDoc 注释使用

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
      baseUrl: baseUrl || 'https://api.anthropic.com',
      model: model || 'claude-sonnet-4-5-20250929',
      maxTokens: maxTokens || 4096
    }
    settingsActionsInternal.setAPIConfig(apiConfig)
    chatServiceInternal.configure(apiConfig)
  }

  // 注册内置MCP
  if (registerBuiltins) {
    registerBuiltinMCPsInternal()
  }

  // 添加预配置的MCP服务器
  for (const server of mcpServers) {
    mcpServiceInternal.addCustomServer(server)
  }

  console.log('[Lyra AI Chat] Initialized')
}

/**
 * 添加浏览上下文消息
 * 供浏览面板调用，将查看的消息添加到AI对话上下文
 *
 * @param {import('./types').ContextMessage} message
 */
export function addBrowsingContext(message) {
  contextActionsInternal.addToContext(message)
}

/**
 * 清理指定范围的上下文
 * @param {number} fromIndex
 * @param {number} toIndex
 */
export function clearBrowsingContext(fromIndex, toIndex) {
  contextActionsInternal.clearRange(fromIndex, toIndex)
}

/**
 * 记录分支切换
 * @param {string} from
 * @param {string} to
 */
export function recordBranchSwitch(from, to) {
  contextActionsInternal.recordBranchSwitch(from, to)
}

/**
 * 打开浮窗面板
 */
export function openPanel() {
  panelActionsInternal.open()
}

/**
 * 关闭浮窗面板
 */
export function closePanel() {
  panelActionsInternal.close()
}

/**
 * 切换浮窗面板
 */
export function togglePanel() {
  panelActionsInternal.toggle()
}

// ============================================
// 默认导出
// ============================================

export default {
  // 组件
  FloatPanel: FloatPanelComponent,
  FloatPanelTrigger: FloatPanelTriggerComponent,

  // 服务
  mcpService: mcpServiceInternal,
  chatService: chatServiceInternal,

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
