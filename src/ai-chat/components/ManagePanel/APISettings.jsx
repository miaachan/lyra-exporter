/**
 * Lyra AI Chat - API Settings Component
 * API设置组件
 */

import React, { useState, useCallback, useEffect } from 'react'
import { Button, Input, Badge, IconCheck } from '../Common/index.jsx'
import { useSettingsStore } from '../../hooks/index.js'
import { chatService } from '../../services/ChatService.js'

/**
 * 模型选项
 */
const PROTOCOL_OPTIONS = [
  { id: 'anthropic', name: 'Anthropic (Claude)' },
  { id: 'openai', name: 'OpenAI (Compatible)' }
]

const ANTHROPIC_MODELS = [
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: '平衡性能与速度' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: '快速响应' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: '最强性能' }
]

const OPENAI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', description: '最新旗舰模型' },
  { id: 'gpt-4o-mini', name: 'GPT-4o-mini', description: '高效轻量模型' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '高性价比选择' },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: '强化推理模型' }
]

/**
 * API设置组件
 */
export function APISettings() {
  const { apiConfig, setAPIConfig } = useSettingsStore()

  const [protocol, setProtocol] = useState(apiConfig?.protocol || 'anthropic')
  const [apiKey, setApiKey] = useState(apiConfig?.apiKey || '')
  const [baseUrl, setBaseUrl] = useState(apiConfig?.baseUrl || 'https://api.anthropic.com')
  const [model, setModel] = useState(apiConfig?.model || 'claude-3-5-sonnet-20241022')
  const [maxTokens, setMaxTokens] = useState(apiConfig?.maxTokens || 4096)

  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState('')

  // 协议切换时更新默认值
  const handleProtocolChange = (newProtocol) => {
    setProtocol(newProtocol)
    if (newProtocol === 'openai') {
      setBaseUrl('https://api.openai.com/v1')
      setModel('gpt-4o')
    } else {
      setBaseUrl('https://api.anthropic.com')
      setModel('claude-3-5-sonnet-20241022')
    }
  }

  // 同步配置
  useEffect(() => {
    if (apiConfig) {
      setProtocol(apiConfig.protocol || 'anthropic')
      setApiKey(apiConfig.apiKey || '')
      setBaseUrl(apiConfig.baseUrl || (apiConfig.protocol === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com'))
      setModel(apiConfig.model || (apiConfig.protocol === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022'))
      setMaxTokens(apiConfig.maxTokens || 4096)
    }
  }, [apiConfig])

  const handleSave = useCallback(() => {
    if (!apiKey.trim()) {
      setError('请输入API密钥')
      return
    }

    const config = {
      protocol,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || (protocol === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com'),
      model,
      maxTokens: parseInt(maxTokens, 10) || 4096
    }

    // 保存到store
    setAPIConfig(config)

    // 配置chatService
    chatService.configure(config)

    setError('')
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }, [protocol, apiKey, baseUrl, model, maxTokens, setAPIConfig])

  const isConfigured = chatService.isConfigured()
  const currentModels = protocol === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS

  return (
    <div className="lyra-api-settings">
      <div className="lyra-api-settings__header">
        <h4>API 配置</h4>
        {isConfigured && (
          <Badge variant="success">
            <IconCheck size={12} /> 已配置
          </Badge>
        )}
      </div>

      <div className="lyra-form-group">
        <label>通信协议</label>
        <select
          className="lyra-select"
          value={protocol}
          onChange={(e) => handleProtocolChange(e.target.value)}
        >
          {PROTOCOL_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
      </div>

      <div className="lyra-form-group">
        <label>API 密钥 *</label>
        <Input
          type="password"
          value={apiKey}
          onChange={setApiKey}
          placeholder={protocol === 'openai' ? 'sk-...' : 'sk-ant-...'}
        />
        <span className="lyra-form-hint">
          {protocol === 'openai' ? 'OpenAI 或兼容服务的 API Key' : '从 Anthropic Console 获取 API 密钥'}
        </span>
      </div>

      <div className="lyra-form-group">
        <label>API 基础URL</label>
        <Input
          value={baseUrl}
          onChange={setBaseUrl}
          placeholder={protocol === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com'}
        />
        <span className="lyra-form-hint">
          默认为官方接口，支持 OneAPI / NewAPI / DeepSeek 等中转
        </span>
      </div>

      <div className="lyra-form-group">
        <label>模型</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Input
            value={model}
            onChange={setModel}
            placeholder={protocol === 'openai' ? "例如: gpt-4o" : "例如: claude-3-5-sonnet-20241022"}
            style={{ flex: 1 }}
          />
          <select
            className="lyra-select"
            style={{ width: 'auto', maxWidth: '140px' }}
            onChange={(e) => e.target.value && setModel(e.target.value)}
            value=""
          >
            <option value="" disabled>选择...</option>
            {currentModels.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>
        <span className="lyra-form-hint">
          手动输入模型名称或从列表快速选择
        </span>
      </div>

      <div className="lyra-form-group">
        <label>最大Token数</label>
        <Input
          type="number"
          value={maxTokens}
          onChange={(v) => setMaxTokens(parseInt(v, 10) || 4096)}
          min={1}
          max={200000}
        />
      </div>

      {error && (
        <div className="lyra-api-settings__error">
          ⚠️ {error}
        </div>
      )}

      <div className="lyra-form-actions">
        <Button
          variant="primary"
          onClick={handleSave}
        >
          {isSaved ? '✓ 已保存' : '保存配置'}
        </Button>
      </div>

      <div className="lyra-api-settings__note">
        <h5>注意事项</h5>
        <ul>
          <li>API密钥仅保存在本地，不会上传到任何服务器</li>
          <li>请确保有足够的API额度</li>
          <li>建议使用代理以获得更稳定的连接</li>
        </ul>
      </div>
    </div>
  )
}

export default APISettings
