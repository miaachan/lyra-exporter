/**
 * Lyra AI Chat - Chat Service
 * AI对话服务 - 处理与Claude API的通信
 */

import { mcpService } from './MCPService.js'

// localStorage 键名
const STORAGE_KEY = 'lyra-ai-chat-config'

// 默认配置
const DEFAULT_CONFIG = {
  protocol: 'anthropic',
  apiKey: '',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-3-5-sonnet-20240620',
  maxTokens: 4096
}

/**
 * AI对话服务
 */
class ChatServiceManager {
  constructor() {
    /** @type {import('../types').APIConfig | null} */
    this.config = null

    /** @type {AbortController | null} */
    this.abortController = null

    // 初始化配置：优先从 localStorage 加载，否则从环境变量加载
    this.initConfig()
  }

  /**
   * 初始化配置
   * 优先级：localStorage > 环境变量 > 默认值
   */
  initConfig() {
    // 1. 尝试从 localStorage 加载
    const savedConfig = this.loadConfig()

    if (savedConfig && savedConfig.apiKey) {
      this.config = savedConfig
      console.log(`[ChatService] Initialized from localStorage (${this.config.protocol})`)
      return
    }

    // 2. 尝试从环境变量加载
    const apiKey = process.env.REACT_APP_AI_API_KEY || process.env.REACT_APP_CLAUDE_API_KEY
    if (apiKey) {
      const protocol = process.env.REACT_APP_AI_PROTOCOL || 'anthropic'
      this.config = {
        protocol,
        apiKey,
        baseUrl: process.env.REACT_APP_AI_BASE_URL || (protocol === 'openai' ? 'https://api.openai.com/v1' : DEFAULT_CONFIG.baseUrl),
        model: process.env.REACT_APP_AI_MODEL || (protocol === 'openai' ? 'gpt-4o' : DEFAULT_CONFIG.model),
        maxTokens: parseInt(process.env.REACT_APP_AI_MAX_TOKENS) || DEFAULT_CONFIG.maxTokens
      }
      console.log(`[ChatService] Initialized from environment variables (${protocol})`)
      // 保存到 localStorage 以便下次使用
      this.saveConfig()
      return
    }

    // 3. 使用默认配置（但没有 API Key）
    this.config = { ...DEFAULT_CONFIG }
    console.log('[ChatService] Using default config (no API key)')
  }

  /**
   * 从 localStorage 加载配置
   * @returns {import('../types').APIConfig | null}
   */
  loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 合并默认配置，确保所有字段都存在
        return { ...DEFAULT_CONFIG, ...parsed }
      }
    } catch (e) {
      console.warn('[ChatService] Failed to load config from localStorage:', e)
    }
    return null
  }

  /**
   * 保存配置到 localStorage
   */
  saveConfig() {
    if (!this.config) return

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config))
      console.log('[ChatService] Config saved to localStorage')
    } catch (e) {
      console.warn('[ChatService] Failed to save config to localStorage:', e)
    }
  }

  /**
   * 配置API
   * @param {import('../types').APIConfig} config
   */
  configure(config) {
    this.config = {
      protocol: config.protocol || DEFAULT_CONFIG.protocol,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || (config.protocol === 'openai' ? 'https://api.openai.com/v1' : DEFAULT_CONFIG.baseUrl),
      model: config.model || (config.protocol === 'openai' ? 'gpt-4o' : DEFAULT_CONFIG.model),
      maxTokens: config.maxTokens || DEFAULT_CONFIG.maxTokens
    }
    // 保存到 localStorage
    this.saveConfig()
  }

  /**
   * 获取当前配置（返回副本，避免外部修改）
   * @returns {import('../types').APIConfig | null}
   */
  getConfig() {
    return this.config ? { ...this.config } : null
  }

  /**
   * 检查是否已配置
   */
  isConfigured() {
    return !!(this.config?.apiKey)
  }

  /**
   * 清除配置
   */
  clearConfig() {
    this.config = { ...DEFAULT_CONFIG }
    try {
      localStorage.removeItem(STORAGE_KEY)
      console.log('[ChatService] Config cleared')
    } catch (e) {
      console.warn('[ChatService] Failed to clear config from localStorage:', e)
    }
  }

  /**
   * 构建系统提示
   * @param {import('../types').ContextMessage[]} context
   * @param {import('../types').BrowsingPathEntry[]} browsingPath
   * @returns {string}
   */
  buildSystemPrompt(context, browsingPath) {
    const contextSummary = context.length > 0
      ? `当前浏览上下文包含 ${context.length} 条消息。`
      : '当前没有浏览上下文。'

    const pathSummary = browsingPath.length > 0
      ? browsingPath.slice(-5).map(p => {
        switch (p.action) {
          case 'view': return `- 查看了消息 #${p.index}`
          case 'switch_branch': return `- 从分支 ${p.from} 切换到 ${p.to}`
          case 'clear': return `- 清理了 ${p.clearedRange?.length || 0} 条消息`
          default: return `- ${p.action}`
        }
      }).join('\n')
      : '暂无浏览轨迹。'

    return `你是对话整理助手。用户正在浏览历史对话记录，需要你帮助整理、分析和总结这些对话内容。

${contextSummary}

最近的浏览轨迹：
${pathSummary}

你可以：
1. 帮助用户理解对话内容
2. 总结关键信息
3. 提供整理建议
4. 回答关于对话内容的问题

请基于用户浏览的对话内容，提供有价值的帮助。`
  }

  /**
   * 将上下文格式化为背景信息
   * @param {import('../types').ContextMessage[]} context
   * @returns {string}
   */
  formatContextAsBackground(context) {
    if (context.length === 0) {
      return '（当前没有浏览中的对话内容）'
    }

    return context.map((m, i) => {
      const role = m.sender === 'human' ? '用户' : '助手'
      const preview = m.content.length > 500
        ? m.content.substring(0, 500) + '...'
        : m.content
      return `[${i + 1}] ${role} (${m.branch}):\n${preview}`
    }).join('\n\n---\n\n')
  }

  /**
   * 发送消息
   * @param {string} userInput - 用户输入
   * @param {Object} context - 上下文
   * @param {import('../types').ContextMessage[]} context.messages - 浏览中的消息
   * @param {import('../types').BrowsingPathEntry[]} context.browsingPath - 浏览轨迹
   * @param {import('../types').ChatMessage[]} conversationHistory - 当前对话历史
   * @param {Object} callbacks - 回调函数
   * @param {(text: string) => void} callbacks.onChunk - 收到文本块
   * @param {(toolCall: Object) => void} [callbacks.onToolCall] - 工具调用
   * @param {(error: Error) => void} [callbacks.onError] - 错误
   * @returns {Promise<string>} 完整响应
   */
  async sendMessage(userInput, context, conversationHistory = [], callbacks = {}) {
    if (!this.isConfigured()) {
      throw new Error('ChatService not configured. Please set API key.')
    }

    const { onChunk, onToolCall, onError } = callbacks
    const isOpenAI = this.config.protocol === 'openai'

    // 创建AbortController
    this.abortController = new AbortController()

    try {
      // 构建系统提示
      const systemPrompt = this.buildSystemPrompt(
        context.messages || [],
        context.browsingPath || []
      )

      // 构建消息
      const messages = this.buildMessages(
        context,
        conversationHistory,
        userInput
      )

      // 获取可用工具
      const tools = await this.buildToolsParam()

      // 调用API获取流式响应
      const stream = await this.callAPI({
        system: systemPrompt,
        messages,
        tools,
        signal: this.abortController.signal
      })

      // 处理流式响应
      let fullText = ''

      // 使用 Server-Sent Events (SSE) 流式处理
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // 解码数据
        buffer += decoder.decode(value, { stream: true })

        // 按行分割
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后一行（可能不完整）

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine || trimmedLine.startsWith(':')) continue

          // Handle OpenAI style: data: {...}
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6)

            if (data === '[DONE]') continue

            try {
              const event = JSON.parse(data)

              if (isOpenAI) {
                // OpenAI stream format
                const content = event.choices?.[0]?.delta?.content
                if (content) {
                  fullText += content
                  onChunk?.(content)
                }

                // OpenAI tool calls (simplified for now)
                const toolCall = event.choices?.[0]?.delta?.tool_calls?.[0]
                if (toolCall) {
                  // Note: OpenAI tool calls in stream are fragmented, 
                  // real implementation needs to accumulate them.
                  // Here we just notify if it's the start.
                  if (toolCall.function?.name) {
                    onToolCall?.({
                      id: toolCall.id,
                      name: toolCall.function.name,
                      input: {} // Arguments come in subsequent delta chunks
                    })
                  }
                }
              } else {
                // Anthropic stream format
                if (event.type === 'content_block_delta') {
                  if (event.delta?.type === 'text_delta') {
                    const text = event.delta.text
                    fullText += text
                    onChunk?.(text)
                  }
                }
                else if (event.type === 'content_block_start') {
                  if (event.content_block?.type === 'tool_use') {
                    onToolCall?.({
                      id: event.content_block.id,
                      name: event.content_block.name,
                      input: event.content_block.input || {}
                    })
                  }
                }
                else if (event.type === 'error') {
                  throw new Error(event.error?.message || 'API error')
                }
              }
            } catch (parseError) {
              console.warn('[ChatService] Failed to parse SSE event:', parseError)
            }
          }
        }
      }

      return fullText
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request was cancelled')
      }
      onError?.(error)
      throw error
    } finally {
      this.abortController = null
    }
  }

  /**
   * 构建消息数组
   * @private
   */
  buildMessages(context, conversationHistory, userInput) {
    const messages = []

    // 如果有浏览上下文，添加为背景信息
    if (context.messages?.length > 0) {
      const backgroundInfo = this.formatContextAsBackground(context.messages)
      messages.push({
        role: 'user',
        content: `以下是我正在浏览的对话内容：\n\n${backgroundInfo}`
      })
      messages.push({
        role: 'assistant',
        content: '我已经看到了这些对话内容。有什么想讨论的，或者需要我帮忙整理吗？'
      })
    }

    // 添加之前的对话历史
    for (const msg of conversationHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        })
      }
    }

    // 添加当前用户输入
    messages.push({
      role: 'user',
      content: userInput
    })

    return messages
  }

  /**
   * 构建工具参数
   * @private
   */
  async buildToolsParam() {
    try {
      const mcpTools = await mcpService.listAllActiveTools()

      if (mcpTools.length === 0) {
        return undefined
      }

      const isOpenAI = this.config.protocol === 'openai'

      // 转换为API格式
      return mcpTools.map(tool => {
        if (isOpenAI) {
          return {
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description || '',
              parameters: tool.inputSchema
            }
          }
        } else {
          return {
            name: tool.name,
            description: tool.description || '',
            input_schema: tool.inputSchema
          }
        }
      })
    } catch (error) {
      console.warn('[ChatService] Failed to get MCP tools:', error)
      return undefined
    }
  }

  /**
   * 调用API
   * @private
   */
  async callAPI({ system, messages, tools, signal }) {
    const isOpenAI = this.config.protocol === 'openai'

    // 构造请求URL
    let url = this.config.baseUrl
    if (!url.endsWith('/')) url += '/'

    if (isOpenAI) {
      // OpenAI 协议通常是 v1/chat/completions
      // 如果 baseUrl 已经包含了 v1, 则追加 chat/completions
      // 否则通常需要追加 v1/chat/completions
      if (!url.toLowerCase().includes('/v1/')) {
        url += 'v1/'
      }
      url += 'chat/completions'
    } else {
      // Anthropic 官方协议是 v1/messages
      if (!url.toLowerCase().includes('/v1/')) {
        url += 'v1/'
      }
      url += 'messages'
    }

    const headers = {
      'Content-Type': 'application/json'
    }

    let body = {}

    if (isOpenAI) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
      body = {
        model: this.config.model,
        messages: [
          { role: 'system', content: system },
          ...messages
        ],
        tools,
        stream: true,
        max_tokens: this.config.maxTokens
      }
    } else {
      headers['x-api-key'] = this.config.apiKey
      headers['anthropic-version'] = '2023-06-01'
      headers['dangerously-allow-browser'] = 'true'
      body = {
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system,
        messages,
        tools,
        stream: true
      }
    }

    // Debug logging
    console.log('[ChatService] API Request:', {
      url,
      method: 'POST',
      headers,
      body
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal
      })

      console.log('[ChatService] API Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[ChatService] API Error Response:', errorText);
        throw new Error(`API error (${response.status}): ${errorText}`)
      }

      return response.body
    } catch (e) {
      console.error('[ChatService] Network Request Failed:', e);
      throw e;
    }
  }

  /**
   * 取消当前请求
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  /**
   * 处理工具调用
   * @param {Object} toolCall
   * @returns {Promise<string>}
   */
  async handleToolCall(toolCall) {
    const { name, input } = toolCall

    try {
      // 查找工具所属的服务器
      const allTools = await mcpService.listAllActiveTools()
      const tool = allTools.find(t => t.name === name)

      if (!tool) {
        return JSON.stringify({ error: `Tool not found: ${name}` })
      }

      const result = await mcpService.callTool(tool.serverId, name, input)

      if (result.isError) {
        return JSON.stringify({ error: result.content })
      }

      // 提取文本内容
      const textContent = result.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n')

      return textContent || JSON.stringify(result.content)
    } catch (error) {
      return JSON.stringify({ error: error.message })
    }
  }
}

// 单例导出
export const chatService = new ChatServiceManager()

export default chatService
