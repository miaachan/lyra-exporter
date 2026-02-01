/**
 * Lyra AI Chat - React Hooks
 * 自定义React Hooks：状态订阅 + 业务逻辑 + UI工具
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  contextStore, contextActions,
  chatStore, chatActions,
  panelStore, panelActions,
  mcpStore, mcpActions
} from './store.js'
import { chatService, mcpService } from './services.js'

// ============================================
// Store Hooks - 状态订阅
// ============================================

/**
 * 通用的store订阅hook
 * @template T
 * @param {Object} store
 * @param {(state: T) => any} [selector]
 * @returns {T}
 */
function useStore(store, selector) {
  const [state, setState] = useState(() => {
    const fullState = store.getState()
    return selector ? selector(fullState) : fullState
  })

  useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      const selectedState = selector ? selector(newState) : newState
      setState(selectedState)
    })
    return unsubscribe
  }, [store, selector])

  return state
}

/**
 * 使用上下文状态
 */
export function useContextStore() {
  const state = useStore(contextStore)
  return {
    ...state,
    ...contextActions
  }
}

/**
 * 使用聊天状态
 */
export function useChatStore() {
  const state = useStore(chatStore)
  return {
    ...state,
    ...chatActions
  }
}

/**
 * 使用面板状态
 */
export function usePanelStore() {
  const state = useStore(panelStore)
  return {
    ...state,
    ...panelActions
  }
}

/**
 * 使用MCP状态
 */
export function useMCPStore() {
  const state = useStore(mcpStore)
  return {
    ...state,
    ...mcpActions
  }
}

// ============================================
// Business Logic Hooks - 业务逻辑
// ============================================

/**
 * 聊天服务hook
 */
export function useChatService() {
  const chatState = useChatStore()

  /**
   * 发送消息
   */
  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return

    // 添加用户消息
    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      status: 'complete'
    }
    chatActions.addMessage(userMessage)

    // 创建助手消息占位
    const assistantMessageId = `assistant_${Date.now()}`
    chatActions.addMessage({
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming'
    })

    chatActions.setLoading(true)
    chatActions.clearStreamingContent()

    try {
      const context = contextActions.getContextForAPI()
      const history = chatState.messages.filter(m => m.status === 'complete')

      let fullContent = ''

      await chatService.sendMessage(
        text,
        context,
        history,
        {
          onChunk: (chunk) => {
            fullContent += chunk
            chatActions.updateMessage(assistantMessageId, {
              content: fullContent
            })
          },
          onError: (error) => {
            chatActions.setError(error.message)
          }
        }
      )

      // 完成
      chatActions.updateMessage(assistantMessageId, {
        status: 'complete'
      })
    } catch (error) {
      chatActions.updateMessage(assistantMessageId, {
        status: 'error',
        content: `错误: ${error.message}`
      })
      chatActions.setError(error.message)
    } finally {
      chatActions.setLoading(false)
    }
  }, [chatState.messages])

  /**
   * 取消请求
   */
  const cancel = useCallback(() => {
    chatService.cancel()
    chatActions.setLoading(false)
  }, [])

  /**
   * 清空对话
   */
  const clear = useCallback(() => {
    chatActions.clearMessages()
  }, [])

  /**
   * 重试消息（重新发送最后一条用户消息）
   */
  const retry = useCallback(async (userMessageId) => {
    // 找到要重试的用户消息
    const userMessage = chatState.messages.find(m => m.id === userMessageId)
    if (!userMessage || userMessage.role !== 'user') return

    // 删除该消息之后的所有消息
    chatActions.deleteFromMessage(userMessageId)

    // 重新发送
    await sendMessage(userMessage.content)
  }, [chatState.messages, sendMessage])

  /**
   * 编辑消息
   */
  const editMessage = useCallback((messageId, newContent) => {
    chatActions.editMessage(messageId, newContent)
  }, [])

  /**
   * 删除消息
   */
  const deleteMessage = useCallback((messageId) => {
    chatActions.deleteMessage(messageId)
  }, [])

  return {
    messages: chatState.messages,
    isLoading: chatState.isLoading,
    error: chatState.error,
    sendMessage,
    cancel,
    clear,
    retry,
    editMessage,
    deleteMessage,
    isConfigured: chatService.isConfigured()
  }
}

/**
 * MCP服务hook
 */
export function useMCPService() {
  const mcpState = useMCPStore()

  /**
   * 刷新服务器列表
   */
  const refreshServers = useCallback(() => {
    const servers = mcpService.getServers()
    mcpActions.setServers(servers)
  }, [])

  /**
   * 刷新工具列表
   */
  const refreshTools = useCallback(async () => {
    mcpActions.setLoading(true)
    try {
      const tools = await mcpService.listAllActiveTools()
      mcpActions.setTools(tools)
    } catch (error) {
      console.error('Failed to refresh tools:', error)
    } finally {
      mcpActions.setLoading(false)
    }
  }, [])

  /**
   * 添加自定义服务器
   */
  const addServer = useCallback(async (config) => {
    const serverId = mcpService.addCustomServer(config)
    refreshServers()
    return serverId
  }, [refreshServers])

  /**
   * 移除服务器
   */
  const removeServer = useCallback(async (serverId) => {
    mcpService.removeServer(serverId)
    refreshServers()
    await refreshTools()
  }, [refreshServers, refreshTools])

  /**
   * 切换服务器激活状态
   */
  const toggleServer = useCallback(async (serverId, active) => {
    await mcpService.setServerActive(serverId, active)
    refreshServers()
    await refreshTools()
  }, [refreshServers, refreshTools])

  /**
   * 调用工具
   */
  const callTool = useCallback(async (toolId, args) => {
    return mcpService.callToolById(toolId, args)
  }, [])

  // 初始化时刷新
  useEffect(() => {
    refreshServers()
    refreshTools()
  }, [refreshServers, refreshTools])

  return {
    servers: mcpState.servers,
    tools: mcpState.tools,
    isLoading: mcpState.isLoading,
    addServer,
    removeServer,
    toggleServer,
    callTool,
    refreshServers,
    refreshTools
  }
}

/**
 * useContextBridge - 上下文桥接 Hook
 *
 * 用于连接 ConversationTimeline 消息浏览和 AI Chat 上下文
 * 当用户浏览消息时，自动将消息添加到 AI 对话的上下文中
 */
export function useContextBridge() {
  // 记录已添加的消息，避免重复添加
  const addedMessagesRef = useRef(new Set())

  // 当前文件信息
  const currentFileRef = useRef(null)

  /**
   * 初始化/重置上下文（当加载新文件时调用）
   * @param {Object} fileInfo - 文件信息
   * @param {string} fileInfo.uuid - 文件 UUID
   * @param {string} fileInfo.name - 文件名
   */
  const initContext = useCallback((fileInfo) => {
    currentFileRef.current = fileInfo
    addedMessagesRef.current = new Set()
    contextActions.clearAll()
    console.log('[ContextBridge] Context initialized for file:', fileInfo?.name)
  }, [])

  /**
   * 添加消息到上下文（用户浏览消息时调用）
   * @param {Object} message - 消息对象
   * @param {number} message.index - 消息索引
   * @param {string} [message.uuid] - 消息 UUID
   * @param {string} message.sender - 发送者 ('human' | 'assistant')
   * @param {string} message.text - 消息内容
   * @param {string} [branchId] - 分支 ID
   */
  const addMessageToContext = useCallback((message, branchId = 'main') => {
    if (!message) return

    const messageKey = message.uuid || `msg_${message.index}`

    // 检查是否已添加
    if (addedMessagesRef.current.has(messageKey)) {
      return
    }

    // 标记为已添加
    addedMessagesRef.current.add(messageKey)

    // 添加到上下文 store
    contextActions.addToContext({
      index: message.index,
      uuid: messageKey,
      sender: message.sender,
      content: message.text || message.content || '',
      branch: branchId,
      timestamp: Date.now()
    })

    console.log('[ContextBridge] Message added to context:', messageKey)
  }, [])

  /**
   * 批量添加消息到上下文
   * @param {Array<Object>} messages - 消息数组
   * @param {string} [branchId] - 分支 ID
   */
  const addMessagesToContext = useCallback((messages, branchId = 'main') => {
    if (!Array.isArray(messages)) return

    messages.forEach(message => {
      addMessageToContext(message, branchId)
    })
  }, [addMessageToContext])

  /**
   * 记录分支切换事件
   * @param {string} fromBranch - 原分支
   * @param {string} toBranch - 目标分支
   * @param {Object} [options] - 选项
   * @param {boolean} [options.clearPrevious] - 是否清理之前分支的消息
   */
  const recordBranchSwitch = useCallback((fromBranch, toBranch, options = {}) => {
    // 检查是否有对话交互
    let shouldClear = options.clearPrevious

    if (shouldClear === undefined) {
      // 如果未指定，自动检测：如果没有用户提问，则清理
      const hasInteraction = chatStore.getState().messages.some(m => m.role === 'user')
      shouldClear = !hasInteraction
    }

    contextActions.recordBranchSwitch(fromBranch, toBranch, { ...options, clearPrevious: shouldClear })
    console.log('[ContextBridge] Branch switch recorded:', fromBranch, '->', toBranch, { ...options, clearPrevious: shouldClear })

    // 如果清理了旧分支，清除本地缓存以允许重新添加
    if (shouldClear) {
      console.log('[ContextBridge] Clearing local message cache')
      addedMessagesRef.current.clear()
    }
  }, [])

  /**
   * 清理指定范围的上下文
   * @param {number} fromIndex - 起始索引
   * @param {number} toIndex - 结束索引
   */
  const clearContextRange = useCallback((fromIndex, toIndex) => {
    contextActions.clearRange(fromIndex, toIndex)

    // 同步更新已添加记录
    addedMessagesRef.current.forEach(key => {
      const index = parseInt(key.split('_')[1])
      if (!isNaN(index) && index >= fromIndex && index <= toIndex) {
        addedMessagesRef.current.delete(key)
      }
    })

    console.log('[ContextBridge] Context range cleared:', fromIndex, '-', toIndex)
  }, [])

  /**
   * 清理全部上下文
   */
  const clearAllContext = useCallback(() => {
    contextActions.clearAll()
    addedMessagesRef.current = new Set()
    console.log('[ContextBridge] All context cleared')
  }, [])

  /**
   * 从上下文中移除指定消息
   * @param {string} messageUuid - 消息 UUID
   */
  const removeFromContext = useCallback((messageUuid) => {
    contextActions.removeFromContext(messageUuid)
    addedMessagesRef.current.delete(messageUuid)
    console.log('[ContextBridge] Message removed from context:', messageUuid)
  }, [])

  /**
   * 获取当前上下文状态
   * @returns {Object} 上下文状态
   */
  const getContextState = useCallback(() => {
    return {
      addedCount: addedMessagesRef.current.size,
      currentFile: currentFileRef.current
    }
  }, [])

  return {
    // 初始化
    initContext,

    // 添加上下文
    addMessageToContext,
    addMessagesToContext,

    // 分支追踪
    recordBranchSwitch,

    // 清理上下文
    clearContextRange,
    clearAllContext,
    removeFromContext,

    // 状态查询
    getContextState
  }
}

// ============================================
// UI Utility Hooks - UI工具
// ============================================

/**
 * 拖拽hook
 * @param {Object} options
 * @param {(position: {x: number, y: number}) => void} options.onDragEnd
 * @param {{x: number, y: number}} options.initialPosition
 */
export function useDraggable(options = {}) {
  const { onDragEnd, initialPosition = { x: 0, y: 0 } } = options
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState(initialPosition)
  const dragRef = useRef(null)
  const startPosRef = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e) => {
    if (e.target !== dragRef.current) return
    setIsDragging(true)
    startPosRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
  }, [position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e) => {
      const newPos = {
        x: e.clientX - startPosRef.current.x,
        y: e.clientY - startPosRef.current.y
      }
      setPosition(newPos)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      onDragEnd?.(position)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, position, onDragEnd])

  return {
    dragRef,
    isDragging,
    position,
    handleMouseDown
  }
}

/**
 * 调整大小hook
 * @param {Object} options
 * @param {{width: number, height: number}} options.initialSize
 * @param {{width: number, height: number}} options.minSize
 * @param {(size: {width: number, height: number}) => void} options.onResizeEnd
 */
export function useResizable(options = {}) {
  const {
    initialSize = { width: 400, height: 600 },
    minSize = { width: 300, height: 400 },
    onResizeEnd
  } = options

  const [isResizing, setIsResizing] = useState(false)
  const [size, setSize] = useState(initialSize)
  const startSizeRef = useRef({ width: 0, height: 0 })
  const startPosRef = useRef({ x: 0, y: 0 })

  const startResize = useCallback((e) => {
    e.preventDefault()
    setIsResizing(true)
    startSizeRef.current = { ...size }
    startPosRef.current = { x: e.clientX, y: e.clientY }
  }, [size])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startPosRef.current.x
      const deltaY = e.clientY - startPosRef.current.y

      setSize({
        width: Math.max(minSize.width, startSizeRef.current.width + deltaX),
        height: Math.max(minSize.height, startSizeRef.current.height + deltaY)
      })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      onResizeEnd?.(size)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, size, minSize, onResizeEnd])

  return {
    isResizing,
    size,
    startResize
  }
}

/**
 * 自动调整文本框高度
 * @param {number} maxHeight
 */
export function useAutoResize(maxHeight = 200) {
  const textareaRef = useRef(null)

  const resize = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`
  }, [maxHeight])

  return { textareaRef, resize }
}

export default {
  useContextStore,
  useChatStore,
  usePanelStore,
  useMCPStore,
  useChatService,
  useMCPService,
  useContextBridge,
  useDraggable,
  useResizable,
  useAutoResize
}
