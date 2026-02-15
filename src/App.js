// App.js - 大幅简化版本
/* global chrome */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import './styles/index.css';

// 组件导入
import WelcomePage from './components/WelcomePage';
import MessageDetail from './components/MessageDetail';
import ConversationTimeline from './components/ConversationTimeline';
import FullExportCardFilter from './components/FullExportCardFilter';
import FloatingActionButton from './components/FloatingActionButton';
import SettingsPanel from './components/SettingsManager';
import ActionPanel from './components/ActionPanel';
import ScreenshotPreviewPanel from './components/ScreenshotPreviewPanel';
import { CardGrid } from './components/UnifiedCard';

// 工具函数导入
import { ThemeUtils } from './utils/themeManager';
import { PostMessageHandler, StatsCalculator, DataProcessor } from './utils/data';
import { extractChatData, detectBranches, parseJSONL, extractMergedJSONLData } from './utils/fileParser';
import {
  generateFileCardUuid,
  generateConversationCardUuid,
  parseUuid,
  getCurrentFileUuid,
  generateFileHash
} from './utils/data/uuidManager';
import { MarkManager, getAllMarksStats } from './utils/data/markManager';
import { StarManager } from './utils/data/starManager';
import { SortManager } from './utils/data/sortManager';
import { SearchManager } from './utils/searchManager';
import StorageManager from './utils/storageManager';
import PersistentFileStore from './utils/persistentFileStore';

import EnhancedSearchBox from './components/EnhancedSearchBox';
import { getGlobalSearchManager } from './utils/globalSearchManager';
import { getRenameManager } from './utils/renameManager';
import { useI18n } from './index.js';

// AI Chat 浮窗组件
import { FloatPanel, FloatPanelTrigger, initLyraAIChat, chatService } from './ai-chat';
import './ai-chat/styles.css';

// ==================== 通用工具类 ====================

/**
 * Storage 工具类 - 使用 StorageManager
 * 保持向后兼容的 API
 */
export const StorageUtils = {
  getLocalStorage(key, defaultValue = null) {
    // 移除 lyra_ 前缀（如果存在），因为 StorageManager 会自动添加
    const cleanKey = key.startsWith('lyra_') ? key.substring(5) : key;
    return StorageManager.get(cleanKey, defaultValue);
  },

  setLocalStorage(key, value) {
    // 移除 lyra_ 前缀（如果存在），因为 StorageManager 会自动添加
    const cleanKey = key.startsWith('lyra_') ? key.substring(5) : key;
    return StorageManager.set(cleanKey, value);
  }
};

/**
 * Validation 工具类 - 验证跨窗口通信来源
 */
export const ValidationUtils = {
  isAllowedOrigin(origin) {
    const allowedOrigins = [
      'https://claude.ai',
      'https://claude.easychat.top',
      'https://pro.easychat.top',
      'https://chatgpt.com',
      'https://chat.openai.com',
      'https://grok.com',
      'https://x.com',
      'https://gemini.google.com',
      'https://aistudio.google.com',
      'http://localhost:3789',
      'https://yalums.github.io'
    ];
    return allowedOrigins.some(allowed => origin === allowed) ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1');
  }
};

// ==================== 内联的 Hooks ====================

/**
 * useFullExportCardFilter - 卡片筛选Hook
 */
const useFullExportCardFilter = (conversations = [], operatedUuids = new Set()) => {
  const [filters, setFilters] = useState({
    name: '',
    dateRange: 'all',
    customDateStart: '',
    customDateEnd: '',
    project: 'all',
    starred: 'all',
    operated: 'all'
  });

  // 获取所有可用的项目
  const availableProjects = useMemo(() => {
    const projects = new Map();
    conversations.forEach(conv => {
      if (conv.project && conv.project.uuid) {
        projects.set(conv.project.uuid, conv.project);
      }
    });
    return Array.from(projects.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [conversations]);

  // 筛选逻辑
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      // 名称筛选
      if (filters.name.trim()) {
        const nameMatch = conv.name?.toLowerCase().includes(filters.name.toLowerCase());
        const projectMatch = conv.project?.name?.toLowerCase().includes(filters.name.toLowerCase());
        if (!nameMatch && !projectMatch) return false;
      }

      // 项目筛选
      if (filters.project !== 'all') {
        if (filters.project === 'no_project') {
          if (conv.project && conv.project.uuid) return false;
        } else {
          if (!conv.project || conv.project.uuid !== filters.project) return false;
        }
      }

      // 星标筛选
      if (filters.starred !== 'all') {
        if (filters.starred === 'starred' && !conv.is_starred) return false;
        if (filters.starred === 'unstarred' && conv.is_starred) return false;
      }

      // 操作状态筛选
      if (filters.operated !== 'all') {
        const isOperated = operatedUuids.has(conv.uuid);
        if (filters.operated === 'operated' && !isOperated) return false;
        if (filters.operated === 'unoperated' && isOperated) return false;
      }

      // 日期筛选
      if (filters.dateRange !== 'all' && conv.created_at) {
        try {
          const convDate = new Date(conv.created_at);
          const now = new Date();
          switch (filters.dateRange) {
            case 'today':
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const convDay = new Date(convDate.getFullYear(), convDate.getMonth(), convDate.getDate());
              if (convDay.getTime() !== today.getTime()) return false;
              break;
            case 'week':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              if (convDate < weekAgo) return false;
              break;
            case 'month':
              const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              if (convDate < monthAgo) return false;
              break;
            case 'custom':
              if (filters.customDateStart) {
                const startDate = new Date(filters.customDateStart);
                if (convDate < startDate) return false;
              }
              if (filters.customDateEnd) {
                const endDate = new Date(filters.customDateEnd + 'T23:59:59');
                if (convDate > endDate) return false;
              }
              break;
          }
        } catch (error) {
          console.warn('日期解析失败:', conv.created_at);
        }
      }

      return true;
    });
  }, [conversations, filters, operatedUuids]);

  // 设置单个筛选器
  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // 批量设置筛选器
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // 重置筛选器
  const resetFilters = useCallback(() => {
    setFilters({
      name: '',
      dateRange: 'all',
      customDateStart: '',
      customDateEnd: '',
      project: 'all',
      starred: 'all',
      operated: 'all'
    });
  }, []);

  // 获取筛选统计
  const filterStats = useMemo(() => {
    const hasActiveFilters = filters.name.trim() ||
      filters.dateRange !== 'all' ||
      filters.project !== 'all' ||
      filters.starred !== 'all' ||
      filters.operated !== 'all';
    return {
      total: conversations.length,
      filtered: filteredConversations.length,
      hasActiveFilters,
      activeFilterCount: [
        filters.name.trim(),
        filters.dateRange !== 'all',
        filters.project !== 'all',
        filters.starred !== 'all',
        filters.operated !== 'all'
      ].filter(Boolean).length
    };
  }, [conversations.length, filteredConversations.length, filters]);

  // 获取筛选器摘要文本
  const getFilterSummary = useCallback(() => {
    const parts = [];
    if (filters.name.trim()) {
      parts.push(`名称: "${filters.name}"`);
    }
    if (filters.dateRange !== 'all') {
      const dateLabels = {
        today: '今天',
        week: '最近一周',
        month: '最近一月',
        custom: '自定义时间'
      };
      parts.push(`时间: ${dateLabels[filters.dateRange] || filters.dateRange}`);
    }
    if (filters.project !== 'all') {
      if (filters.project === 'no_project') {
        parts.push('项目: 无项目');
      } else {
        const project = availableProjects.find(p => p.uuid === filters.project);
        parts.push(`项目: ${project?.name || '未知项目'}`);
      }
    }
    if (filters.starred !== 'all') {
      parts.push(`星标: ${filters.starred === 'starred' ? '已星标' : '未星标'}`);
    }
    if (filters.operated !== 'all') {
      parts.push(`操作: ${filters.operated === 'operated' ? '有过操作' : '未操作'}`);
    }
    return parts.join(', ');
  }, [filters, availableProjects]);

  return {
    filters,
    filteredConversations,
    availableProjects,
    filterStats,
    actions: {
      setFilter,
      updateFilters,
      resetFilters,
      getFilterSummary
    }
  };
};

/**
 * useFileManager - 文件管理Hook
 */
const useFileManager = () => {
  const [files, setFiles] = useState([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [processedData, setProcessedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydratingPersistedFiles, setIsHydratingPersistedFiles] = useState(true);
  const [error, setError] = useState(null);
  const [showTypeConflictModal, setShowTypeConflictModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [fileMetadata, setFileMetadata] = useState({});
  const hasHydratedPersistedFilesRef = useRef(false);

  // 智能解析文件（JSON或JSONL）
  const parseFile = useCallback(async (file) => {
    const text = await file.text();
    const isJSONL = file.name.endsWith('.jsonl') || (text.includes('\n{') && !text.trim().startsWith('['));
    return isJSONL ? parseJSONL(text) : JSON.parse(text);
  }, []);

  const buildFileMetadata = useCallback(async (file) => {
    try {
      const data = extractChatData(await parseFile(file), file.name);
      return {
        format: data.format,
        platform: data.platform || data.format,
        messageCount: data.chat_history?.length || 0,
        conversationCount: data.format === 'claude_full_export' ?
          (data.views?.conversationList?.length || 0) : 1,
        title: data.meta_info?.title || file.name,
        model: data.meta_info?.model || '',
        created_at: data.meta_info?.created_at,
        updated_at: data.meta_info?.updated_at
      };
    } catch (err) {
      console.warn(`提取元数据失败 ${file.name}:`, err);
      return {
        format: 'unknown',
        messageCount: 0,
        title: file.name
      };
    }
  }, [parseFile]);

  // 启动时恢复缓存文件（解决刷新后文件丢失）
  useEffect(() => {
    let cancelled = false;

    const hydratePersistedFiles = async () => {
      try {
        const restoredFiles = await PersistentFileStore.loadAll();
        if (cancelled || restoredFiles.length === 0) return;

        const restoredMetadata = {};
        for (const file of restoredFiles) {
          restoredMetadata[file.name] = await buildFileMetadata(file);
        }

        if (cancelled) return;

        setFiles(restoredFiles);
        setFileMetadata(restoredMetadata);
        setCurrentFileIndex(0);
        setError(null);
        console.log(`[Lyra] 已恢复 ${restoredFiles.length} 个缓存文件`);
      } catch (err) {
        console.warn('[Lyra] 恢复缓存文件失败:', err);
      } finally {
        if (!cancelled) {
          hasHydratedPersistedFilesRef.current = true;
          setIsHydratingPersistedFiles(false);
        }
      }
    };

    hydratePersistedFiles();

    return () => {
      cancelled = true;
    };
  }, [buildFileMetadata]);

  // 文件变更时写入缓存
  useEffect(() => {
    if (!hasHydratedPersistedFilesRef.current) return;

    let cancelled = false;

    const persistFiles = async () => {
      try {
        await PersistentFileStore.replaceAll(files);
      } catch (err) {
        if (!cancelled) {
          console.warn('[Lyra] 持久化文件失败:', err);
        }
      }
    };

    persistFiles();

    return () => {
      cancelled = true;
    };
  }, [files]);

  // 处理当前文件
  const processCurrentFile = useCallback(async () => {
    if (!files.length || currentFileIndex >= files.length) {
      setProcessedData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const file = files[currentFileIndex];

      // 检查是否有预处理的合并数据
      if (file._mergedProcessedData) {
        console.log('[Lyra] 使用预处理的合并数据');
        setProcessedData(file._mergedProcessedData);
      } else {
        const jsonData = await parseFile(file);
        let data = extractChatData(jsonData, file.name);
        data = detectBranches(data);
        setProcessedData(data);
      }
    } catch (err) {
      console.error('处理文件出错:', err);
      setError(err.message);
      setProcessedData(null);
    } finally {
      setIsLoading(false);
    }
  }, [files, currentFileIndex, parseFile]);

  useEffect(() => {
    processCurrentFile();
  }, [processCurrentFile]);

  // 检查文件兼容性
  const checkCompatibility = useCallback(async (newFiles) => {
    if (!files.length) return true;
    try {
      const newData = extractChatData(await parseFile(newFiles[0]), newFiles[0].name);
      const curData = extractChatData(await parseFile(files[currentFileIndex]), files[currentFileIndex].name);
      const isNewFull = newData.format === 'claude_full_export';
      const isCurFull = curData.format === 'claude_full_export';
      return !(isNewFull !== isCurFull);
    } catch {
      return true;
    }
  }, [files, currentFileIndex, parseFile]);

  // 加载文件
  const loadFiles = useCallback(async (fileList) => {
    const validFiles = fileList.filter(f =>
      f.name.endsWith('.json') || f.name.endsWith('.jsonl') || f.type === 'application/json'
    );
    if (!validFiles.length) {
      setError('未找到有效的JSON/JSONL文件');
      return;
    }
    const newFiles = validFiles.filter(nf =>
      !files.some(ef => ef.name === nf.name && ef.lastModified === nf.lastModified)
    );
    if (!newFiles.length) {
      setError('文件已加载');
      return;
    }
    const isCompatible = await checkCompatibility(newFiles);
    if (!isCompatible) {
      setPendingFiles(newFiles);
      setShowTypeConflictModal(true);
      return;
    }
    const newMeta = {};
    for (const file of newFiles) {
      newMeta[file.name] = await buildFileMetadata(file);
    }
    setFileMetadata(prev => ({ ...prev, ...newMeta }));
    setFiles(prev => [...prev, ...newFiles]);
    setError(null);
  }, [files, checkCompatibility, buildFileMetadata]);

  const upsertFile = useCallback(async (file, options = {}) => {
    if (!file || typeof file.name !== 'string') {
      setError('无效文件');
      return false;
    }

    const upsertKey = typeof options.upsertKey === 'string' ? options.upsertKey.trim() : '';
    if (upsertKey) {
      file._lyraUpsertKey = upsertKey;
    }
    if (options.syncedAt) {
      file._lyraSyncedAt = options.syncedAt;
    }

    const metadata = await buildFileMetadata(file);

    const findIndexByKey = (list) => {
      return list.findIndex(existingFile => {
        const existingKey = existingFile._lyraUpsertKey || '';
        if (upsertKey && existingKey && existingKey === upsertKey) return true;
        if (upsertKey && !existingKey && existingFile.name === file.name) return true;
        if (!upsertKey && existingFile.name === file.name) return true;
        return false;
      });
    };

    const previousIndex = findIndexByKey(files);
    const previousName = previousIndex >= 0 ? files[previousIndex].name : null;

    setFiles(prev => {
      const idx = findIndexByKey(prev);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = file;
        return next;
      }
      return [...prev, file];
    });

    setFileMetadata(prev => {
      const next = { ...prev };
      if (previousName && previousName !== file.name) {
        delete next[previousName];
      }
      next[file.name] = metadata;
      return next;
    });

    if (files.length === 0) {
      setCurrentFileIndex(0);
    }
    setError(null);
    return true;
  }, [files, buildFileMetadata]);

  // 按对话分组（基于 integrity, main_chat, 或 chat_id_hash）
  const groupByConversation = useCallback((filesData) => {
    const groups = new Map();

    // 建立多种映射，用于分支文件查找主文件
    const fileNameToIntegrity = new Map();      // 文件名 -> integrity
    const integrityToGroup = new Map();         // integrity -> groupKey
    const chatIdHashToGroup = new Map();        // chat_id_hash -> groupKey
    const mainChatToGroup = new Map();          // main_chat 值 -> groupKey

    console.log('[Lyra] 开始分组，共', filesData.length, '个文件');

    // 第一遍：收集所有主文件的信息
    filesData.forEach(fd => {
      const metadata = fd.data[0]?.chat_metadata;
      const integrity = metadata?.integrity;
      const mainChat = metadata?.main_chat;
      const chatIdHash = metadata?.chat_id_hash;

      console.log('[Lyra] 文件:', fd.fileName, {
        integrity: integrity?.substring(0, 16) + '...',
        mainChat,
        chatIdHash
      });

      // 如果没有 main_chat，说明是主文件
      if (!mainChat) {
        // 使用文件名（不含扩展名）作为键
        const baseName = fd.fileName.replace(/\.(jsonl|json)$/i, '');

        // 为主文件创建分组键（优先使用 integrity）
        const groupKey = integrity || chatIdHash?.toString() || fd.fileName;

        if (integrity) {
          fileNameToIntegrity.set(baseName, integrity);
          fileNameToIntegrity.set(fd.fileName, integrity);
          integrityToGroup.set(integrity, groupKey);
        }

        if (chatIdHash) {
          chatIdHashToGroup.set(chatIdHash, groupKey);
        }

        // 记录文件名到分组的映射（用于 main_chat 查找）
        mainChatToGroup.set(baseName, groupKey);
        mainChatToGroup.set(fd.fileName, groupKey);
      }
    });

    console.log('[Lyra] 主文件映射:', {
      fileNameToIntegrity: Array.from(fileNameToIntegrity.keys()),
      mainChatToGroup: Array.from(mainChatToGroup.keys())
    });

    // 第二遍：分组
    filesData.forEach(fd => {
      const metadata = fd.data[0]?.chat_metadata;
      const integrity = metadata?.integrity;
      const mainChat = metadata?.main_chat;
      const chatIdHash = metadata?.chat_id_hash;

      let groupKey = null;
      let matchMethod = '';

      if (mainChat) {
        // 分支文件：尝试多种方式查找主文件

        // 方法1：直接通过 main_chat 查找
        if (mainChatToGroup.has(mainChat)) {
          groupKey = mainChatToGroup.get(mainChat);
          matchMethod = 'main_chat直接匹配';
        }
        // 方法2：main_chat + .jsonl 扩展名
        else if (mainChatToGroup.has(mainChat + '.jsonl')) {
          groupKey = mainChatToGroup.get(mainChat + '.jsonl');
          matchMethod = 'main_chat+.jsonl';
        }
        // 方法3：通过 integrity 查找（分支文件可能有相同的 integrity）
        else if (integrity && integrityToGroup.has(integrity)) {
          groupKey = integrityToGroup.get(integrity);
          matchMethod = 'integrity匹配';
        }
        // 方法4：通过 chat_id_hash 查找
        else if (chatIdHash && chatIdHashToGroup.has(chatIdHash)) {
          groupKey = chatIdHashToGroup.get(chatIdHash);
          matchMethod = 'chat_id_hash匹配';
        }
        // 方法5：如果都找不到，使用 main_chat 本身作为分组键
        else {
          groupKey = mainChat;
          matchMethod = 'main_chat作为新组';
          // 同时注册这个分组，以便后续分支文件可以找到
          mainChatToGroup.set(mainChat, groupKey);
          if (integrity) integrityToGroup.set(integrity, groupKey);
          if (chatIdHash) chatIdHashToGroup.set(chatIdHash, groupKey);
        }
      } else {
        // 主文件
        if (integrity && integrityToGroup.has(integrity)) {
          groupKey = integrityToGroup.get(integrity);
          matchMethod = '主文件-integrity';
        } else if (chatIdHash && chatIdHashToGroup.has(chatIdHash)) {
          groupKey = chatIdHashToGroup.get(chatIdHash);
          matchMethod = '主文件-chat_id_hash';
        } else {
          groupKey = integrity || chatIdHash?.toString() || fd.fileName;
          matchMethod = '主文件-新组';
        }
      }

      console.log('[Lyra] 分组:', fd.fileName, '->', groupKey?.substring?.(0, 20) || groupKey, `(${matchMethod})`);

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(fd);
    });

    const result = Array.from(groups.values());
    console.log('[Lyra] 分组结果:', result.map(g => ({
      count: g.length,
      files: g.map(f => f.fileName)
    })));

    return result;
  }, []);

  // 加载并合并 JSONL 文件夹
  const loadMergedJSONLFiles = useCallback(async (fileList) => {
    const jsonlFiles = fileList.filter(f =>
      f.name.endsWith('.jsonl') || f.name.endsWith('.json')
    );

    if (jsonlFiles.length === 0) {
      setError('未找到 JSONL/JSON 文件');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 读取所有文件内容
      const filesData = await Promise.all(
        jsonlFiles.map(async (file) => ({
          file,
          fileName: file.name,
          data: await parseFile(file)
        }))
      );

      // 按对话分组
      const grouped = groupByConversation(filesData);

      // 处理每组文件
      for (const group of grouped) {
        if (group.length === 1) {
          // 单文件：使用普通加载
          await loadFiles([group[0].file]);
        } else {
          // 多文件：使用合并加载
          try {
            const mergedData = extractMergedJSONLData(group);
            const processedMergedData = detectBranches(mergedData);

            // 创建一个虚拟文件对象来表示合并后的数据
            const mergedFileName = `[合并] ${mergedData.meta_info?.title || '对话'}`;
            const virtualFile = new File(
              [JSON.stringify(mergedData.raw_data)],
              mergedFileName,
              { type: 'application/json' }
            );

            // 添加元数据
            const newMeta = {
              [mergedFileName]: {
                format: mergedData.format,
                platform: mergedData.platform || mergedData.format,
                messageCount: mergedData.chat_history?.length || 0,
                conversationCount: 1,
                title: mergedData.meta_info?.title || mergedFileName,
                model: mergedData.meta_info?.model || '',
                created_at: mergedData.meta_info?.created_at,
                updated_at: mergedData.meta_info?.updated_at,
                isMerged: true,
                mergeInfo: mergedData.meta_info?.merge_info
              }
            };

            setFileMetadata(prev => ({ ...prev, ...newMeta }));

            // 存储预处理的数据，避免重复解析
            virtualFile._mergedProcessedData = processedMergedData;

            setFiles(prev => [...prev, virtualFile]);
          } catch (err) {
            console.error('合并文件失败:', err);
            // 如果合并失败，回退到单独加载
            for (const fd of group) {
              await loadFiles([fd.file]);
            }
          }
        }
      }

      setError(null);
    } catch (err) {
      console.error('加载文件夹失败:', err);
      setError(`加载文件夹失败: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [parseFile, groupByConversation, loadFiles]);

  const confirmReplaceFiles = useCallback(() => {
    setFiles(pendingFiles);
    setCurrentFileIndex(0);
    setPendingFiles([]);
    setShowTypeConflictModal(false);
    setError(null);
  }, [pendingFiles]);

  const cancelReplaceFiles = useCallback(() => {
    setPendingFiles([]);
    setShowTypeConflictModal(false);
  }, []);

  const removeFile = useCallback((index) => {
    const toRemove = files[index];
    if (toRemove) {
      setFileMetadata(prev => {
        const { [toRemove.name]: _, ...rest } = prev;
        return rest;
      });
    }
    setFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      if (!newFiles.length) setCurrentFileIndex(0);
      else if (index <= currentFileIndex && currentFileIndex > 0) {
        setCurrentFileIndex(currentFileIndex - 1);
      }
      return newFiles;
    });
  }, [currentFileIndex, files]);

  const switchFile = useCallback((index) => {
    if (index >= 0 && index < files.length) {
      setCurrentFileIndex(index);
    }
  }, [files.length]);

  const reorderFiles = useCallback((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setFiles(prev => {
      const newFiles = [...prev];
      const [moved] = newFiles.splice(fromIdx, 1);
      newFiles.splice(toIdx, 0, moved);
      if (fromIdx === currentFileIndex) setCurrentFileIndex(toIdx);
      else if (fromIdx < currentFileIndex && toIdx >= currentFileIndex) {
        setCurrentFileIndex(currentFileIndex - 1);
      } else if (fromIdx > currentFileIndex && toIdx <= currentFileIndex) {
        setCurrentFileIndex(currentFileIndex + 1);
      }
      return newFiles;
    });
  }, [currentFileIndex]);

  const actions = useMemo(() => ({
    loadFiles,
    upsertFile,
    loadMergedJSONLFiles,
    removeFile,
    switchFile,
    reorderFiles,
    confirmReplaceFiles,
    cancelReplaceFiles
  }), [loadFiles, upsertFile, loadMergedJSONLFiles, removeFile, switchFile, reorderFiles, confirmReplaceFiles, cancelReplaceFiles]);

  return {
    files,
    currentFile: files[currentFileIndex] || null,
    currentFileIndex,
    processedData,
    isLoading,
    isHydratingPersistedFiles,
    error,
    showTypeConflictModal,
    pendingFiles,
    fileMetadata,
    actions
  };
};

function App() {
  // ==================== Hooks和状态管理 ====================
  // 检测是否在 Chrome 扩展环境中
  const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

  // i18n
  const { t, currentLanguage } = useI18n();

  const {
    files,
    currentFile,
    currentFileIndex,
    processedData,
    isHydratingPersistedFiles,
    showTypeConflictModal,
    pendingFiles,
    fileMetadata,
    actions: fileActions
  } = useFileManager();

  // 状态管理
  const [selectedMessageIndex, setSelectedMessageIndex] = useState(null);
  const [activeTab, setActiveTab] = useState('content');
  const [showActionPanel, setShowActionPanel] = useState(false);
  const [actionPanelSection, setActionPanelSection] = useState('globalSearch');
  const [initialSearchQuery, setInitialSearchQuery] = useState('');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState({
    isOpen: false,
    data: null
  });
  const [viewMode, setViewMode] = useState('conversations');
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);
  const [selectedConversationUuid, setSelectedConversationUuid] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [hideNavbar, setHideNavbar] = useState(false); // 新增：控制导航栏显示
  const [deviceMode, setDeviceMode] = useState(() =>
    StorageUtils.getLocalStorage('device-mode', 'auto')
  ); // 设备模式：'auto' | 'mobile' | 'desktop'
  const [isMobile, setIsMobile] = useState(() => {
    const mode = StorageUtils.getLocalStorage('device-mode', 'auto');
    if (mode === 'mobile') return true;
    if (mode === 'desktop') return false;
    return window.innerWidth < 1024;
  }); // 移动端检测（统一断点：< 1024px）
  const [showMobileDetail, setShowMobileDetail] = useState(false); // 移动端详情显示状态
  const [operatedFiles, setOperatedFiles] = useState(new Set());
  const [scrollPositions, setScrollPositions] = useState({});
  const [error, setError] = useState(null);
  const [sortVersion, setSortVersion] = useState(0);
  const [markVersion, setMarkVersion] = useState(0);
  const [renameVersion, setRenameVersion] = useState(0);
  const [starredConversations, setStarredConversations] = useState(new Map());
  const [currentBranchState, setCurrentBranchState] = useState({
    showAllBranches: false,
    currentBranchIndexes: new Map()
  });
  const [timelineDisplayMessages, setTimelineDisplayMessages] = useState([]); // 新增：存储时间线中实际显示的消息（经过分支过滤）
  const [exportOptions, setExportOptions] = useState(() => {
    const savedExportConfig = StorageUtils.getLocalStorage('export-config', {});
    return {
      scope: 'currentBranch',
      exportFormat: 'markdown', // 新增：导出格式（markdown 或 screenshot）
      excludeDeleted: true,
      includeCompleted: false,
      includeImportant: false,
      includeTimestamps: savedExportConfig.includeTimestamps || false,
      includeThinking: savedExportConfig.includeThinking || false,
      includeArtifacts: savedExportConfig.includeArtifacts !== undefined ? savedExportConfig.includeArtifacts : true,
      includeTools: savedExportConfig.includeTools || false,
      includeCitations: savedExportConfig.includeCitations || false,
      includeAttachments: savedExportConfig.includeAttachments !== undefined ? savedExportConfig.includeAttachments : true,
      includeImageFiles: savedExportConfig.includeImageFiles !== undefined ? savedExportConfig.includeImageFiles : false
    };
  });

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ results: [], filteredMessages: [] });

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const contentAreaRef = useRef(null);

  // 管理器实例引用
  const markManagerRef = useRef(null);
  const starManagerRef = useRef(null);
  const sortManagerRef = useRef(null);

  // ==================== 管理器初始化 ====================

  // UUID管理
  const currentFileUuid = useMemo(() => {
    return getCurrentFileUuid(viewMode, selectedFileIndex, selectedConversationUuid, processedData, files);
  }, [viewMode, selectedFileIndex, selectedConversationUuid, processedData, files]);

  // 星标系统
  const shouldUseStarSystem = processedData?.format === 'claude_full_export';

  useEffect(() => {
    if (shouldUseStarSystem) {
      if (!starManagerRef.current) {
        starManagerRef.current = new StarManager(true);
      }
      // 同步星标状态到state
      setStarredConversations(new Map(starManagerRef.current.getStarredConversations()));
    } else {
      starManagerRef.current = null;
      setStarredConversations(new Map());
    }
  }, [shouldUseStarSystem]);

  useEffect(() => {
    if (currentFileUuid) {
      markManagerRef.current = new MarkManager(currentFileUuid);
    }
  }, [currentFileUuid]);

  // 集中化构建全局搜索索引
  useEffect(() => {
    if (files.length > 0) {
      // 使用 setTimeout 来避免阻塞主线程
      const timer = setTimeout(() => {
        console.log('[App] 正在构建全局搜索索引...');
        const globalSearchManager = getGlobalSearchManager();
        const renameManager = getRenameManager();
        const customNames = renameManager.getAllRenames();

        globalSearchManager.buildGlobalIndex(files, processedData, currentFileIndex, customNames)
          .then(() => {
            console.log('[App] 全局搜索索引已更新');
          })
          .catch(err => {
            console.error('[App] 构建全局搜索索引失败:', err);
          });
      }, 200); // 延迟执行，等待状态稳定

      return () => clearTimeout(timer);
    }
  }, [files, processedData, currentFileIndex]);


  // 监听窗口大小变化，根据设备模式更新移动端状态
  useEffect(() => {
    const handleResize = () => {
      // 只有在自动模式下才响应窗口大小变化
      if (deviceMode === 'auto') {
        setIsMobile(window.innerWidth < 1024);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [deviceMode]);

  // 监听设备模式变化事件
  useEffect(() => {
    const handleDeviceModeChange = (event) => {
      const newMode = event.detail.deviceMode;
      setDeviceMode(newMode);

      // 根据新模式更新 isMobile 状态
      if (newMode === 'mobile') {
        setIsMobile(true);
      } else if (newMode === 'desktop') {
        setIsMobile(false);
      } else {
        // auto 模式：根据当前窗口大小判断
        setIsMobile(window.innerWidth < 1024);
      }
    };

    window.addEventListener('deviceModeChange', handleDeviceModeChange);
    return () => window.removeEventListener('deviceModeChange', handleDeviceModeChange);
  }, []);

  // ==================== History API 导航管理 ====================
  // 使用 ref 保存滚动位置的最新值，避免在 popstate 依赖数组中包含 state
  const scrollPositionsRef = useRef(scrollPositions);
  useEffect(() => {
    scrollPositionsRef.current = scrollPositions;
  }, [scrollPositions]);

  // 初始化 history 状态
  useEffect(() => {
    // 只在首次加载时设置初始状态
    if (!window.history.state) {
      window.history.replaceState(
        { view: 'conversations', initial: true },
        ''
      );
    }
  }, []);

  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state;

      // 忽略 detail 视图的状态变化（由 ConversationTimeline 处理）
      if (state && state.view === 'detail') {
        return;
      }

      if (!state || state.view === 'conversations') {
        setViewMode('conversations');
        setSelectedConversationUuid(null);
        setSelectedFileIndex(null);
        setSearchQuery('');
        setSortVersion(v => v + 1);
        setTimelineDisplayMessages([]);

        // 延迟恢复滚动位置，等待 DOM 更新
        setTimeout(() => {
          if (contentAreaRef.current) {
            const positions = scrollPositionsRef.current;
            const savedPosition = positions['main'] || 0;
            contentAreaRef.current.scrollTop = savedPosition;
          }
        }, 50);
      } else if (state.view === 'timeline') {
        setViewMode('timeline');
        setSelectedFileIndex(state.fileIndex);
        setSelectedConversationUuid(state.convUuid);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ==================== 数据计算 - 使用DataProcessor简化 ====================

  const rawConversations = useMemo(() =>
    DataProcessor.getRawConversations(viewMode, processedData, currentFileIndex, files),
    [viewMode, processedData, currentFileIndex, files, renameVersion]
  );

  const {
    filters,
    filteredConversations,
    availableProjects,
    filterStats,
    actions: filterActions
  } = useFullExportCardFilter(rawConversations, operatedFiles);

  const fileCards = useMemo(() =>
    DataProcessor.getFileCards(viewMode, processedData, files, currentFileIndex, fileMetadata, t),
    [files, currentFileIndex, processedData, fileMetadata, viewMode, t, renameVersion]
  );

  const allCards = useMemo(() => {
    if (viewMode === 'conversations' && processedData?.format === 'claude_full_export') {
      return [...filteredConversations];
    }
    return fileCards;
  }, [viewMode, processedData, filteredConversations, fileCards]);

  const timelineMessages = useMemo(() =>
    DataProcessor.getTimelineMessages(viewMode, selectedFileIndex, currentFileIndex, processedData, selectedConversationUuid),
    [viewMode, processedData, selectedConversationUuid, selectedFileIndex, currentFileIndex]
  );

  // 排序管理器初始化
  useEffect(() => {
    if (currentFileUuid && timelineMessages.length > 0) {
      sortManagerRef.current = new SortManager(timelineMessages, currentFileUuid);
      setSortVersion(v => v + 1);
    } else {
      sortManagerRef.current = null;
    }
  }, [currentFileUuid]);

  useEffect(() => {
    if (sortManagerRef.current && timelineMessages.length > 0 && currentFileUuid) {
      if (sortManagerRef.current.fileUuid === currentFileUuid) {
        sortManagerRef.current.updateMessages(timelineMessages);
        setSortVersion(v => v + 1);
      }
    }
  }, [timelineMessages, currentFileUuid]);

  const sortedMessages = useMemo(() => {
    if (sortManagerRef.current && viewMode === 'timeline' && timelineMessages.length > 0) {
      const sorted = sortManagerRef.current.getSortedMessages();
      if (sorted.length !== timelineMessages.length) {
        return timelineMessages;
      }
      return sorted;
    }
    return timelineMessages;
  }, [timelineMessages, viewMode, sortVersion]);

  const displayedItems = useMemo(() => {
    if (!searchQuery) {
      return viewMode === 'conversations' ? allCards : sortedMessages;
    }
    return searchResults.filteredMessages;
  }, [searchQuery, searchResults.filteredMessages, viewMode, allCards, sortedMessages]);

  const currentMarks = useMemo(() => {
    return markManagerRef.current ? markManagerRef.current.getMarks() : {
      completed: new Set(),
      important: new Set(),
      deleted: new Set()
    };
  }, [markVersion, currentFileUuid]);

  const hasCustomSort = useMemo(() => {
    return sortManagerRef.current ? sortManagerRef.current.hasCustomSort() : false;
  }, [sortVersion, currentFileUuid]);

  const currentConversation = useMemo(() => {
    return DataProcessor.getCurrentConversation({
      viewMode,
      selectedFileIndex,
      selectedConversationUuid,
      processedData,
      files,
      currentFileIndex,
      fileMetadata
    });
  }, [viewMode, selectedFileIndex, selectedConversationUuid, processedData, files, currentFileIndex, fileMetadata, renameVersion]);

  const isFullExportConversationMode = viewMode === 'conversations' && processedData?.format === 'claude_full_export';

  // ==================== AI Chat 集成 ====================

  // 初始化 AI Chat - 从 localStorage 加载配置
  useEffect(() => {
    // 从 localStorage 读取配置（由 SettingsManager 管理）
    const config = StorageManager.get('ai-chat-config');
    if (config) {
      // 配置 chatService
      chatService.configure(config);
      console.log('[App] AI Chat configured from localStorage');
    }

    // 初始化 AI Chat（注册内置 MCP 等）
    initLyraAIChat();
  }, []);

  // 注意：上下文初始化和追踪逻辑已统一移至 ConversationTimeline.js
  // ConversationTimeline 在文件切换时调用 initContext，在分支选择后追踪消息
  // 这样可以避免 setTimeout 导致的时序问题（initContext 在追踪后执行清空上下文）

  // ==================== 事件处理函数 ====================

  const postMessageHandler = useMemo(() => {
    return new PostMessageHandler(fileActions, setError);
  }, [fileActions]);

  const handleFileLoad = (e) => {
    const fileList = Array.from(e.target.files);
    // 检测是否包含JSONL文件，如果是则使用合并加载（支持分支检测）
    const hasJSONL = fileList.some(f => f.name.endsWith('.jsonl'));
    if (hasJSONL) {
      fileActions.loadMergedJSONLFiles(fileList);
    } else {
      fileActions.loadFiles(fileList);
    }
  };

  // 文件夹加载处理
  const handleFolderLoad = (e) => {
    const fileList = Array.from(e.target.files);
    fileActions.loadMergedJSONLFiles(fileList);
  };

  const handleNavigateToMessage = useCallback((navigationData) => {
    const { fileIndex, conversationUuid, messageIndex, messageId, messageUuid, highlight } = navigationData;

    // 记录当前文件索引，用于判断是否需要切换文件
    const needFileSwitch = fileIndex !== selectedFileIndex || fileIndex !== currentFileIndex;

    // 切换到时间线视图
    setViewMode('timeline');

    // 切换文件（如果需要）
    if (needFileSwitch) {
      // 先切换当前文件
      if (fileIndex !== currentFileIndex) {
        fileActions.switchFile(fileIndex);
      }
      setSelectedFileIndex(fileIndex);
    } else if (selectedFileIndex !== fileIndex) {
      setSelectedFileIndex(fileIndex);
    }

    // 设置对话UUID
    if (conversationUuid) {
      // 如果是完整导出格式，需要提取真实的对话UUID
      let realConversationUuid = conversationUuid;
      if (conversationUuid.startsWith('file-')) {
        // 从 file-xxx_uuid 格式中提取UUID
        const parts = conversationUuid.split('_');
        if (parts.length > 1) {
          realConversationUuid = parts.slice(1).join('_');
        }
      }
      setSelectedConversationUuid(realConversationUuid);
    }

    // 通知ConversationTimeline滚动到消息，传递messageId和messageUuid
    // 根据不同情况设置不同延迟
    let delay;
    if (needFileSwitch && fileIndex !== currentFileIndex) {
      // 需要切换文件并加载数据，需要更长延迟
      delay = 1000;
    } else if (needFileSwitch || conversationUuid !== selectedConversationUuid) {
      // 只是切换视图或对话
      delay = 600;
    } else {
      // 同一对话内导航
      delay = 300;
    }

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('scrollToMessage', {
        detail: {
          messageIndex,
          messageId,
          messageUuid,
          highlight,
          fileIndex,  // 添加文件索引
          conversationUuid  // 添加对话UUID
        }
      }));
    }, delay);
  }, [selectedFileIndex, currentFileIndex, selectedConversationUuid, setViewMode, setSelectedFileIndex, setSelectedConversationUuid, fileActions]);

  const handleCardSelect = useCallback((card) => {
    if (contentAreaRef.current && viewMode === 'conversations') {
      const key = currentFile ? `file-${currentFileIndex}` : 'main';
      setScrollPositions(prev => ({
        ...prev,
        [key]: contentAreaRef.current.scrollTop
      }));
    }

    setSelectedMessageIndex(null);
    setSearchQuery('');
    setSortVersion(v => v + 1);

    if (card.type === 'file') {
      const needsFileSwitch = card.fileIndex !== currentFileIndex;

      if (needsFileSwitch) {
        fileActions.switchFile(card.fileIndex);
        setTimeout(() => {
          if (card.format === 'claude_full_export' || card.fileData?.format === 'claude_full_export') {
            setViewMode('conversations');
            setSelectedFileIndex(null);
            setSelectedConversationUuid(null);
          } else {
            setSelectedFileIndex(card.fileIndex);
            setSelectedConversationUuid(null);
            // 添加 history 记录
            window.history.pushState(
              { view: 'timeline', fileIndex: card.fileIndex, convUuid: null },
              ''
            );
            setViewMode('timeline');
          }
        }, 100);
      } else {
        if (card.format === 'claude_full_export' || card.fileData?.format === 'claude_full_export') {
          setViewMode('conversations');
          setSelectedFileIndex(null);
          setSelectedConversationUuid(null);
        } else {
          setSelectedFileIndex(card.fileIndex);
          setSelectedConversationUuid(null);
          // 添加 history 记录
          window.history.pushState(
            { view: 'timeline', fileIndex: card.fileIndex, convUuid: null },
            ''
          );
          setViewMode('timeline');
        }
      }
    } else if (card.type === 'conversation') {
      const parsed = parseUuid(card.uuid);
      const fileIndex = card.fileIndex;
      const conversationUuid = parsed.conversationUuid;
      const needsFileSwitch = fileIndex !== currentFileIndex;

      if (needsFileSwitch) {
        fileActions.switchFile(fileIndex);
        setTimeout(() => {
          setSelectedFileIndex(fileIndex);
          setSelectedConversationUuid(conversationUuid);
          // 添加 history 记录
          window.history.pushState(
            { view: 'timeline', fileIndex, convUuid: conversationUuid },
            ''
          );
          setViewMode('timeline');
        }, 100);
      } else {
        setSelectedFileIndex(fileIndex);
        setSelectedConversationUuid(conversationUuid);
        // 添加 history 记录
        window.history.pushState(
          { view: 'timeline', fileIndex, convUuid: conversationUuid },
          ''
        );
        setViewMode('timeline');
      }
    }
  }, [currentFileIndex, fileActions, viewMode, currentFile]);

  const handleFileRemove = useCallback((fileIndexOrUuid) => {
    if (typeof fileIndexOrUuid === 'number') {
      fileActions.removeFile(fileIndexOrUuid);
      if (fileIndexOrUuid === currentFileIndex || fileIndexOrUuid === selectedFileIndex) {
        setViewMode('conversations');
        setSelectedFileIndex(null);
        setSelectedConversationUuid(null);
        setSortVersion(v => v + 1);
      }
      return;
    }

    const parsed = parseUuid(fileIndexOrUuid);
    if (parsed.fileHash) {
      const index = files.findIndex((file, idx) => {
        const hash = generateFileHash(file);
        return hash === parsed.fileHash || generateFileCardUuid(idx, file) === fileIndexOrUuid;
      });

      if (index !== -1) {
        fileActions.removeFile(index);
        if (index === currentFileIndex || index === selectedFileIndex) {
          setViewMode('conversations');
          setSelectedFileIndex(null);
          setSelectedConversationUuid(null);
          setSortVersion(v => v + 1);
        }
      }
    }
  }, [currentFileIndex, selectedFileIndex, files, fileActions]);

  const handleBackToConversations = useCallback(() => {
    // 使用 window.history.back() 触发浏览器后退，状态更新由 popstate 处理
    if (window.history.state && window.history.state.view === 'timeline') {
      window.history.back();
    } else {
      // 直接更新状态（用于没有 history 记录的情况）
      setViewMode('conversations');
      setSelectedFileIndex(null);
      setSelectedConversationUuid(null);
      setSearchQuery('');
      setSortVersion(v => v + 1);
      setTimelineDisplayMessages([]);
    }
  }, []);

  const handleMarkToggle = (messageIndex, markType) => {
    if (markManagerRef.current) {
      markManagerRef.current.toggleMark(messageIndex, markType);

      if (viewMode === 'timeline' && selectedFileIndex !== null) {
        const file = files[selectedFileIndex];
        if (file) {
          const fileUuid = selectedConversationUuid && processedData?.format === 'claude_full_export'
            ? generateConversationCardUuid(selectedFileIndex, selectedConversationUuid, file)
            : generateFileCardUuid(selectedFileIndex, file);

          setOperatedFiles(prev => new Set(prev).add(fileUuid));
        }
      }

      setMarkVersion(v => v + 1);
    }
  };

  const handleStarToggle = (conversationUuid, nativeIsStarred) => {
    if (starManagerRef.current) {
      const newStars = starManagerRef.current.toggleStar(conversationUuid, nativeIsStarred);
      setStarredConversations(newStars);
    }
  };

  const handleItemRename = (uuid, newName) => {
    // 强制刷新视图以应用重命名
    setRenameVersion(v => v + 1);
    setSortVersion(v => v + 1);
    setMarkVersion(v => v + 1);
  };

  // 打开截图预览面板
  const openScreenshotPreview = (data) => {
    setScreenshotPreview({ isOpen: true, data });
    setShowActionPanel(false); // 关闭操作面板
  };

  // 关闭截图预览面板
  const closeScreenshotPreview = () => {
    setScreenshotPreview({ isOpen: false, data: null });
  };

  // 导出功能 - 使用exportManager中的handleExport
  const handleExportClick = async () => {
    const { handleExport } = await import('./utils/exportManager');
    const success = await handleExport({
      exportOptions: {
        ...exportOptions,
        selectedConversationUuid // 传递当前选中的对话UUID
      },
      processedData,
      sortManagerRef,
      sortedMessages,
      markManagerRef,
      currentBranchState,
      operatedFiles,
      files,
      currentFileIndex,
      displayMessages: viewMode === 'timeline' ? timelineDisplayMessages : null, // 使用从 ConversationTimeline 传回的实际显示消息
      openScreenshotPreview, // 新增：打开截图预览面板
      currentTheme: ThemeUtils.getCurrentTheme(), // 新增：当前主题
      conversation: selectedConversation // 新增：当前对话信息
    });

    if (success) {
      setShowActionPanel(false);
    }
  };

  // 排序操作
  const sortActions = {
    enableSort: () => {
      if (sortManagerRef.current) {
        sortManagerRef.current.enableSort();
        setSortVersion(v => v + 1);
      }
    },
    resetSort: () => {
      if (sortManagerRef.current) {
        sortManagerRef.current.resetSort();
        setSortVersion(v => v + 1);
      }
    },
    moveMessage: (fromIndex, direction) => {
      if (sortManagerRef.current) {
        sortManagerRef.current.moveMessage(fromIndex, direction);
        setSortVersion(v => v + 1);
      }
    }
  };

  // 标记操作
  const markActions = {
    toggleMark: handleMarkToggle,
    isMarked: (messageIndex, markType) => {
      return markManagerRef.current ? markManagerRef.current.isMarked(messageIndex, markType) : false;
    },
    clearAllMarks: () => {
      if (markManagerRef.current) {
        markManagerRef.current.clearAllMarks();
        if (currentFileUuid) {
          setOperatedFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(currentFileUuid);
            StorageManager.remove(`marks_${currentFileUuid}`);
            StorageManager.remove(`message_order_${currentFileUuid}`);
            return newSet;
          });
        }
        setMarkVersion(v => v + 1);
      }
    }
  };

  const handleClearAllFilesMarks = () => {
    if (!window.confirm(t('app.confirmations.clearAllMarks'))) {
      return;
    }

    const allKeys = StorageManager.getAllKeys();
    const keysToRemove = allKeys.filter(key =>
      key.startsWith('marks_') || key.startsWith('message_order_')
    );

    keysToRemove.forEach(key => StorageManager.remove(key));
    setOperatedFiles(new Set());

    if (markManagerRef.current) {
      markManagerRef.current.clearAllMarks();
    }

    if (sortManagerRef.current) {
      sortManagerRef.current.resetSort();
    }

    setMarkVersion(v => v + 1);
    setSortVersion(v => v + 1);
  };

  // 获取统计 - 使用 useMemo 缓存结果，避免重复计算
  const stats = useMemo(() => {
    return StatsCalculator.getStats({
      viewMode,
      allCards,
      sortedMessages,
      timelineMessages,
      files,
      markManagerRef,
      starManagerRef,
      shouldUseStarSystem,
      currentConversation,
      getAllMarksStats,
      generateFileCardUuid,
      generateConversationCardUuid,
      processedData,
      currentFileIndex
    });
  }, [viewMode, allCards, sortedMessages, timelineMessages, files, shouldUseStarSystem, currentConversation, processedData, currentFileIndex, markVersion]);

  const getSearchPlaceholder = () => {
    if (isFullExportConversationMode) {
      return t('app.search.placeholder.conversations');
    } else if (viewMode === 'conversations') {
      return t('app.search.placeholder.files');
    } else {
      return t('app.search.placeholder.messages');
    }
  };

  const searchStats = StatsCalculator.getSearchResultStats(
    viewMode, displayedItems, allCards, sortedMessages, timelineMessages, t
  );

  // ==================== 副作用 ====================

  useEffect(() => {
    if (viewMode === 'timeline' && timelineMessages.length > 0) {
      if (window.innerWidth >= 1024 && selectedMessageIndex === null) {
        const firstMessageIndex = timelineMessages[0]?.index;
        if (firstMessageIndex !== undefined) {
          setSelectedMessageIndex(firstMessageIndex);
        }
      }
    }
  }, [viewMode, timelineMessages, selectedMessageIndex]);

  useEffect(() => {
    if (files.length > 0) {
      const operatedSet = new Set();

      files.forEach((file, index) => {
        const fileUuid = generateFileCardUuid(index, file);
        const marksKey = `marks_${fileUuid}`;
        const sortKey = `message_order_${fileUuid}`;

        if (StorageManager.get(marksKey) || StorageManager.get(sortKey)) {
          operatedSet.add(fileUuid);
        }

        if (index === currentFileIndex && processedData?.format === 'claude_full_export') {
          const conversations = processedData.views?.conversationList || [];
          conversations.forEach(conv => {
            const convUuid = generateConversationCardUuid(index, conv.uuid, file);
            const convMarksKey = `marks_${convUuid}`;
            const convSortKey = `message_order_${convUuid}`;

            if (StorageManager.get(convMarksKey) || StorageManager.get(convSortKey)) {
              operatedSet.add(convUuid);
            }
          });
        }
      });

      if (operatedSet.size > 0) {
        setOperatedFiles(operatedSet);
      }
    }
  }, [files, currentFileIndex, processedData]);

  useEffect(() => {
    ThemeUtils.applyTheme(ThemeUtils.getCurrentTheme());
  }, []);

  useEffect(() => {
    const cleanup = postMessageHandler.setup();
    return cleanup;
  }, [postMessageHandler]);

  // Chrome 扩展模式：从 chrome.storage 读取待处理数据
  useEffect(() => {
    if (!isExtension) return;

    console.log('[Lyra App] Running in Chrome extension mode');

    // 检查是否有待处理的数据
    chrome.storage.local.get(['lyra_pending_data'], (result) => {
      if (result.lyra_pending_data) {
        const { content, filename } = result.lyra_pending_data;
        console.log('[Lyra App] Found pending data from extension:', filename);

        // 创建文件对象并加载
        try {
          const jsonData = typeof content === 'string' ? content : JSON.stringify(content);
          const blob = new Blob([jsonData], { type: 'application/json' });
          const file = new File([blob], filename, {
            type: 'application/json',
            lastModified: Date.now()
          });

          // 加载文件
          fileActions.loadFiles([file]);

          // 清除已处理的数据
          chrome.storage.local.remove(['lyra_pending_data']);
          console.log('[Lyra App] Data loaded successfully, waiting for file processing...');

        } catch (error) {
          console.error('[Lyra App] Error loading data from extension:', error);
          setError('Failed to load data from extension: ' + error.message);
        }
      }
    });
  }, [isExtension, fileActions, setError]);

  // Chrome 扩展模式：监听文件加载完成，自动切换到时间线视图
  useEffect(() => {
    if (isExtension && files.length > 0 && viewMode !== 'timeline') {
      console.log('[Lyra App] Files loaded in extension mode, switching to timeline view');
      setViewMode('timeline');
      fileActions.switchFile(0);
    }
  }, [isExtension, files, viewMode, fileActions]);

  // ==================== 渲染 ====================

  return (
    <div className="app-redesigned">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".json,.jsonl"
        onChange={handleFileLoad}
        style={{ display: 'none' }}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory="true"
        multiple
        onChange={handleFolderLoad}
        style={{ display: 'none' }}
      />

      {files.length === 0 ? (
        isHydratingPersistedFiles ? (
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            Restoring saved conversations...
          </div>
        ) : (
          <WelcomePage
            handleLoadClick={() => fileInputRef.current?.click()}
            handleFolderClick={() => folderInputRef.current?.click()}
          />
        )
      ) : (
        <>
          {/* 顶部导航栏 */}
          <nav className={`navbar-redesigned ${hideNavbar ? 'hide-on-mobile' : ''}`}>
            <div className="navbar-left">
              <div className="logo">
                <span className="logo-text">Lyra Exporter</span>
              </div>

              {viewMode === 'timeline' && !isExtension && (
                <button
                  className="btn-secondary small"
                  onClick={handleBackToConversations}
                >
                  ← {t('app.navbar.backToList')}
                </button>
              )}
              {/* 移动端：显示搜索按钮 */}
              {isMobile && !isFullExportConversationMode && (
                <button
                  className="btn-secondary small"
                  onClick={() => {
                    setActionPanelSection('globalSearch');
                    setShowActionPanel(true);
                  }}
                >
                  🔍
                </button>
              )}

              <button
                className="btn-secondary small"
                onClick={() => {
                  setActionPanelSection('semanticSearch');
                  setShowActionPanel(true);
                }}
              >
                🔮
              </button>

              {/* 桌面端：显示搜索框 */}
              {!isMobile && !isFullExportConversationMode && (
                <EnhancedSearchBox
                  onSearch={(query) => {
                    setInitialSearchQuery(query);
                    setActionPanelSection('globalSearch');
                    setShowActionPanel(true);
                  }}
                  onExpand={(query) => {
                    setInitialSearchQuery(query || '');
                    setActionPanelSection('globalSearch');
                    setShowActionPanel(true);
                  }}
                />
              )}
            </div>
            <div className="navbar-right">
              <button
                className="btn-secondary small"
                onClick={() => setShowSettingsPanel(true)}
                title={t('app.navbar.settings')}
              >
                ⚙️ {t('app.navbar.settings')}
              </button>

              {isFullExportConversationMode && shouldUseStarSystem && starManagerRef.current && (
                <button
                  className="btn-secondary small"
                  onClick={() => {
                    const newStars = starManagerRef.current.clearAllStars();
                    setStarredConversations(newStars);
                  }}
                  title={t('app.navbar.restoreStars')}
                >
                  ⭐ {t('app.navbar.restoreStars')}
                </button>
              )}
            </div>
          </nav>

          {/* 主容器 */}
          <div className="main-container">
            <div className="content-area" ref={contentAreaRef}>
              {/* 统计面板 - 在扩展模式下隐藏 */}
              {!isExtension && (
                <div className="stats-panel">
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-value">{stats.totalMessages}</div>
                      <div className="stat-label">{t('app.stats.totalMessages')}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{stats.conversationCount}</div>
                      <div className="stat-label">{t('app.stats.conversationCount')}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{stats.fileCount}</div>
                      <div className="stat-label">{t('app.stats.fileCount')}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{stats.markedCount}</div>
                      <div className="stat-label">{t('app.stats.markedCount')}</div>
                    </div>
                    {isFullExportConversationMode && shouldUseStarSystem && (
                      <div className="stat-card">
                        <div className="stat-value">{stats.starredCount}</div>
                        <div className="stat-label">{t('app.stats.starredCount')}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 筛选器 */}
              {isFullExportConversationMode && (
                <FullExportCardFilter
                  filters={filters}
                  availableProjects={availableProjects}
                  filterStats={filterStats}
                  onFilterChange={filterActions.setFilter}
                  onReset={filterActions.resetFilters}
                  onClearAllMarks={handleClearAllFilesMarks}
                  operatedCount={operatedFiles.size}
                />
              )}

              {/* 视图内容 */}
              <div className="view-content">
                {viewMode === 'conversations' ? (
                  <CardGrid
                    items={displayedItems}
                    selectedItem={selectedConversation}
                    starredItems={starredConversations}
                    onItemSelect={handleCardSelect}
                    onItemStar={isFullExportConversationMode && shouldUseStarSystem ? handleStarToggle : null}
                    onItemRemove={handleFileRemove}
                    onItemRename={handleItemRename}
                    onAddItem={() => fileInputRef.current?.click()}
                  />
                ) : (
                  <ConversationTimeline
                    data={processedData}
                    conversation={currentConversation}
                    messages={displayedItems}
                    marks={currentMarks}
                    markActions={markActions}
                    format={processedData?.format}
                    sortActions={sortActions}
                    hasCustomSort={hasCustomSort}
                    enableSorting={true}
                    files={files}
                    currentFileIndex={currentFileIndex}
                    onFileSwitch={(index) => {
                      if (contentAreaRef.current) {
                        const key = currentFile ? `file-${currentFileIndex}` : 'main';
                        setScrollPositions(prev => ({
                          ...prev,
                          [key]: contentAreaRef.current.scrollTop
                        }));
                      }

                      fileActions.switchFile(index);
                      setSelectedFileIndex(index);
                      setSelectedConversationUuid(null);
                    }}
                    searchQuery={searchQuery}
                    branchState={currentBranchState}
                    onBranchStateChange={setCurrentBranchState}
                    onDisplayMessagesChange={setTimelineDisplayMessages}
                    onShowSettings={() => setShowSettingsPanel(true)}
                    onHideNavbar={setHideNavbar}
                    onRename={handleItemRename}
                    onMobileDetailChange={setShowMobileDetail}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 悬浮导出按钮 - 移动端查看消息详情时隐藏 */}
          <FloatingActionButton
            onClick={() => {
              const lastExportFormat = StorageManager.get('last_export_format', 'exportMarkdown');
              setActionPanelSection(lastExportFormat);
              setShowActionPanel(true);
            }}
            title={t('app.export.button')}
            hidden={isMobile && showMobileDetail}
          />

          {/* 文件类型冲突模态框 */}
          {showTypeConflictModal && (
            <div className="modal-overlay" onClick={() => fileActions.cancelReplaceFiles()}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{t('app.typeConflict.title')}</h2>
                  <button className="close-btn" onClick={() => fileActions.cancelReplaceFiles()}>×</button>
                </div>
                <div className="modal-body">
                  <p dangerouslySetInnerHTML={{ __html: t('app.typeConflict.message') }} />
                  <br />
                  <p><strong>{t('app.typeConflict.currentFiles', { count: files.length })}</strong></p>
                  <p><strong>{t('app.typeConflict.newFiles', { count: pendingFiles.length })}</strong></p>
                  <br />
                  <p>{t('app.typeConflict.hint')}</p>
                </div>
                <div className="modal-footer">
                  <button className="btn-secondary" onClick={() => fileActions.cancelReplaceFiles()}>
                    {t('app.typeConflict.cancel')}
                  </button>
                  <button className="btn-primary" onClick={() => fileActions.confirmReplaceFiles()}>
                    {t('app.typeConflict.replace')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 设置面板 */}
          <SettingsPanel
            isOpen={showSettingsPanel}
            onClose={() => setShowSettingsPanel(false)}
            exportOptions={exportOptions}
            setExportOptions={setExportOptions}
          />

          {/* 操作面板 - 整合全局搜索、语义搜索、导出功能 */}
          <ActionPanel
            isOpen={showActionPanel}
            onClose={() => {
              setShowActionPanel(false);
              setInitialSearchQuery('');
            }}
            initialSection={actionPanelSection}
            initialSearchQuery={initialSearchQuery}
            onNavigateToMessage={handleNavigateToMessage}
            files={files}
            processedData={processedData}
            currentFileIndex={currentFileIndex}
            exportOptions={exportOptions}
            setExportOptions={setExportOptions}
            viewMode={viewMode}
            currentBranchState={currentBranchState}
            operatedFiles={operatedFiles}
            stats={stats}
            starManagerRef={starManagerRef}
            shouldUseStarSystem={shouldUseStarSystem}
            isFullExportConversationMode={isFullExportConversationMode}
            allCards={allCards}
            onExport={handleExportClick}
          />
          {/* 长截图预览面板 */}
          {screenshotPreview.isOpen && screenshotPreview.data && (
            <ScreenshotPreviewPanel
              {...screenshotPreview.data}
              isOpen={screenshotPreview.isOpen}
              onClose={closeScreenshotPreview}
            />
          )}

          {/* AI Chat 浮窗 - 仅在非 Chrome 扩展模式下显示 */}
          {!isExtension && (
            <>
              <FloatPanel />
              <FloatPanelTrigger position="bottom-left" />
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
