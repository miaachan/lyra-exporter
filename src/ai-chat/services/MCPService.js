/**
 * Lyra AI Chat - MCP Service
 * MCP服务层 - 管理内置和用户自定义的MCP服务器
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

    /** @type {import('../types').MCPServer[]} 已注册的服务器列表 */
    this.servers = []

    /** @type {Map<string, import('../types').MCPTool[]>} 服务器工具缓存 */
    this.toolsCache = new Map()
  }

  /**
   * 注册内置MCP服务器
   * 后续完成的MCP可以直接放入这里
   * @param {import('../types').MCPServer} server
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
   * @param {Partial<import('../types').MCPServer>} config
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
   * @returns {import('../types').MCPServer[]}
   */
  getServers() {
    return [...this.servers]
  }

  /**
   * 获取激活的服务器列表
   * @returns {import('../types').MCPServer[]}
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

    // 检查是否已有pending连接
    if (this.pendingClients.has(serverId)) {
      return this.pendingClients.get(serverId)
    }

    // 检查是否已连接
    if (this.clients.has(serverId)) {
      return this.clients.get(serverId)
    }

    // 创建连接Promise
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
   * 创建MCP连接
   * @private
   * @param {import('../types').MCPServer} server
   */
  async _createConnection(server) {
    // TODO: 实际的MCP SDK连接逻辑
    // 这里预留接口，后续替换为实际实现

    /*
    import { Client } from '@modelcontextprotocol/sdk/client/index.js'
    import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
    import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

    const client = new Client(
      { name: 'Lyra-AI-Chat', version: '1.0.0' },
      { capabilities: {} }
    )

    let transport
    if (server.command) {
      transport = new StdioClientTransport({
        command: server.command,
        args: server.args || [],
        env: { ...process.env, ...server.env }
      })
    } else if (server.baseUrl) {
      transport = new SSEClientTransport(new URL(server.baseUrl))
    }

    await client.connect(transport)
    return client
    */

    // 模拟连接
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
      // TODO: 实际断开连接
      // await client.close()
      this.clients.delete(serverId)
      this.toolsCache.delete(serverId)
    }
  }

  /**
   * 获取服务器的工具列表
   * @param {string} serverId
   * @returns {Promise<import('../types').MCPTool[]>}
   */
  async listTools(serverId) {
    // 检查缓存
    if (this.toolsCache.has(serverId)) {
      return this.toolsCache.get(serverId)
    }

    const client = await this.connect(serverId)
    const server = this.servers.find(s => s.id === serverId)

    // TODO: 实际获取工具
    /*
    const { tools } = await client.listTools()
    const mcpTools = tools.map(tool => ({
      id: `${serverId}_${tool.name}`,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      serverId: serverId,
      serverName: server.name
    }))
    */

    // 模拟工具列表
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
   * @returns {Promise<import('../types').MCPTool[]>}
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
   * @returns {Promise<import('../types').MCPToolResult>}
   */
  async callTool(serverId, toolName, args) {
    const client = await this.connect(serverId)

    // TODO: 实际调用工具
    /*
    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args
      })
      return {
        content: result.content,
        isError: result.isError || false
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: error.message }],
        isError: true
      }
    }
    */

    // 模拟调用结果
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
    // 从工具ID中解析serverId和toolName
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
export const mcpService = new MCPServiceManager()

// 预留的内置MCP注册入口
// 后续完成的MCP可以在这里注册
export function registerBuiltinMCPs() {
  // 示例：注册conversation-context MCP
  /*
  mcpService.registerBuiltinServer({
    id: 'builtin_conversation_context',
    name: 'Conversation Context',
    command: 'node',
    args: ['path/to/conversation-mcp/index.js'],
    env: {}
  })
  */
}

export default mcpService
