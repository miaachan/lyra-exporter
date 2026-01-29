/**
 * Lyra AI Chat - Message List Component
 * 消息列表组件
 */

import React, { useEffect, useRef } from 'react'
import { IconLoading } from '../Common/index.jsx'

/**
 * 单条消息组件
 */
function Message({ message }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isStreaming = message.status === 'streaming'
  const isError = message.status === 'error'

  return (
    <div
      className={`lyra-message lyra-message--${message.role} ${isError ? 'lyra-message--error' : ''}`}
    >
      <div className="lyra-message__avatar">
        {isUser ? '👤' : isSystem ? '⚙️' : '🤖'}
      </div>
      <div className="lyra-message__content">
        <div className="lyra-message__text">
          {message.content || (isStreaming && '...')}
          {isStreaming && (
            <span className="lyra-message__cursor">▋</span>
          )}
        </div>
        {message.toolCalls?.length > 0 && (
          <div className="lyra-message__tools">
            {message.toolCalls.map(tool => (
              <div key={tool.id} className={`lyra-tool-call lyra-tool-call--${tool.status}`}>
                <span className="lyra-tool-call__name">🔧 {tool.toolName}</span>
                {tool.status === 'running' && <IconLoading size={12} />}
                {tool.status === 'success' && <span className="lyra-tool-call__status">✓</span>}
                {tool.status === 'error' && <span className="lyra-tool-call__status">✗</span>}
              </div>
            ))}
          </div>
        )}
        <div className="lyra-message__time">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}

/**
 * 消息列表组件
 */
export function MessageList({ messages = [], isLoading = false }) {
  const listRef = useRef(null)
  const bottomRef = useRef(null)

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="lyra-message-list lyra-message-list--empty">
        <div className="lyra-message-list__placeholder">
          <span className="lyra-message-list__placeholder-icon">💬</span>
          <p>开始与AI助手对话</p>
          <p className="lyra-message-list__placeholder-hint">
            询问关于浏览中对话的问题，或请求帮助整理内容
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="lyra-message-list" ref={listRef}>
      {messages.map(message => (
        <Message key={message.id} message={message} />
      ))}
      {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
        <div className="lyra-message lyra-message--assistant lyra-message--loading">
          <div className="lyra-message__avatar">🤖</div>
          <div className="lyra-message__content">
            <div className="lyra-message__typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

export default MessageList
