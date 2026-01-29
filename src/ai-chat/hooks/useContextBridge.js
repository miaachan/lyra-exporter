/**
 * useContextBridge - 上下文桥接 Hook
 *
 * 用于连接 ConversationTimeline 消息浏览和 AI Chat 上下文
 * 当用户浏览消息时，自动将消息添加到 AI 对话的上下文中
 */

import { useCallback, useRef } from 'react'
import { contextActions, chatStore } from '../store/index.js'

/**
 * 上下文桥接 Hook
 * @returns {Object} 桥接方法
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
   * @param {boolean} [options.clearPrevious] - 是否清理之前分支的消息 (如果不传，能够根据是否有对话历史自动判断)
   */
  const recordBranchSwitch = useCallback((fromBranch, toBranch, options = {}) => {
    // 检查是否有对话交互
    let shouldClear = options.clearPrevious;

    if (shouldClear === undefined) {
      // 如果未指定，自动检测：如果没有用户提问，则清理
      const hasInteraction = chatStore.getState().messages.some(m => m.role === 'user');
      shouldClear = !hasInteraction;
    }

    contextActions.recordBranchSwitch(fromBranch, toBranch, { ...options, clearPrevious: shouldClear })
    console.log('[ContextBridge] Branch switch recorded:', fromBranch, '->', toBranch, { ...options, clearPrevious: shouldClear })

    // 如果清理了旧分支（且store已支持去重），清除本地缓存以允许重新添加
    if (shouldClear) {
      console.log('[ContextBridge] Clearing local message cache');
      addedMessagesRef.current.clear();
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

export default useContextBridge
