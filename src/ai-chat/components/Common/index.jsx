/**
 * Lyra AI Chat - Common Components
 * 通用UI组件
 */

import React from 'react'

// ============================================
// 图标组件 (使用SVG inline)
// ============================================

export function IconClose({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function IconMinimize({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function IconMaximize({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  )
}

export function IconPin({ size = 16, className = '', filled = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  )
}

export function IconSend({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

export function IconSettings({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function IconChat({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function IconPlus({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function IconTrash({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export function IconRefresh({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

export function IconCheck({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function IconLoading({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lyra-icon-spin ${className}`}
    >
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  )
}

// ============================================
// 基础UI组件
// ============================================

/**
 * 按钮组件
 */
export function Button({
  children,
  variant = 'default',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  title,
  ...props
}) {
  const baseClass = 'lyra-button'
  const variantClass = `lyra-button--${variant}`
  const sizeClass = `lyra-button--${size}`
  const stateClass = disabled || loading ? 'lyra-button--disabled' : ''

  return (
    <button
      className={`${baseClass} ${variantClass} ${sizeClass} ${stateClass} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      {...props}
    >
      {loading && <IconLoading size={14} className="lyra-button__loading" />}
      {children}
    </button>
  )
}

/**
 * 图标按钮
 */
export function IconButton({
  icon,
  size = 'md',
  variant = 'ghost',
  onClick,
  disabled = false,
  title,
  className = '',
  ...props
}) {
  return (
    <button
      className={`lyra-icon-button lyra-icon-button--${size} lyra-icon-button--${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      {...props}
    >
      {icon}
    </button>
  )
}

/**
 * 输入框组件
 */
export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`lyra-input ${className}`}
      {...props}
    />
  )
}

/**
 * 文本域组件
 */
export function Textarea({
  value,
  onChange,
  placeholder,
  disabled = false,
  rows = 3,
  className = '',
  textareaRef,
  onKeyDown,
  ...props
}) {
  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className={`lyra-textarea ${className}`}
      {...props}
    />
  )
}

/**
 * 开关组件
 */
export function Switch({ checked, onChange, disabled = false, className = '' }) {
  return (
    <label className={`lyra-switch ${checked ? 'lyra-switch--checked' : ''} ${disabled ? 'lyra-switch--disabled' : ''} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange?.(e.target.checked)}
        disabled={disabled}
      />
      <span className="lyra-switch__slider" />
    </label>
  )
}

/**
 * 标签页组件
 */
export function Tabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`lyra-tabs ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`lyra-tabs__tab ${activeTab === tab.key ? 'lyra-tabs__tab--active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.icon && <span className="lyra-tabs__icon">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/**
 * 空状态组件
 */
export function Empty({ title, description, action, className = '' }) {
  return (
    <div className={`lyra-empty ${className}`}>
      <div className="lyra-empty__icon">
        <IconChat size={48} />
      </div>
      {title && <h3 className="lyra-empty__title">{title}</h3>}
      {description && <p className="lyra-empty__description">{description}</p>}
      {action && <div className="lyra-empty__action">{action}</div>}
    </div>
  )
}

/**
 * 加载状态组件
 */
export function Loading({ text = '加载中...', className = '' }) {
  return (
    <div className={`lyra-loading ${className}`}>
      <IconLoading size={24} />
      {text && <span className="lyra-loading__text">{text}</span>}
    </div>
  )
}

/**
 * 徽章组件
 */
export function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span className={`lyra-badge lyra-badge--${variant} ${className}`}>
      {children}
    </span>
  )
}

/**
 * 分割线
 */
export function Divider({ className = '' }) {
  return <div className={`lyra-divider ${className}`} />
}

export default {
  IconClose,
  IconMinimize,
  IconMaximize,
  IconPin,
  IconSend,
  IconSettings,
  IconChat,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconCheck,
  IconLoading,
  Button,
  IconButton,
  Input,
  Textarea,
  Switch,
  Tabs,
  Empty,
  Loading,
  Badge,
  Divider
}
