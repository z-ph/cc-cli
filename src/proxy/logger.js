const fs = require('fs');
const path = require('path');

/**
 * 创建异步日志写入器
 * @param {object} options
 * @param {string} options.logDir - 日志目录绝对路径
 * @param {string} options.prefix - 文件名前缀（如 'proxy-my-profile'）
 * @param {number} [options.maxQueueSize=10000] - 队列最大容量
 * @param {number} [options.maxFailCount=3] - 连续失败最大次数，超过后禁用
 */
function createLogger(options) {
  const { logDir, prefix, maxQueueSize = 10000, maxFailCount = 3 } = options;

  const queue = [];
  let draining = false;
  let stopped = false;
  let disabled = false;
  let failCount = 0;
  let droppedCount = 0;
  let nextId = 0;
  let logFilePath = null;

  /**
   * 获取日志文件路径（懒初始化）
   */
  function getLogFilePath() {
    if (logFilePath) return logFilePath;
    fs.mkdirSync(logDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    logFilePath = path.join(logDir, `${prefix}-${date}.log`);
    return logFilePath;
  }

  /**
   * 异步 drain 循环：批量写入队列中的条目
   */
  function scheduleDrain() {
    if (draining || stopped || disabled) return;
    draining = true;

    setImmediate(() => {
      if (stopped || disabled) {
        draining = false;
        return;
      }

      // 取出所有条目
      const batch = queue.splice(0, queue.length);
      if (batch.length === 0) {
        draining = false;
        return;
      }

      // 如果有丢弃记录，在 batch 前插入标记条目
      if (droppedCount > 0) {
        batch.unshift({ ts: new Date().toISOString(), type: 'dropped', count: droppedCount });
        droppedCount = 0;
      }

      const lines = batch.map(e => JSON.stringify(e)).join('\n') + '\n';

      fs.appendFile(getLogFilePath(), lines, 'utf8', (err) => {
        if (err) {
          failCount++;
          if (failCount >= maxFailCount) {
            disabled = true;
            draining = false;
            return;
          }
        } else {
          failCount = 0;
        }

        draining = false;

        // 如果队列中还有条目，继续 drain
        if (queue.length > 0) {
          scheduleDrain();
        }
      });
    });
  }

  return {
    /**
     * 推入日志条目（同步、微秒级）
     */
    push(entry) {
      if (stopped || disabled) return;

      if (queue.length >= maxQueueSize) {
        queue.shift();
        droppedCount++;
      }

      queue.push(entry);

      // 唤醒 drain 循环
      scheduleDrain();
    },

    /**
     * 异步刷写：将队列剩余条目写入磁盘
     * @param {Function} [callback] - 写入完成回调
     */
    flush(callback) {
      if (disabled) {
        callback && callback();
        return;
      }

      const batch = queue.splice(0, queue.length);
      if (batch.length === 0) {
        callback && callback();
        return;
      }

      // 如果有丢弃记录，在 batch 前插入标记条目
      if (droppedCount > 0) {
        batch.unshift({ ts: new Date().toISOString(), type: 'dropped', count: droppedCount });
        droppedCount = 0;
      }

      const lines = batch.map(e => JSON.stringify(e)).join('\n') + '\n';

      fs.appendFile(getLogFilePath(), lines, 'utf8', (err) => {
        if (err) {
          failCount++;
          if (failCount >= maxFailCount) {
            disabled = true;
          }
        } else {
          failCount = 0;
        }
        callback && callback(err);
      });
    },

    /**
     * 同步刷写：使用 writeFileSync，专用于崩溃路径
     */
    flushSync() {
      if (disabled) return;

      const batch = queue.splice(0, queue.length);
      if (batch.length === 0) return;

      try {
        fs.mkdirSync(logDir, { recursive: true });
        const lines = batch.map(e => JSON.stringify(e)).join('\n') + '\n';
        fs.appendFileSync(getLogFilePath(), lines, 'utf8');
      } catch {
        // 同步刷写失败时静默处理
      }
    },

    /**
     * 停止 logger，flush 剩余条目后停止 drain 循环
     */
    stop() {
      stopped = true;
      // 尝试同步刷写剩余条目
      if (queue.length > 0) {
        try {
          const batch = queue.splice(0, queue.length);
          fs.mkdirSync(logDir, { recursive: true });
          const lines = batch.map(e => JSON.stringify(e)).join('\n') + '\n';
          fs.appendFileSync(getLogFilePath(), lines, 'utf8');
        } catch {
          // 静默处理
        }
      }
    },

    /**
     * 检查 logger 是否已被禁用
     */
    isDisabled() {
      return disabled;
    },
  };
}

module.exports = { createLogger };
