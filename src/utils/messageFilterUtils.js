// utils/messageFilterUtils.js
// 消息过滤工具 - 统一消息过滤逻辑

/**
 * 消息过滤器
 * 整合自 exportManager.js 的重复过滤逻辑
 */
export class MessageFilter {
  /**
   * 根据标记和选项过滤消息
   * @param {Array} messages - 消息列表
   * @param {Object} options - 过滤选项
   * @param {boolean} options.excludeDeleted - 排除已删除的消息
   * @param {boolean} options.includeCompleted - 仅包含已完成的消息
   * @param {boolean} options.includeImportant - 仅包含重要的消息
   * @param {Object} marks - 标记数据 { completed: Set, important: Set, deleted: Set }
   * @returns {Array} 过滤后的消息列表
   */
  static filter(messages, options = {}, marks = null) {
    if (!messages || messages.length === 0) {
      return [];
    }

    let filtered = [...messages];

    // 获取标记数据
    const messageMarks = marks || {
      completed: new Set(),
      important: new Set(),
      deleted: new Set()
    };

    // 排除已删除的消息
    if (options.excludeDeleted) {
      filtered = filtered.filter(msg => !messageMarks.deleted.has(msg.index));
    }

    // 仅包含已完成的消息
    if (options.includeCompleted && !options.includeImportant) {
      filtered = filtered.filter(msg => messageMarks.completed.has(msg.index));
    }

    // 仅包含重要的消息
    if (options.includeImportant && !options.includeCompleted) {
      filtered = filtered.filter(msg => messageMarks.important.has(msg.index));
    }

    // 同时包含已完成和重要的消息
    if (options.includeCompleted && options.includeImportant) {
      filtered = filtered.filter(msg =>
        messageMarks.completed.has(msg.index) && messageMarks.important.has(msg.index)
      );
    }

    return filtered;
  }

  /**
   * 生成过滤条件描述（国际化）
   * @param {Object} options - 过滤选项
   * @param {Function} t - 翻译函数
   * @returns {string} 过滤描述
   */
  static getFilterDescription(options = {}, t = null) {
    const filters = [];

    // 如果没有提供翻译函数，使用默认文本
    const getText = (key) => {
      if (t) {
        return t(key);
      }
      // 默认英文文本
      const defaultTexts = {
        'filters.excludeDeleted': 'Exclude Deleted',
        'filters.onlyCompleted': 'Only Completed',
        'filters.onlyImportant': 'Only Important',
        'filters.completedAndImportant': 'Completed and Important'
      };
      return defaultTexts[key] || key;
    };

    if (options.excludeDeleted) {
      filters.push(getText('filters.excludeDeleted'));
    }

    if (options.includeCompleted && options.includeImportant) {
      filters.push(getText('filters.completedAndImportant'));
    } else if (options.includeCompleted) {
      filters.push(getText('filters.onlyCompleted'));
    } else if (options.includeImportant) {
      filters.push(getText('filters.onlyImportant'));
    }

    return filters.join(', ');
  }

  /**
   * 检查是否有任何过滤条件
   * @param {Object} options - 过滤选项
   * @returns {boolean} 是否有过滤
   */
  static hasFilters(options = {}) {
    return !!(
      options.excludeDeleted ||
      options.includeCompleted ||
      options.includeImportant
    );
  }

  /**
   * 统计过滤结果
   * @param {Array} originalMessages - 原始消息
   * @param {Array} filteredMessages - 过滤后的消息
   * @returns {Object} 统计信息
   */
  static getFilterStats(originalMessages, filteredMessages) {
    return {
      original: originalMessages.length,
      filtered: filteredMessages.length,
      excluded: originalMessages.length - filteredMessages.length,
      percentage: originalMessages.length > 0
        ? Math.round((filteredMessages.length / originalMessages.length) * 100)
        : 0
    };
  }

  /**
   * 过滤并统计
   * @param {Array} messages - 消息列表
   * @param {Object} options - 过滤选项
   * @param {Object} marks - 标记数据
   * @returns {Object} { filtered: Array, stats: Object }
   */
  static filterWithStats(messages, options = {}, marks = null) {
    const filtered = this.filter(messages, options, marks);
    const stats = this.getFilterStats(messages, filtered);

    return { filtered, stats };
  }
}

/**
 * 辅助函数：快速过滤消息（向后兼容）
 */
export function filterMessages(messages, options, marks) {
  return MessageFilter.filter(messages, options, marks);
}

/**
 * 辅助函数：获取过滤描述（向后兼容）
 */
export function getFilterDescription(options, t) {
  return MessageFilter.getFilterDescription(options, t);
}

export default MessageFilter;
