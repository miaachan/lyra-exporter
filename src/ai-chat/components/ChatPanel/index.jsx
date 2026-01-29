/**
 * Lyra AI Chat - Chat Panel Component
 * 对话面板主组件
 */

import React, { useState, useCallback } from 'react'
import { MessageList } from './MessageList.jsx'
import { ChatInput } from './ChatInput.jsx'
import { ContextStatus, ContextDetail } from './ContextStatus.jsx'
import { IconButton, IconTrash, IconRefresh, Divider } from '../Common/index.jsx'
import { useChatService, useContextStore } from '../../hooks/index.js'

/**
 * 对话面板组件
 */
export function ChatPanel() {
  const [showContextDetail, setShowContextDetail] = useState(false)

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    cancel,
    clear,
    isConfigured
  } = useChatService()

  const contextStore = useContextStore()

  const handleSend = useCallback((text) => {
    sendMessage(text)
  }, [sendMessage])

  const handleClear = useCallback(() => {
    clear()
  }, [clear])

  const handleRefreshContext = useCallback(() => {
    // TODO: 从浏览面板刷新上下文
    console.log('Refresh context from browsing panel')
  }, [])

  // 未配置API Key时的提示
  if (!isConfigured) {
    return (
      <div className="lyra-chat-panel lyra-chat-panel--unconfigured">
        <div className="lyra-chat-panel__notice">
          <span className="lyra-chat-panel__notice-icon">⚙️</span>
          <h4>需要配置API</h4>
          <p>请打开主设置面板（点击右上角⚙️图标）配置AI Chat API密钥</p>
          <p style={{ fontSize: '0.85em', marginTop: '0.5em', opacity: 0.7 }}>
            设置 → AI设置 → AI Chat API配置
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="lyra-chat-panel">
      {/* 上下文状态栏 */}
      <div className="lyra-chat-panel__context">
        <ContextStatus
          onClear={() => contextStore.clearAll()}
          onRefresh={handleRefreshContext}
        />
        <IconButton
          icon={showContextDetail ? '▲' : '▼'}
          onClick={() => setShowContextDetail(!showContextDetail)}
          title={showContextDetail ? '收起详情' : '展开详情'}
          size="sm"
        />
      </div>

      {/* 上下文详情 */}
      <ContextDetail
        isOpen={showContextDetail}
        onClose={() => setShowContextDetail(false)}
      />

      <Divider />

      {/* 工具栏 */}
      <div className="lyra-chat-panel__toolbar">
        <IconButton
          icon={<IconTrash size={16} />}
          onClick={handleClear}
          title="清空对话"
          disabled={messages.length === 0}
          size="sm"
        />
        {error && (
          <span className="lyra-chat-panel__error" title={error}>
            ⚠️ {error.length > 20 ? error.substring(0, 20) + '...' : error}
          </span>
        )}
      </div>

      {/* 消息列表 */}
      <div className="lyra-chat-panel__messages">
        <MessageList
          messages={messages}
          isLoading={isLoading}
        />
      </div>

      {/* 输入区域 */}
      <div className="lyra-chat-panel__input">
        <ChatInput
          onSend={handleSend}
          onCancel={cancel}
          isLoading={isLoading}
          placeholder={
            contextStore.activeContext.length > 0
              ? '询问关于浏览中对话的问题...'
              : '开始对话...'
          }
        />
      </div>
    </div>
  )
}

export default ChatPanel
