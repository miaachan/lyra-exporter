/**
 * Lyra AI Chat - React Hooks
 * 自定义React Hooks
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  contextStore, contextActions,
  chatStore, chatActions,
  panelStore, panelActions,
  mcpStore, mcpActions,
  settingsStore, settingsActions
} from '../store/index.js'
import { chatService } from '../services/ChatService.js'
import { mcpService } from '../services/MCPService.js'

// 导出 useContextBridge
export { useContextBridge } from './useContextBridge.js'

// ============================================
// Store Hooks
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

/**
 * 使用设置状态
 */
export function useSettingsStore() {
  const state = useStore(settingsStore)
  return {
    ...state,
    ...settingsActions
  }
}

// ============================================
// Business Logic Hooks
// ============================================

/**
 * 聊天服务hook
 */
export function useChatService() {
  const chatState = useChatStore()
  const contextState = useContextStore()
  const settingsState = useSettingsStore()

  // 配置服务
  useEffect(() => {
    if (settingsState.apiConfig) {
      chatService.configure(settingsState.apiConfig)
    }
  }, [settingsState.apiConfig])

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

  return {
    messages: chatState.messages,
    isLoading: chatState.isLoading,
    error: chatState.error,
    sendMessage,
    cancel,
    clear,
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

// ============================================
// UI Utility Hooks
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
  useSettingsStore,
  useChatService,
  useMCPService,
  useDraggable,
  useResizable,
  useAutoResize
}
