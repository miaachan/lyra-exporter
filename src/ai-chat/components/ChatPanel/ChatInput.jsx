/**
 * Lyra AI Chat - Chat Input Component
 * 聊天输入组件
 */

import React, { useState, useCallback } from 'react'
import { Textarea, IconButton, IconSend, IconLoading } from '../Common/index.jsx'
import { useAutoResize } from '../../hooks/index.js'

/**
 * 聊天输入组件
 */
export function ChatInput({
  onSend,
  onCancel,
  disabled = false,
  isLoading = false,
  placeholder = '输入消息...'
}) {
  const [text, setText] = useState('')
  const { textareaRef, resize } = useAutoResize(150)

  const handleChange = useCallback((value) => {
    setText(value)
    resize()
  }, [resize])

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || disabled || isLoading) return

    onSend(trimmed)
    setText('')

    // 重置高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, disabled, isLoading, onSend, textareaRef])

  const handleKeyDown = useCallback((e) => {
    // Enter发送，Shift+Enter换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    // Escape取消
    if (e.key === 'Escape' && isLoading) {
      onCancel?.()
    }
  }, [handleSend, isLoading, onCancel])

  return (
    <div className="lyra-chat-input">
      <div className="lyra-chat-input__wrapper">
        <Textarea
          textareaRef={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="lyra-chat-input__textarea"
        />
        <div className="lyra-chat-input__actions">
          {isLoading ? (
            <IconButton
              icon={<IconLoading size={18} />}
              onClick={onCancel}
              title="取消"
              variant="ghost"
            />
          ) : (
            <IconButton
              icon={<IconSend size={18} />}
              onClick={handleSend}
              disabled={!text.trim() || disabled}
              title="发送 (Enter)"
              variant="primary"
            />
          )}
        </div>
      </div>
      <div className="lyra-chat-input__hint">
        <span>Enter 发送 · Shift+Enter 换行</span>
      </div>
    </div>
  )
}

export default ChatInput
