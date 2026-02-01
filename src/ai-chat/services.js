/**
 * Lyra AI Chat - Services
 * API 服务层：ChatService (Claude/OpenAI) + MCPService (工具扩展)
 *
 * ⚠️ 配置管理：配置由外部（SettingsManager）管理，services 不保存配置到 localStorage
 */

import { DEFAULT_AI_CONFIG } from '../config/aiConfig.js'
import StorageManager from '../utils/storageManager'

// ============================================
// Chat Service - AI 对话服务
// ============================================

/**
 * @typedef {Object} APIConfig
 * @property {string} protocol - 'anthropic' | 'openai'
 * @property {string} apiKey
 * @property {string} baseUrl
 * @property {string} model
 * @property {number} maxTokens
 */

/**
 * AI对话服务
 * 配置由外部管理，调用前需先 configure()
 */
class ChatServiceManager {
  constructor() {
    /** @type {APIConfig | null} */
    this.config = null

    /** @type {AbortController | null} */
    this.abortController = null
  }

  /**
   * 配置API（由外部调用，通常在 SettingsManager 更新配置后）
   * @param {APIConfig} config
   */
  configure(config) {
    this.config = {
      protocol: config.protocol || DEFAULT_AI_CONFIG.anthropic.protocol,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || (config.protocol === 'openai' ? DEFAULT_AI_CONFIG.openai.baseUrl : DEFAULT_AI_CONFIG.anthropic.baseUrl),
      model: config.model || (config.protocol === 'openai' ? DEFAULT_AI_CONFIG.openai.model : DEFAULT_AI_CONFIG.anthropic.model),
      maxTokens: config.maxTokens || DEFAULT_AI_CONFIG.anthropic.maxTokens
    }
    console.log(`[ChatService] Configured (${this.config.protocol})`)
  }

  /**
   * 获取当前配置（返回副本，避免外部修改）
   * @returns {APIConfig | null}
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
    this.config = null
    console.log('[ChatService] Config cleared')
  }

  /**
   * 构建系统提示
   * @param {import('./store').ContextMessage[]} context
   * @param {import('./store').BrowsingPathEntry[]} browsingPath
   * @returns {string}
   */
  buildSystemPrompt(context, browsingPath) {
    const stats = {
      total: context.length,
      human: context.filter(m => m.sender === 'human').length,
      assistant: context.filter(m => m.sender === 'assistant').length,
      custom: context.filter(m => m.sender === 'user_custom').length,
      branches: new Set(context.map(m => m.branch).filter(Boolean)).size
    }

    const contextSummary = stats.total > 0
      ? `当前上下文: ${stats.total} 条消息（用户 ${stats.human} 条，助手 ${stats.assistant} 条${stats.custom > 0 ? `，用户补充 ${stats.custom} 条` : ''}）${stats.branches > 1 ? `，涉及 ${stats.branches} 个分支` : ''}`
      : '当前没有浏览上下文'

    const pathSummary = browsingPath.length > 0
      ? '最近操作:\n' + browsingPath.slice(-8).map((p, i) => {
        const time = new Date(p.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        switch (p.action) {
          case 'view': return `  ${i + 1}. [${time}] 查看消息 #${p.index}`
          case 'switch_branch': return `  ${i + 1}. [${time}] 切换分支: ${p.from} → ${p.to}${p.cleaned ? ' (清理旧分支)' : ''}`
          case 'clear': return `  ${i + 1}. [${time}] 清理 ${p.clearedRange?.length || 0} 条消息`
          case 'clear_branch': return `  ${i + 1}. [${time}] 清理分支 ${p.branchId} (${p.clearedCount || 0} 条)`
          case 'remove': return `  ${i + 1}. [${time}] 移除消息 ${p.uuid}`
          default: return `  ${i + 1}. [${time}] ${p.action}`
        }
      }).join('\n')
      : '暂无操作记录'

    // 读取自定义系统提示词
    const config = StorageManager.get('ai-context-config', {})
    const customSystemPrompt = config.systemPrompt || null

    // 如果有自定义系统提示词，替换 {contextSummary} 和 {pathSummary} 占位符
    if (customSystemPrompt && customSystemPrompt.trim()) {
      return customSystemPrompt
        .replace(/\{contextSummary\}/g, contextSummary)
        .replace(/\{pathSummary\}/g, pathSummary)
    }

    // 默认系统提示词
    return `[对话已重置，接受任务]
${contextSummary}

${pathSummary}
`
  }

  /**
   * 将上下文格式化为背景信息
   * @param {import('./store').ContextMessage[]} context
   * @returns {string}
   */
  formatContextAsBackground(context) {
    if (context.length === 0) {
      return '（当前没有浏览中的对话内容）'
    }

    // 读取上下文配置
    const defaultConfig = {
      maxContentLength: 3000,
      includeThinking: false,
      includeArtifacts: false,
      includeAttachments: false
    }

    const storedConfig = StorageManager.get('ai-context-config', {})
    const contextConfig = { ...defaultConfig, ...storedConfig }

    return context.map((m, i) => {
      const role = m.sender === 'human' ? '用户' :
                   m.sender === 'assistant' ? '助手' :
                   m.sender === 'user_custom' ? `[${m.label || '用户补充'}]` : '助手'

      // 使用配置的内容长度限制
      const MAX_CONTENT_LENGTH = contextConfig.maxContentLength || 0
      let content = m.content

      // 0 表示不限制
      const preview = MAX_CONTENT_LENGTH > 0 && content.length > MAX_CONTENT_LENGTH
        ? content.substring(0, MAX_CONTENT_LENGTH) + '\n\n[...内容过长已截断，共' + content.length + '字符...]'
        : content

      // 简化分支 ID 显示（不显示过于复杂的内部ID）
      const branchInfo = m.branch && m.branch !== 'main' && !m.branch.startsWith('branch_')
        ? ` [分支: ${m.branch}]`
        : ''

      return `[消息 ${i + 1}] ${role}${branchInfo}:\n${preview}`
    }).join('\n\n---\n\n')
  }

  /**
   * 发送消息
   * @param {string} userInput - 用户输入
   * @param {Object} context - 上下文
   * @param {import('./store').ContextMessage[]} context.messages - 浏览中的消息
   * @param {import('./store').BrowsingPathEntry[]} context.browsingPath - 浏览轨迹
   * @param {Array} conversationHistory - 当前对话历史
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
        buffer = lines.pop() || ''

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

                const toolCall = event.choices?.[0]?.delta?.tool_calls?.[0]
                if (toolCall?.function?.name) {
                  onToolCall?.({
                    id: toolCall.id,
                    name: toolCall.function.name,
                    input: {}
                  })
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
      if (!url.toLowerCase().includes('/v1/')) {
        url += 'v1/'
      }
      url += 'chat/completions'
    } else {
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

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error (${response.status}): ${errorText}`)
      }

      return response.body
    } catch (e) {
      console.error('[ChatService] Network Request Failed:', e)
      throw e
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
      const allTools = await mcpService.listAllActiveTools()
      const tool = allTools.find(t => t.name === name)

      if (!tool) {
        return JSON.stringify({ error: `Tool not found: ${name}` })
      }

      const result = await mcpService.callTool(tool.serverId, name, input)

      if (result.isError) {
        return JSON.stringify({ error: result.content })
      }

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

// ============================================
// MCP Service - 工具扩展服务
// ============================================

/**
 * @typedef {Object} MCPToolResult
 * @property {Array} content
 * @property {boolean} isError
 */

/**
 * MCP客户端管理器
 * 支持内置MCP和用户自定义MCP
 */
class MCPServiceManager {
  constructor() {
    /** @type {Map<string, any>} 客户端实例缓存 */
    this.clients = new Map()

    /** @type {Map<string, Promise<any>>} 正在初始化的客户端 */
    this.pendingClients = new Map()

    /** @type {import('./store').MCPServer[]} 已注册的服务器列表 */
    this.servers = []

    /** @type {Map<string, import('./store').MCPTool[]>} 服务器工具缓存 */
    this.toolsCache = new Map()
  }

  /**
   * 注册内置MCP服务器
   * @param {import('./store').MCPServer} server
   */
  registerBuiltinServer(server) {
    const builtinServer = {
      ...server,
      type: 'builtin',
      isActive: true
    }
    this.servers.push(builtinServer)
    return builtinServer.id
  }

  /**
   * 添加用户自定义MCP服务器
   * @param {Partial<import('./store').MCPServer>} config
   * @returns {string} 服务器ID
   */
  addCustomServer(config) {
    const server = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: config.name || 'Custom MCP Server',
      type: 'custom',
      command: config.command,
      args: config.args || [],
      baseUrl: config.baseUrl,
      env: config.env || {},
      isActive: false,
      disabledTools: [],
      ...config
    }
    this.servers.push(server)
    return server.id
  }

  /**
   * 移除服务器
   * @param {string} serverId
   */
  removeServer(serverId) {
    const index = this.servers.findIndex(s => s.id === serverId)
    if (index > -1) {
      this.disconnect(serverId)
      this.servers.splice(index, 1)
    }
  }

  /**
   * 获取所有服务器列表
   * @returns {import('./store').MCPServer[]}
   */
  getServers() {
    return [...this.servers]
  }

  /**
   * 获取激活的服务器列表
   * @returns {import('./store').MCPServer[]}
   */
  getActiveServers() {
    return this.servers.filter(s => s.isActive)
  }

  /**
   * 激活/停用服务器
   * @param {string} serverId
   * @param {boolean} active
   */
  async setServerActive(serverId, active) {
    const server = this.servers.find(s => s.id === serverId)
    if (!server) return

    if (active) {
      await this.connect(serverId)
      server.isActive = true
    } else {
      await this.disconnect(serverId)
      server.isActive = false
    }
  }

  /**
   * 连接到MCP服务器
   * @param {string} serverId
   * @returns {Promise<any>} Client实例
   */
  async connect(serverId) {
    const server = this.servers.find(s => s.id === serverId)
    if (!server) {
      throw new Error(`Server not found: ${serverId}`)
    }

    if (this.pendingClients.has(serverId)) {
      return this.pendingClients.get(serverId)
    }

    if (this.clients.has(serverId)) {
      return this.clients.get(serverId)
    }

    const connectPromise = this._createConnection(server)
    this.pendingClients.set(serverId, connectPromise)

    try {
      const client = await connectPromise
      this.clients.set(serverId, client)
      return client
    } finally {
      this.pendingClients.delete(serverId)
    }
  }

  /**
   * 创建MCP连接（目前为 mock 实现）
   * @private
   * @param {import('./store').MCPServer} server
   */
  async _createConnection(server) {
    // TODO: 实际的MCP SDK连接逻辑
    console.log(`[MCPService] Connecting to server: ${server.name}`)
    return {
      id: server.id,
      connected: true,
      _mock: true
    }
  }

  /**
   * 断开服务器连接
   * @param {string} serverId
   */
  async disconnect(serverId) {
    const client = this.clients.get(serverId)
    if (client) {
      this.clients.delete(serverId)
      this.toolsCache.delete(serverId)
    }
  }

  /**
   * 获取服务器的工具列表
   * @param {string} serverId
   * @returns {Promise<import('./store').MCPTool[]>}
   */
  async listTools(serverId) {
    if (this.toolsCache.has(serverId)) {
      return this.toolsCache.get(serverId)
    }

    await this.connect(serverId)
    const server = this.servers.find(s => s.id === serverId)

    // TODO: 实际获取工具
    const mcpTools = [
      {
        id: `${serverId}_example_tool`,
        name: 'example_tool',
        description: 'An example tool placeholder',
        inputSchema: { type: 'object', properties: {} },
        serverId: serverId,
        serverName: server?.name || 'Unknown'
      }
    ]

    this.toolsCache.set(serverId, mcpTools)
    return mcpTools
  }

  /**
   * 获取所有激活服务器的工具
   * @returns {Promise<import('./store').MCPTool[]>}
   */
  async listAllActiveTools() {
    const activeServers = this.getActiveServers()
    const toolsPromises = activeServers.map(s => this.listTools(s.id))
    const toolsArrays = await Promise.all(toolsPromises)
    return toolsArrays.flat()
  }

  /**
   * 调用MCP工具
   * @param {string} serverId
   * @param {string} toolName
   * @param {Object} args
   * @returns {Promise<MCPToolResult>}
   */
  async callTool(serverId, toolName, args) {
    await this.connect(serverId)

    // TODO: 实际调用工具
    console.log(`[MCPService] Calling tool: ${toolName}`, args)
    return {
      content: [{ type: 'text', text: `Tool ${toolName} called with args: ${JSON.stringify(args)}` }],
      isError: false
    }
  }

  /**
   * 通过工具ID调用工具
   * @param {string} toolId 格式: serverId_toolName
   * @param {Object} args
   */
  async callToolById(toolId, args) {
    const allTools = await this.listAllActiveTools()
    const tool = allTools.find(t => t.id === toolId)

    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`)
    }

    return this.callTool(tool.serverId, tool.name, args)
  }

  /**
   * 清理所有连接
   */
  async cleanup() {
    const serverIds = [...this.clients.keys()]
    await Promise.all(serverIds.map(id => this.disconnect(id)))
  }
}

// 单例导出
export const chatService = new ChatServiceManager()
export const mcpService = new MCPServiceManager()

// 预留的内置MCP注册入口
export function registerBuiltinMCPs() {
  // 示例：注册conversation-context MCP
  // mcpService.registerBuiltinServer({
  //   id: 'builtin_conversation_context',
  //   name: 'Conversation Context',
  //   command: 'node',
  //   args: ['path/to/conversation-mcp/index.js'],
  //   env: {}
  // })
}

export default {
  chatService,
  mcpService,
  registerBuiltinMCPs
}
