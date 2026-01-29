/**
 * Lyra AI Chat - State Store
 * 简易状态管理（不依赖外部库）
 */

/**
 * 创建简易的状态管理器
 * @template T
 * @param {T} initialState
 * @returns {Object}
 */
function createStore(initialState) {
  let state = { ...initialState }
  const listeners = new Set()

  return {
    getState: () => state,
    setState: (partial) => {
      const nextState = typeof partial === 'function'
        ? partial(state)
        : partial
      state = { ...state, ...nextState }
      listeners.forEach(listener => listener(state))
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

// ============================================
// Context Store - 浏览上下文状态
// ============================================

/** @type {import('../types').ContextMessage[]} */
const initialContextMessages = []

/** @type {import('../types').BrowsingPathEntry[]} */
const initialBrowsingPath = []

export const contextStore = createStore({
  /** @type {import('../types').ContextMessage[]} */
  activeContext: initialContextMessages,

  /** @type {import('../types').BrowsingPathEntry[]} */
  browsingPath: initialBrowsingPath,

  /** @type {Array<{covers: string[], summary: string}>} */
  summaries: []
})

// Context Store Actions
export const contextActions = {
  /**
   * 添加消息到上下文
   * @param {import('../types').ContextMessage} message
   */
  addToContext(message) {
    contextStore.setState(state => {
      // Prevent duplicates
      if (state.activeContext.some(m => m.uuid === message.uuid)) {
        return state;
      }
      return {
        activeContext: [...state.activeContext, message],
        browsingPath: [...state.browsingPath, {
          action: 'view',
          index: message.index,
          timestamp: Date.now()
        }]
      };
    })
  },

  /**
   * 批量设置上下文
   * @param {import('../types').ContextMessage[]} messages
   */
  setContext(messages) {
    contextStore.setState({ activeContext: messages })
  },

  /**
   * 清理指定范围的上下文
   * @param {number} fromIndex
   * @param {number} toIndex
   */
  clearRange(fromIndex, toIndex) {
    contextStore.setState(state => {
      const cleared = state.activeContext.filter(
        m => m.index >= fromIndex && m.index <= toIndex
      )
      return {
        activeContext: state.activeContext.filter(
          m => m.index < fromIndex || m.index > toIndex
        ),
        browsingPath: [...state.browsingPath, {
          action: 'clear',
          clearedRange: cleared.map(m => m.branch),
          timestamp: Date.now()
        }]
      }
    })
  },

  /**
   * 记录分支切换
   * @param {string} from
   * @param {string} to
   * @param {Object} [options]
   * @param {boolean} [options.clearPrevious=false] - 是否清理之前分支的消息
   */
  recordBranchSwitch(from, to, options = {}) {
    const { clearPrevious = false } = options

    contextStore.setState(state => {
      let nextActiveContext = state.activeContext

      // 如果需要清理之前分支的消息
      if (clearPrevious) {
        nextActiveContext = nextActiveContext.filter(m =>
          // 保留不属于 'from' 分支的消息 (或者是公共祖先)
          // 这里的逻辑假设：如果 m.branch !== from，则保留
          // 实际场景中，可能会有更复杂的分支名，这里做简单匹配
          m.branch !== from && !m.branch?.includes(from)
        )
      }

      return {
        activeContext: nextActiveContext,
        browsingPath: [...state.browsingPath, {
          action: 'switch_branch',
          from,
          to,
          cleaned: clearPrevious,
          timestamp: Date.now()
        }]
      }
    })
  },

  /**
   * 添加摘要
   * @param {string[]} covers
   * @param {string} summary
   */
  addSummary(covers, summary) {
    contextStore.setState(state => ({
      summaries: [...state.summaries, { covers, summary }]
    }))
  },

  /**
   * 清空所有上下文
   */
  clearAll() {
    contextStore.setState({
      activeContext: [],
      browsingPath: [],
      summaries: []
    })
  },

  /**
   * 移除指定消息
   * @param {string} uuid - 消息UUID
   */
  removeFromContext(uuid) {
    contextStore.setState(state => ({
      activeContext: state.activeContext.filter(m => m.uuid !== uuid),
      browsingPath: [...state.browsingPath, {
        action: 'remove',
        uuid,
        timestamp: Date.now()
      }]
    }))
  },

  /**
   * 清理指定分支的消息（保留公共祖先）
   * @param {string} branchId - 要清理的分支ID
   * @param {number} [keepBeforeIndex] - 保留此索引之前的消息（公共祖先）
   */
  clearBranch(branchId, keepBeforeIndex = -1) {
    contextStore.setState(state => {
      const clearedMessages = state.activeContext.filter(m => {
        // 如果指定了保留索引，保留该索引之前的消息
        if (keepBeforeIndex >= 0 && m.index < keepBeforeIndex) {
          return false // 不清理（保留）
        }
        // 清理匹配分支ID的消息
        // 增强匹配：精确匹配 或 包含关系
        if (!m.branch) return false
        return m.branch === branchId || m.branch === branchId
      })

      return {
        activeContext: state.activeContext.filter(m => {
          if (keepBeforeIndex >= 0 && m.index < keepBeforeIndex) {
            return true // 保留公共祖先
          }
          if (!m.branch) return true // 保留无分支信息的消息
          return m.branch !== branchId
        }),
        browsingPath: [...state.browsingPath, {
          action: 'clear_branch',
          branchId,
          clearedCount: clearedMessages.length,
          timestamp: Date.now()
        }]
      }
    })
  },

  /**
   * 添加用户自定义内容（背景信息、总结等）
   * @param {Object} customContent
   * @param {string} customContent.content - 内容文本
   * @param {string} [customContent.label] - 标签（如"背景信息"、"用户总结"）
   * @param {number} [customContent.insertAfterIndex] - 插入位置（在哪条消息之后）
   */
  addCustomContent({ content, label = '用户补充', insertAfterIndex }) {
    const customMessage = {
      uuid: `custom_${Date.now()}`,
      index: insertAfterIndex ?? -1,
      sender: 'user_custom',
      content,
      label,
      branch: 'custom',
      timestamp: Date.now(),
      isCustom: true
    }

    contextStore.setState(state => {
      let newContext
      if (insertAfterIndex !== undefined) {
        // 在指定位置插入
        const insertIdx = state.activeContext.findIndex(m => m.index === insertAfterIndex)
        if (insertIdx >= 0) {
          newContext = [
            ...state.activeContext.slice(0, insertIdx + 1),
            customMessage,
            ...state.activeContext.slice(insertIdx + 1)
          ]
        } else {
          newContext = [...state.activeContext, customMessage]
        }
      } else {
        // 添加到末尾
        newContext = [...state.activeContext, customMessage]
      }

      return {
        activeContext: newContext,
        browsingPath: [...state.browsingPath, {
          action: 'add_custom',
          label,
          timestamp: Date.now()
        }]
      }
    })
  },

  /**
   * 获取API调用所需的上下文
   */
  getContextForAPI() {
    const state = contextStore.getState()
    return {
      messages: state.activeContext,
      browsingPath: state.browsingPath
    }
  }
}

// ============================================
// Chat Store - 对话状态
// ============================================

export const chatStore = createStore({
  /** @type {import('../types').ChatMessage[]} */
  messages: [],

  /** @type {boolean} */
  isLoading: false,

  /** @type {string | null} */
  error: null,

  /** @type {string} */
  streamingContent: ''
})

// Chat Store Actions
export const chatActions = {
  /**
   * 添加消息
   * @param {import('../types').ChatMessage} message
   */
  addMessage(message) {
    chatStore.setState(state => ({
      messages: [...state.messages, {
        ...message,
        id: message.id || `msg_${Date.now()}`,
        timestamp: message.timestamp || Date.now()
      }]
    }))
  },

  /**
   * 更新消息
   * @param {string} messageId
   * @param {Partial<import('../types').ChatMessage>} updates
   */
  updateMessage(messageId, updates) {
    chatStore.setState(state => ({
      messages: state.messages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    }))
  },

  /**
   * 设置加载状态
   * @param {boolean} loading
   */
  setLoading(loading) {
    chatStore.setState({ isLoading: loading, error: null })
  },

  /**
   * 设置错误
   * @param {string | null} error
   */
  setError(error) {
    chatStore.setState({ error, isLoading: false })
  },

  /**
   * 更新流式内容
   * @param {string} content
   */
  updateStreamingContent(content) {
    chatStore.setState({ streamingContent: content })
  },

  /**
   * 追加流式内容
   * @param {string} delta
   */
  appendStreamingContent(delta) {
    chatStore.setState(state => ({
      streamingContent: state.streamingContent + delta
    }))
  },

  /**
   * 清空流式内容
   */
  clearStreamingContent() {
    chatStore.setState({ streamingContent: '' })
  },

  /**
   * 清空对话
   */
  clearMessages() {
    chatStore.setState({ messages: [], error: null })
  }
}

// ============================================
// Panel Store - 面板状态
// ============================================

export const panelStore = createStore({
  /** @type {boolean} */
  isOpen: false,

  /** @type {boolean} */
  isMinimized: false,

  /** @type {boolean} */
  isPinned: false,

  /** @type {'chat' | 'manage'} */
  mode: 'chat',

  /** @type {{x: number, y: number}} */
  position: { x: 20, y: 20 },

  /** @type {{width: number, height: number}} */
  size: { width: 400, height: 600 }
})

// Panel Store Actions
export const panelActions = {
  open() {
    panelStore.setState({ isOpen: true, isMinimized: false })
  },

  close() {
    panelStore.setState({ isOpen: false })
  },

  toggle() {
    panelStore.setState(state => ({ isOpen: !state.isOpen }))
  },

  minimize() {
    panelStore.setState({ isMinimized: true })
  },

  restore() {
    panelStore.setState({ isMinimized: false })
  },

  toggleMinimize() {
    panelStore.setState(state => ({ isMinimized: !state.isMinimized }))
  },

  togglePin() {
    panelStore.setState(state => ({ isPinned: !state.isPinned }))
  },

  /**
   * 设置模式
   * @param {'chat' | 'manage'} mode
   */
  setMode(mode) {
    panelStore.setState({ mode })
  },

  /**
   * 更新位置
   * @param {{x: number, y: number}} position
   */
  setPosition(position) {
    panelStore.setState({ position })
  },

  /**
   * 更新尺寸
   * @param {{width: number, height: number}} size
   */
  setSize(size) {
    panelStore.setState({ size })
  }
}

// ============================================
// MCP Store - MCP服务器状态
// ============================================

export const mcpStore = createStore({
  /** @type {import('../types').MCPServer[]} */
  servers: [],

  /** @type {import('../types').MCPTool[]} */
  tools: [],

  /** @type {boolean} */
  isLoading: false
})

// MCP Store Actions
export const mcpActions = {
  /**
   * 设置服务器列表
   * @param {import('../types').MCPServer[]} servers
   */
  setServers(servers) {
    mcpStore.setState({ servers })
  },

  /**
   * 添加服务器
   * @param {import('../types').MCPServer} server
   */
  addServer(server) {
    mcpStore.setState(state => ({
      servers: [...state.servers, server]
    }))
  },

  /**
   * 更新服务器
   * @param {string} serverId
   * @param {Partial<import('../types').MCPServer>} updates
   */
  updateServer(serverId, updates) {
    mcpStore.setState(state => ({
      servers: state.servers.map(s =>
        s.id === serverId ? { ...s, ...updates } : s
      )
    }))
  },

  /**
   * 移除服务器
   * @param {string} serverId
   */
  removeServer(serverId) {
    mcpStore.setState(state => ({
      servers: state.servers.filter(s => s.id !== serverId)
    }))
  },

  /**
   * 设置工具列表
   * @param {import('../types').MCPTool[]} tools
   */
  setTools(tools) {
    mcpStore.setState({ tools })
  },

  /**
   * 设置加载状态
   * @param {boolean} loading
   */
  setLoading(loading) {
    mcpStore.setState({ isLoading: loading })
  }
}

// ============================================
// Settings Store - 设置状态
// ============================================

export const settingsStore = createStore({
  /** @type {import('../types').APIConfig | null} */
  apiConfig: null,

  /** @type {string} */
  theme: 'auto'
})

// Settings Store Actions
export const settingsActions = {
  /**
   * 设置API配置
   * @param {import('../types').APIConfig} config
   */
  setAPIConfig(config) {
    settingsStore.setState({ apiConfig: config })
  },

  /**
   * 设置主题
   * @param {string} theme
   */
  setTheme(theme) {
    settingsStore.setState({ theme })
  }
}

// 导出所有store
export default {
  context: { store: contextStore, actions: contextActions },
  chat: { store: chatStore, actions: chatActions },
  panel: { store: panelStore, actions: panelActions },
  mcp: { store: mcpStore, actions: mcpActions },
  settings: { store: settingsStore, actions: settingsActions }
}
