/**
 * Lyra AI Chat - Float Panel Component
 * 浮窗面板主组件 - 嵌入式浮窗入口
 */

import React, { useCallback, useEffect } from 'react'
import { ChatPanel } from './ChatPanel/index.jsx'
import {
  IconButton,
  IconClose,
  IconMinimize,
  IconMaximize,
  IconPin
} from './Common/index.jsx'
import { usePanelStore, useDraggable, useResizable } from '../hooks/index.js'
import { useI18n } from '../../index.js'

/**
 * 浮窗头部组件
 */
function PanelHeader({
  isPinned,
  isMinimized,
  onClose,
  onMinimize,
  onRestore,
  onTogglePin,
  dragRef,
  onMouseDown,
  t
}) {
  return (
    <div
      ref={dragRef}
      className="lyra-float-panel__header"
      onMouseDown={onMouseDown}
    >
      <div className="lyra-float-panel__title">
        <span className="lyra-float-panel__icon">💬</span>
        <span className="lyra-float-panel__name">
          {t('aiChat.panel.title')}
        </span>
      </div>

      <div className="lyra-float-panel__controls">
        {/* 固定按钮 */}
        <IconButton
          icon={<IconPin size={14} filled={isPinned} />}
          onClick={onTogglePin}
          title={isPinned ? t('aiChat.panel.unpin') : t('aiChat.panel.pin')}
          size="sm"
        />

        {/* 最小化/恢复 */}
        <IconButton
          icon={isMinimized ? <IconMaximize size={14} /> : <IconMinimize size={14} />}
          onClick={isMinimized ? onRestore : onMinimize}
          title={isMinimized ? t('aiChat.panel.restore') : t('aiChat.panel.minimize')}
          size="sm"
        />

        {/* 关闭 */}
        <IconButton
          icon={<IconClose size={14} />}
          onClick={onClose}
          title={t('aiChat.panel.close')}
          size="sm"
        />
      </div>
    </div>
  )
}

/**
 * 调整大小手柄
 */
function ResizeHandle({ onMouseDown }) {
  return (
    <div
      className="lyra-float-panel__resize-handle"
      onMouseDown={onMouseDown}
    >
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

/**
 * 最小化状态的浮窗
 */
function MinimizedPanel({ onClick, t }) {
  return (
    <div className="lyra-float-panel lyra-float-panel--minimized" onClick={onClick}>
      <span className="lyra-float-panel__minimized-icon">💬</span>
      <span className="lyra-float-panel__minimized-label">{t('aiChat.panel.assistant')}</span>
    </div>
  )
}

/**
 * 浮窗面板主组件
 */
export function FloatPanel() {
  const { t } = useI18n()
  const panelState = usePanelStore()
  const {
    isOpen,
    isMinimized,
    isPinned,
    position,
    size,
    open,
    close,
    minimize,
    restore,
    toggleMinimize,
    togglePin,
    setPosition,
    setSize
  } = panelState

  // 拖拽hook
  const {
    dragRef,
    isDragging,
    position: dragPosition,
    handleMouseDown: handleDragStart
  } = useDraggable({
    initialPosition: position,
    onDragEnd: setPosition
  })

  // 调整大小hook
  const {
    isResizing,
    size: resizeSize,
    startResize
  } = useResizable({
    initialSize: size,
    minSize: { width: 320, height: 400 },
    onResizeEnd: setSize
  })

  // 使用拖拽/调整大小的实时位置和尺寸
  const currentPosition = isDragging ? dragPosition : position
  const currentSize = isResizing ? resizeSize : size

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape关闭面板（如果没有固定）
      if (e.key === 'Escape' && isOpen && !isPinned) {
        close()
      }
      // Ctrl/Cmd + Shift + L 切换面板
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'l') {
        e.preventDefault()
        if (isOpen) {
          close()
        } else {
          open()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isPinned, open, close])

  // 不显示
  if (!isOpen) {
    return null
  }

  // 最小化状态
  if (isMinimized) {
    return <MinimizedPanel onClick={restore} t={t} />
  }

  // 面板样式
  const panelStyle = {
    left: `${currentPosition.x}px`,
    top: `${currentPosition.y}px`,
    width: `${currentSize.width}px`,
    height: `${currentSize.height}px`
  }

  return (
    <div
      className={`lyra-float-panel ${isDragging ? 'lyra-float-panel--dragging' : ''} ${isResizing ? 'lyra-float-panel--resizing' : ''} ${isPinned ? 'lyra-float-panel--pinned' : ''}`}
      style={panelStyle}
    >
      {/* 头部 */}
      <PanelHeader
        isPinned={isPinned}
        isMinimized={isMinimized}
        onClose={close}
        onMinimize={minimize}
        onRestore={restore}
        onTogglePin={togglePin}
        dragRef={dragRef}
        onMouseDown={handleDragStart}
        t={t}
      />

      {/* 内容 - 只显示对话面板 */}
      <div className="lyra-float-panel__body">
        <ChatPanel />
      </div>

      {/* 调整大小手柄 */}
      <ResizeHandle onMouseDown={startResize} />
    </div>
  )
}

/**
 * 浮窗触发按钮 - 用于打开浮窗
 */
export function FloatPanelTrigger({ position = 'bottom-right' }) {
  const { t } = useI18n()
  const { isOpen, open, close, toggle } = usePanelStore()

  return (
    <button
      className={`lyra-float-trigger lyra-float-trigger--${position} ${isOpen ? 'lyra-float-trigger--active' : ''}`}
      onClick={toggle}
      title={isOpen ? t('aiChat.panel.close') : t('aiChat.panel.assistant')}
    >
      <span className="lyra-float-trigger__icon">
        {isOpen ? '✕' : '💬'}
      </span>
    </button>
  )
}

export default FloatPanel
