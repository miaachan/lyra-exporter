/**
 * Lyra AI Chat - Type Definitions
 * 类型定义（使用JSDoc注释）
 */

/**
 * MCP服务器配置
 * @typedef {Object} MCPServer
 * @property {string} id - 服务器唯一标识
 * @property {string} name - 显示名称
 * @property {string} type - 类型: 'builtin' | 'custom'
 * @property {string} [command] - stdio命令
 * @property {string[]} [args] - 命令参数
 * @property {string} [baseUrl] - HTTP/SSE服务器地址
 * @property {Record<string, string>} [env] - 环境变量
 * @property {boolean} isActive - 是否激活
 * @property {string[]} [disabledTools] - 禁用的工具列表
 */

/**
 * MCP工具定义
 * @typedef {Object} MCPTool
 * @property {string} id - 工具唯一标识
 * @property {string} name - 工具名称
 * @property {string} [description] - 工具描述
 * @property {Object} inputSchema - 输入参数schema
 * @property {string} serverId - 所属服务器ID
 * @property {string} serverName - 所属服务器名称
 */

/**
 * MCP工具调用结果
 * @typedef {Object} MCPToolResult
 * @property {Array<{type: string, text?: string}>} content - 返回内容
 * @property {boolean} isError - 是否出错
 */

/**
 * 聊天消息
 * @typedef {Object} ChatMessage
 * @property {string} id - 消息ID
 * @property {'user' | 'assistant' | 'system'} role - 角色
 * @property {string} content - 消息内容
 * @property {number} timestamp - 时间戳
 * @property {'pending' | 'streaming' | 'complete' | 'error'} [status] - 状态
 * @property {MCPToolCall[]} [toolCalls] - 工具调用
 */

/**
 * MCP工具调用
 * @typedef {Object} MCPToolCall
 * @property {string} id - 调用ID
 * @property {string} toolName - 工具名称
 * @property {Object} args - 调用参数
 * @property {'pending' | 'running' | 'success' | 'error'} status - 状态
 * @property {string} [result] - 调用结果
 */

/**
 * 浏览上下文消息
 * @typedef {Object} ContextMessage
 * @property {number} index - 消息索引
 * @property {string} uuid - 唯一标识
 * @property {'human' | 'assistant'} sender - 发送者
 * @property {string} content - 内容
 * @property {string} branch - 所属分支
 */

/**
 * 浏览轨迹条目
 * @typedef {Object} BrowsingPathEntry
 * @property {'view' | 'switch_branch' | 'clear'} action - 动作类型
 * @property {number} [index] - 相关索引
 * @property {string} [from] - 来源分支
 * @property {string} [to] - 目标分支
 * @property {string[]} [clearedRange] - 清理的范围
 * @property {number} timestamp - 时间戳
 */

/**
 * API配置
 * @typedef {Object} APIConfig
 * @property {'anthropic' | 'openai'} protocol - API协议类型
 * @property {string} apiKey - API密钥
 * @property {string} [baseUrl] - API基础URL
 * @property {string} model - 模型ID
 * @property {number} [maxTokens] - 最大token数
 */

/**
 * 面板模式
 * @typedef {'chat' | 'manage'} PanelMode
 */

/**
 * 面板状态
 * @typedef {Object} PanelState
 * @property {boolean} isOpen - 是否打开
 * @property {boolean} isMinimized - 是否最小化
 * @property {boolean} isPinned - 是否固定
 * @property {PanelMode} mode - 当前模式
 * @property {{x: number, y: number}} position - 位置
 * @property {{width: number, height: number}} size - 尺寸
 */

// 导出空对象使模块可被引用
export default {}
