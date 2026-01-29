/**
 * Lyra AI Chat - Manage Panel Component
 * 管理面板主组件
 */

import React, { useState } from 'react'
import { MCPServerList } from './MCPServerList.jsx'
import { APISettings } from './APISettings.jsx'
import { Tabs, IconSettings, IconChat, Divider } from '../Common/index.jsx'

/**
 * 管理面板标签页配置
 */
const MANAGE_TABS = [
  {
    key: 'mcp',
    label: 'MCP服务器',
    icon: '🔌'
  },
  {
    key: 'api',
    label: 'API设置',
    icon: <IconSettings size={14} />
  },
  {
    key: 'about',
    label: '关于',
    icon: 'ℹ️'
  }
]

/**
 * 关于页面
 */
function AboutSection() {
  return (
    <div className="lyra-about-section">
      <div className="lyra-about-section__header">
        <h3>Lyra AI Chat</h3>
        <span className="lyra-about-section__version">v1.0.0</span>
      </div>

      <p className="lyra-about-section__description">
        嵌入式AI对话助手，帮助你在浏览对话历史时获得整理建议。
      </p>

      <Divider />

      <div className="lyra-about-section__features">
        <h4>主要功能</h4>
        <ul>
          <li>与AI进行上下文相关的对话</li>
          <li>基于浏览轨迹的智能上下文管理</li>
        </ul>
      </div>

      <div className="lyra-about-section__mcp-info">
        <h4>MCP集成说明</h4>
        <p>
          本工具支持Model Context Protocol (MCP)，可以连接各种MCP服务器扩展AI能力。
        </p>
        <ul>
          <li><strong>内置MCP</strong>: 预配置的对话上下文服务</li>
          <li><strong>自定义MCP</strong>: 支持添加任意MCP服务器</li>
        </ul>
      </div>

      <div className="lyra-about-section__links">
        <h4>相关链接</h4>
        <ul>
          <li>
            <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener">
              MCP官方文档
            </a>
          </li>
          <li>
            <a href="https://docs.anthropic.com" target="_blank" rel="noopener">
              Anthropic API文档
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}

/**
 * 管理面板组件
 */
export function ManagePanel({ onSwitchToChat }) {
  const [activeTab, setActiveTab] = useState('mcp')

  return (
    <div className="lyra-manage-panel">
      {/* 标签页导航 */}
      <div className="lyra-manage-panel__tabs">
        <Tabs
          tabs={MANAGE_TABS}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* 内容区域 */}
      <div className="lyra-manage-panel__content">
        {activeTab === 'mcp' && <MCPServerList />}
        {activeTab === 'api' && <APISettings />}
        {activeTab === 'about' && <AboutSection />}
      </div>

      {/* 底部操作 */}
      <div className="lyra-manage-panel__footer">
        <button
          className="lyra-button lyra-button--ghost"
          onClick={onSwitchToChat}
        >
          <IconChat size={14} /> 返回对话
        </button>
      </div>
    </div>
  )
}

export default ManagePanel
