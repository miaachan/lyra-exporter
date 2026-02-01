// utils/SearchService.js
// 统一搜索服务 - 整合本地搜索、全局搜索和语义搜索
// 整合自: searchManager.js, globalSearchManager.js, semanticSearchManager.js

import { pipeline } from '@xenova/transformers';
import { generateConversationCardUuid, generateFileCardUuid } from './data/uuidManager';
import { extractChatData, detectBranches } from './fileParser';
import { parseJSONL } from './fileParser/helpers';
import { highlightText, getExcerpt } from './textUtils';
import StorageManager from './storageManager';

// ============================================================================
// 常量定义
// ============================================================================

const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_SEMANTIC_CONFIG = {
  provider: 'lmstudio',  // 'transformers' | 'lmstudio'
  lmStudioUrl: 'http://localhost:1234',
  modelName: 'qwen3-embedding',
};

// ============================================================================
// 本地搜索引擎 (原 SearchManager)
// ============================================================================

export class LocalSearch {
  constructor() {
    this.query = '';
    this.results = [];
    this.filteredMessages = [];
    this.debounceTimer = null;
  }

  /**
   * 执行搜索
   */
  performSearch(searchText, messageList) {
    if (!searchText.trim()) {
      this.results = [];
      this.filteredMessages = messageList;
      return { results: this.results, filteredMessages: this.filteredMessages };
    }

    const lowerQuery = searchText.toLowerCase();
    const searchResults = [];
    const filtered = [];

    messageList.forEach((message, index) => {
      const matches = [];
      let shouldInclude = false;

      // 搜索主要内容
      if (message.display_text?.toLowerCase().includes(lowerQuery)) {
        matches.push({
          type: 'content',
          text: message.display_text,
          excerpt: getExcerpt(message.display_text, lowerQuery)
        });
        shouldInclude = true;
      }

      // 搜索思考过程
      if (message.thinking?.toLowerCase().includes(lowerQuery)) {
        matches.push({
          type: 'thinking',
          text: message.thinking,
          excerpt: getExcerpt(message.thinking, lowerQuery)
        });
        shouldInclude = true;
      }

      // 搜索artifacts
      if (message.artifacts && message.artifacts.length > 0) {
        message.artifacts.forEach((artifact, artifactIndex) => {
          if (artifact.content?.toLowerCase().includes(lowerQuery) ||
              artifact.title?.toLowerCase().includes(lowerQuery)) {
            matches.push({
              type: 'artifact',
              artifactIndex,
              text: artifact.content || artifact.title,
              excerpt: getExcerpt(artifact.content || artifact.title, lowerQuery)
            });
            shouldInclude = true;
          }
        });
      }

      // 搜索对话标题和项目名
      if (message.is_conversation_header) {
        if (message.conversation_name?.toLowerCase().includes(lowerQuery) ||
            message.project_name?.toLowerCase().includes(lowerQuery) ||
            message.display_text?.toLowerCase().includes(lowerQuery)) {
          shouldInclude = true;
          matches.push({
            type: 'header',
            text: message.display_text
          });
        }
      }

      // 对于文件和对话卡片的搜索
      if (message.type === 'file' || message.type === 'conversation') {
        const searchableText = [
          message.name,
          message.fileName,
          message.summary,
          message.model,
          message.platform
        ].filter(Boolean).join(' ').toLowerCase();

        if (searchableText.includes(lowerQuery)) {
          shouldInclude = true;
          matches.push({
            type: 'card',
            text: message.name || message.fileName
          });
        }
      }

      if (shouldInclude) {
        filtered.push(message);
        searchResults.push({
          messageIndex: index,
          message,
          matches
        });
      }
    });

    this.results = searchResults;
    this.filteredMessages = filtered;

    return { results: this.results, filteredMessages: this.filteredMessages };
  }

  /**
   * 防抖搜索
   */
  searchWithDebounce(searchText, messageList, callback) {
    clearTimeout(this.debounceTimer);

    if (!searchText.trim()) {
      this.query = '';
      this.results = [];
      this.filteredMessages = messageList;
      if (callback) callback({ results: this.results, filteredMessages: this.filteredMessages });
      return;
    }

    this.query = searchText;

    this.debounceTimer = setTimeout(() => {
      const result = this.performSearch(searchText, messageList);
      if (callback) callback(result);
    }, SEARCH_DEBOUNCE_MS);
  }

  /**
   * 清除搜索
   */
  clearSearch(messageList) {
    this.query = '';
    this.results = [];
    this.filteredMessages = messageList;
    clearTimeout(this.debounceTimer);
    return { results: this.results, filteredMessages: this.filteredMessages };
  }

  /**
   * 获取结果统计
   */
  getResultStats() {
    const totalMatches = this.results.reduce((acc, result) =>
      acc + result.matches.length, 0
    );

    return {
      messageCount: this.results.length,
      totalMatches,
      hasResults: this.results.length > 0
    };
  }

  getQuery() {
    return this.query;
  }

  getFilteredMessages() {
    return this.filteredMessages;
  }
}

// ============================================================================
// 全局搜索引擎 (原 GlobalSearchManager)
// ============================================================================

export class GlobalSearch {
  constructor() {
    this.messageIndex = new Map();
    this.fileData = new Map();
    this.fileCache = new Map();
    this.customNames = {};
  }

  /**
   * 构建全局消息索引（异步）
   */
  async buildGlobalIndex(files, processedData, currentFileIndex, customNames = {}) {
    this.customNames = customNames;
    const startTime = Date.now();

    this.messageIndex.clear();
    const newFileData = new Map();

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      let data;

      // 尝试从缓存获取
      const cacheKey = file.name;
      const cached = this.fileCache.get(cacheKey);

      if (cached && cached.lastModified === file.lastModified) {
        if (fileIndex === currentFileIndex && processedData) {
          data = processedData;
          this.fileCache.set(cacheKey, { lastModified: file.lastModified, data });
        } else {
          data = cached.data;
        }
      } else {
        if (fileIndex === currentFileIndex && processedData) {
          data = processedData;
        } else if (file._mergedProcessedData) {
          console.log(`[GlobalSearch] 使用预处理的合并数据: ${file.name}`);
          data = file._mergedProcessedData;
        } else {
          try {
            const text = await file.text();
            const isJSONL = file.name.endsWith('.jsonl') || (text.includes('\n{') && !text.trim().startsWith('['));
            const jsonData = isJSONL ? parseJSONL(text) : JSON.parse(text);
            data = extractChatData(jsonData, file.name);
            data = detectBranches(data);
          } catch (error) {
            console.error(`[GlobalSearch] 解析文件 ${file.name} 失败:`, error);
            continue;
          }
        }

        if (data) {
          this.fileCache.set(cacheKey, { lastModified: file.lastModified, data });
        }
      }

      if (!data) continue;

      newFileData.set(file.name, data);

      if (data.format === 'claude_full_export') {
        this.indexFullExportData(data, file, fileIndex);
      } else if (data.chat_history) {
        this.indexSimpleData(data, file, fileIndex);
      }
    }

    this.fileData = newFileData;
    console.log(`[GlobalSearch] 索引构建完成: ${this.messageIndex.size} 条消息, 来自 ${files.length} 个文件, 耗时 ${Date.now() - startTime}ms`);
    return this.messageIndex;
  }

  /**
   * 索引完整导出格式的数据
   */
  indexFullExportData(data, file, fileIndex) {
    const conversations = data.views?.conversationList || [];

    conversations.forEach(conv => {
      const convUuid = generateConversationCardUuid(fileIndex, conv.uuid, file);
      const displayName = this.customNames[conv.uuid] || this.customNames[convUuid] || conv.name || '未命名对话';

      const convMessages = data.chat_history?.filter(msg =>
        msg.conversation_uuid === conv.uuid && !msg.is_conversation_header
      ) || [];

      convMessages.forEach((msg, msgIndex) => {
        const messageId = `${convUuid}_${msg.uuid}`;

        this.messageIndex.set(messageId, {
          fileId: file.name,
          fileName: file.name,
          fileIndex,
          conversationId: conv.uuid,
          conversationName: displayName,
          originalName: conv.name,
          conversationUuid: convUuid,
          messageIndex: msgIndex,
          messageUuid: msg.uuid,
          message: {
            content: this.extractContent(msg),
            sender: msg.sender,
            timestamp: msg.created_at,
            parentUuid: msg.parent_message_uuid,
            uuid: msg.uuid,
            isBlank: this.isBlankMessage(msg),
            stopReason: msg.stop_reason,
            hasBranch: msg.has_branch || false,
            inputMode: msg.input_mode
          },
          searchableText: this.extractSearchableText(msg),
          hasThinking: !!msg.thinking,
          hasArtifacts: msg.artifacts && msg.artifacts.length > 0,
          hasAttachments: msg.attachments && msg.attachments.length > 0,
          hasTools: msg.tools && msg.tools.length > 0
        });
      });
    });
  }

  /**
   * 索引简单格式的数据
   */
  indexSimpleData(data, file, fileIndex) {
    const fileUuid = generateFileCardUuid(fileIndex, file);
    const messages = data.chat_history || [];

    const conversationId = data.meta_info?.uuid || fileUuid;
    const originalTitle = data.meta_info?.title || file.name.replace('.json', '');
    const displayName = this.customNames[conversationId] || this.customNames[fileUuid] || originalTitle;

    messages.forEach((msg, msgIndex) => {
      const messageId = `${fileUuid}_${msg.uuid || msgIndex}`;

      this.messageIndex.set(messageId, {
        fileId: file.name,
        fileName: file.name,
        fileIndex,
        conversationId,
        conversationName: displayName,
        originalName: originalTitle,
        conversationUuid: fileUuid,
        fileUuid,
        messageIndex: msgIndex,
        messageUuid: msg.uuid || `msg_${msgIndex}`,
        message: {
          content: this.extractContent(msg),
          sender: msg.sender,
          timestamp: msg.created_at,
          uuid: msg.uuid || `msg_${msgIndex}`,
          isBlank: this.isBlankMessage(msg),
          stopReason: msg.stop_reason
        },
        searchableText: this.extractSearchableText(msg),
        hasThinking: !!msg.thinking,
        hasArtifacts: msg.artifacts && msg.artifacts.length > 0
      });
    });
  }

  extractContent(msg) {
    if (msg.content) {
      if (Array.isArray(msg.content)) {
        return msg.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('\n');
      }
      return msg.content;
    }
    return msg.text || msg.display_text || '';
  }

  isBlankMessage(msg) {
    const content = this.extractContent(msg);
    return !content || content.trim() === '';
  }

  extractSearchableText(msg) {
    const parts = [];

    const content = this.extractContent(msg);
    if (content) parts.push(content);

    if (msg.thinking) {
      if (typeof msg.thinking === 'string') {
        parts.push(msg.thinking);
      } else if (msg.thinking.thinking) {
        parts.push(msg.thinking.thinking);
      }
    }

    if (msg.artifacts && Array.isArray(msg.artifacts)) {
      msg.artifacts.forEach(artifact => {
        if (artifact.title) parts.push(artifact.title);
        if (artifact.content) parts.push(artifact.content);
      });
    }

    if (msg.tools && Array.isArray(msg.tools)) {
      msg.tools.forEach(tool => {
        if (tool.name) parts.push(tool.name);
        if (tool.input) parts.push(JSON.stringify(tool.input));
      });
    }

    return parts.join('\n').toLowerCase();
  }

  /**
   * 执行搜索
   */
  search(query, options = {}, searchMode = 'all') {
    if (!query || !query.trim()) {
      return { results: [], stats: { total: 0, files: 0, conversations: 0 } };
    }

    const lowerQuery = query.toLowerCase().trim();
    const results = [];
    const fileSet = new Set();
    const conversationSet = new Set();

    if (searchMode === 'titles') {
      const conversationMap = new Map();

      this.messageIndex.forEach((data, messageId) => {
        const convId = data.conversationId || data.fileId;
        if (!conversationMap.has(convId)) {
          conversationMap.set(convId, {
            conversationId: convId,
            conversationName: data.conversationName || data.fileName,
            fileId: data.fileId,
            fileName: data.fileName,
            fileIndex: data.fileIndex,
            conversationUuid: data.conversationUuid,
            messageCount: 0,
            firstMessage: data
          });
        }
        conversationMap.get(convId).messageCount++;
      });

      conversationMap.forEach((conv) => {
        const titleLower = (conv.conversationName || '').toLowerCase();
        if (titleLower.includes(lowerQuery)) {
          results.push({
            messageId: `title_${conv.conversationId}`,
            ...conv.firstMessage,
            conversationName: conv.conversationName,
            fileName: conv.fileName,
            score: this.calculateRelevance(lowerQuery, titleLower),
            preview: conv.conversationName,
            messageCount: conv.messageCount,
            isConversationResult: true
          });
          fileSet.add(conv.fileId);
          if (conv.conversationId) {
            conversationSet.add(conv.conversationId);
          }
        }
      });
    } else {
      this.messageIndex.forEach((data, messageId) => {
        if (this.matchesQuery(data, lowerQuery, options, searchMode)) {
          const result = {
            messageId,
            ...data,
            score: this.calculateRelevance(lowerQuery, data.searchableText),
            preview: getExcerpt(data.searchableText, lowerQuery, 100)
          };

          results.push(result);
          fileSet.add(data.fileId);
          if (data.conversationId) {
            conversationSet.add(data.conversationId);
          }
        }
      });
    }

    results.sort((a, b) => b.score - a.score);

    const processedResults = (searchMode !== 'titles' && options.removeDuplicates) ?
      this.removeDuplicates(results) : results;

    return {
      results: processedResults,
      stats: {
        total: processedResults.length,
        files: fileSet.size,
        conversations: conversationSet.size
      }
    };
  }

  matchesQuery(data, query, options, searchMode = 'all') {
    if (searchMode === 'titles') {
      return false;
    }

    if (data.searchableText.includes(query)) {
      return true;
    }

    if (options.contentOnly && data.message.content.toLowerCase().includes(query)) {
      return true;
    }
    if (options.thinkingOnly && data.hasThinking) {
      return data.searchableText.includes(query);
    }

    return false;
  }

  calculateRelevance(query, text) {
    let score = 0;
    const lowerText = text.toLowerCase();

    if (lowerText === query) {
      score += 100;
    }

    const matches = (lowerText.match(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
    score += matches * 10;

    const firstIndex = lowerText.indexOf(query);
    if (firstIndex !== -1) {
      score += Math.max(0, 50 - firstIndex / 10);
    }

    return score;
  }

  removeDuplicates(results) {
    const seen = new Map();
    const unique = [];

    results.forEach(result => {
      const content = result.message.content;
      const contentHash = this.hashContent(content);

      if (!seen.has(contentHash)) {
        seen.set(contentHash, result);
        unique.push(result);
      } else {
        const original = seen.get(contentHash);
        if (!original.duplicates) {
          original.duplicates = [];
        }
        original.duplicates.push({
          fileId: result.fileId,
          conversationName: result.conversationName,
          messageIndex: result.messageIndex
        });
      }
    });

    return unique;
  }

  hashContent(content) {
    if (!content) return 'empty';
    const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
    return normalized.slice(0, 100);
  }

  getMessagePath(messageId) {
    const data = this.messageIndex.get(messageId);
    if (!data) return null;

    const path = [];
    let currentUuid = data.message.uuid;
    let attempts = 0;
    const maxAttempts = 100;

    while (currentUuid && currentUuid !== '00000000-0000-4000-8000-000000000000' && attempts < maxAttempts) {
      path.unshift(currentUuid);

      let foundParent = false;
      for (const [id, msgData] of this.messageIndex.entries()) {
        if (msgData.message.uuid === currentUuid && msgData.message.parentUuid) {
          currentUuid = msgData.message.parentUuid;
          foundParent = true;
          break;
        }
      }

      if (!foundParent) break;
      attempts++;
    }

    return path;
  }

  clear() {
    this.messageIndex.clear();
    this.fileData.clear();
  }

  getStats() {
    const fileSet = new Set();
    const conversationSet = new Set();
    let blankCount = 0;
    let withThinking = 0;
    let withArtifacts = 0;

    this.messageIndex.forEach(data => {
      fileSet.add(data.fileId);
      if (data.conversationId) {
        conversationSet.add(data.conversationId);
      }
      if (data.message.isBlank) blankCount++;
      if (data.hasThinking) withThinking++;
      if (data.hasArtifacts) withArtifacts++;
    });

    return {
      totalMessages: this.messageIndex.size,
      totalFiles: fileSet.size,
      totalConversations: conversationSet.size,
      blankMessages: blankCount,
      messagesWithThinking: withThinking,
      messagesWithArtifacts: withArtifacts
    };
  }
}

// ============================================================================
// 语义搜索引擎 (原 SemanticSearchManager)
// ============================================================================

export class SemanticSearch {
  constructor() {
    this.embedder = null;
    this.isLoading = false;
    this.isReady = false;
    this.vectorIndex = [];
    this.loadProgress = 0;
    this.onProgressCallback = null;
    this.config = this.loadConfig();
  }

  loadConfig() {
    const saved = StorageManager.get('semantic-embedding-config');
    return saved ? { ...DEFAULT_SEMANTIC_CONFIG, ...saved } : { ...DEFAULT_SEMANTIC_CONFIG };
  }

  saveConfig() {
    if (!this.config) return;
    StorageManager.set('semantic-embedding-config', this.config);
    console.log('[SemanticSearch] Config saved');
  }

  configure(config) {
    if (config.provider !== this.config.provider) {
      this.isReady = false;
      this.embedder = null;
      this.vectorIndex = [];
    }

    this.config = {
      provider: config.provider || DEFAULT_SEMANTIC_CONFIG.provider,
      lmStudioUrl: config.lmStudioUrl || DEFAULT_SEMANTIC_CONFIG.lmStudioUrl,
      modelName: config.modelName || DEFAULT_SEMANTIC_CONFIG.modelName
    };

    this.saveConfig();
    console.log('[SemanticSearch] Configuration updated:', this.config);
  }

  getConfig() {
    return { ...this.config };
  }

  clearConfig() {
    this.config = { ...DEFAULT_SEMANTIC_CONFIG };
    this.isReady = false;
    this.embedder = null;
    this.vectorIndex = [];
    StorageManager.remove('semantic-embedding-config');
    console.log('[SemanticSearch] Config cleared');
  }

  async embedViaLMStudio(text) {
    const { lmStudioUrl, modelName } = this.config;
    const url = `${lmStudioUrl}/v1/embeddings`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: modelName,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LM Studio API 错误 (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('LM Studio 返回格式错误');
      }

      return new Float32Array(data.data[0].embedding);
    } catch (error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error(`无法连接到 LM Studio (${lmStudioUrl})，请确保 LM Studio 正在运行并已启动本地服务器`);
      }
      throw error;
    }
  }

  async initialize(onProgress) {
    if (this.isReady) return true;
    if (this.isLoading) return false;

    this.isLoading = true;
    this.onProgressCallback = onProgress;

    const { provider } = this.config;

    try {
      if (provider === 'lmstudio') {
        return await this.initializeLMStudio(onProgress);
      } else {
        return await this.initializeTransformers(onProgress);
      }
    } catch (error) {
      console.error('[SemanticSearch] Initialization failed:', error);
      this.isLoading = false;

      if (this.onProgressCallback) {
        this.onProgressCallback({
          status: 'error',
          progress: 0,
          message: `Initialization failed: ${error.message}`
        });
      }

      return false;
    }
  }

  async initializeLMStudio(onProgress) {
    const { lmStudioUrl, modelName } = this.config;

    console.log('[SemanticSearch] Using LM Studio backend');
    console.log('[SemanticSearch] API URL:', lmStudioUrl);
    console.log('[SemanticSearch] Model name:', modelName);

    if (onProgress) {
      onProgress({
        status: 'loading',
        progress: 30,
        message: `Connecting to LM Studio (${lmStudioUrl})...`
      });
    }

    try {
      const testEmbedding = await this.embedViaLMStudio('test connection');
      console.log('[SemanticSearch] LM Studio connected successfully, vector dimension:', testEmbedding.length);

      if (onProgress) {
        onProgress({
          status: 'loading',
          progress: 100,
          message: `LM Studio connected (dimension: ${testEmbedding.length})`
        });
      }

      this.isReady = true;
      this.isLoading = false;

      if (onProgress) {
        onProgress({
          status: 'ready',
          progress: 100,
          message: `Connected to LM Studio (${modelName})`
        });
      }

      return true;
    } catch (error) {
      this.isLoading = false;
      throw error;
    }
  }

  async initializeTransformers(onProgress) {
    console.log('[SemanticSearch] Using Transformers.js backend');

    const modelConfig = {
      model: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
      localModelPath: null,
    };

    const modelPath = modelConfig.localModelPath || modelConfig.model;
    console.log('[SemanticSearch] Using model:', modelPath);

    this.embedder = await pipeline(
      'feature-extraction',
      modelPath,
      {
        progress_callback: (progress) => {
          console.log('[SemanticSearch] Progress update:', progress);

          if (progress.status === 'initiate') {
            if (this.onProgressCallback) {
              this.onProgressCallback({
                status: 'loading',
                progress: 0,
                message: `Preparing to download: ${progress.file}...`
              });
            }
          } else if (progress.status === 'download') {
            const percent = progress.progress || 0;
            if (this.onProgressCallback) {
              this.onProgressCallback({
                status: 'loading',
                progress: percent,
                message: `Downloading: ${progress.file} (${percent.toFixed(1)}%)`
              });
            }
          } else if (progress.status === 'progress') {
            this.loadProgress = Math.round(progress.progress || 0);
            if (this.onProgressCallback) {
              this.onProgressCallback({
                status: 'loading',
                progress: this.loadProgress,
                message: `Loading model... ${this.loadProgress}%`
              });
            }
          } else if (progress.status === 'done') {
            if (this.onProgressCallback) {
              this.onProgressCallback({
                status: 'loading',
                progress: 100,
                message: `File loaded: ${progress.file}`
              });
            }
          }
        }
      }
    );

    console.log('[SemanticSearch] Testing model...');
    if (this.onProgressCallback) {
      this.onProgressCallback({
        status: 'loading',
        progress: 95,
        message: 'Testing model...'
      });
    }

    await this.embedder('test', { pooling: 'mean', normalize: true });

    this.isReady = true;
    this.isLoading = false;
    console.log('[SemanticSearch] Transformers.js model loaded successfully');

    if (this.onProgressCallback) {
      this.onProgressCallback({
        status: 'ready',
        progress: 100,
        message: 'Model loaded successfully'
      });
    }

    return true;
  }

  async embed(text) {
    if (!this.isReady) {
      throw new Error('Model not initialized');
    }

    const truncatedText = text.slice(0, 1500);
    const { provider } = this.config;

    if (provider === 'lmstudio') {
      return await this.embedViaLMStudio(truncatedText);
    } else {
      if (!this.embedder) {
        throw new Error('Transformers.js model not loaded');
      }
      const output = await this.embedder(truncatedText, {
        pooling: 'mean',
        normalize: true
      });
      return output.data;
    }
  }

  async buildIndex(messages, onProgress) {
    if (!this.isReady) {
      await this.initialize(onProgress);
    }

    this.vectorIndex = [];
    const total = messages.length;
    let processed = 0;

    console.log(`[SemanticSearch] Building index for ${total} messages`);

    const batchSize = this.config.provider === 'lmstudio' ? 5 : 10;

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      await Promise.all(batch.map(async (msg) => {
        try {
          const embedding = await this.embed(msg.content);
          this.vectorIndex.push({
            id: msg.id,
            embedding: embedding,
            content: msg.content,
            metadata: msg.metadata
          });
        } catch (error) {
          console.error(`[SemanticSearch] Failed to vectorize (${msg.id}):`, error);
          console.error('[SemanticSearch] Message content:', msg.content?.substring(0, 100));
        }
      }));

      processed += batch.length;
      if (onProgress) {
        onProgress({
          status: 'indexing',
          progress: Math.round((processed / total) * 100),
          message: `Indexing... ${processed}/${total}`
        });
      }
    }

    console.log(`[SemanticSearch] Index built: ${this.vectorIndex.length} messages`);

    if (onProgress) {
      onProgress({
        status: 'indexed',
        progress: 100,
        message: `Index complete: ${this.vectorIndex.length} messages`
      });
    }

    return this.vectorIndex.length;
  }

  cosineSimilarity(a, b) {
    const len = Math.min(a.length, b.length);

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < len; i++) {
      dotProduct += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  async search(query, topK = 5) {
    if (!this.isReady || this.vectorIndex.length === 0) {
      return [];
    }

    const queryEmbedding = await this.embed(query);

    const results = this.vectorIndex.map(doc => ({
      ...doc,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding)
    }));

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK).map(r => ({
      id: r.id,
      content: r.content,
      metadata: r.metadata,
      score: r.score
    }));
  }

  getStats() {
    return {
      isReady: this.isReady,
      isLoading: this.isLoading,
      indexSize: this.vectorIndex.length,
      loadProgress: this.loadProgress,
      provider: this.config.provider,
      lmStudioUrl: this.config.lmStudioUrl,
      modelName: this.config.modelName
    };
  }

  clear() {
    this.vectorIndex = [];
  }

  reset() {
    this.embedder = null;
    this.isLoading = false;
    this.isReady = false;
    this.vectorIndex = [];
    this.loadProgress = 0;
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 从 globalSearchManager 的索引中提取消息用于语义搜索
 */
export function extractMessagesForSemantic(globalSearchManager) {
  const messages = [];

  globalSearchManager.messageIndex.forEach((data, messageId) => {
    if (data.message.isBlank) return;

    messages.push({
      id: messageId,
      content: data.searchableText || data.message.content || '',
      metadata: {
        fileIndex: data.fileIndex,
        fileName: data.fileName,
        conversationUuid: data.conversationUuid,
        conversationName: data.conversationName,
        messageIndex: data.messageIndex,
        messageUuid: data.messageUuid,
        sender: data.message.sender,
        timestamp: data.message.timestamp,
        hasThinking: data.hasThinking,
        hasArtifacts: data.hasArtifacts
      }
    });
  });

  return messages;
}

// ============================================================================
// 单例导出 (向后兼容)
// ============================================================================

let localSearchInstance = null;
let globalSearchInstance = null;
let semanticSearchInstance = null;

export function getLocalSearchManager() {
  if (!localSearchInstance) {
    localSearchInstance = new LocalSearch();
  }
  return localSearchInstance;
}

export function getGlobalSearchManager() {
  if (!globalSearchInstance) {
    globalSearchInstance = new GlobalSearch();
  }
  return globalSearchInstance;
}

export function getSemanticSearchManager() {
  if (!semanticSearchInstance) {
    semanticSearchInstance = new SemanticSearch();
  }
  return semanticSearchInstance;
}

// 向后兼容的类名导出
export { LocalSearch as SearchManager };
export { GlobalSearch as GlobalSearchManager };
export { SemanticSearch as SemanticSearchManager };

// 向后兼容的高亮函数导出
export { highlightText as highlightSearchText };
