const fs = require('fs');
const path = require('path');
const os = require('os');

// logger.js 尚未创建，测试应先失败
const { createLogger } = require('../../src/proxy/logger');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-logger-test-'));
});

afterEach(() => {
  // 清理临时目录
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// 辅助：等待异步写入完成
function waitForWrite(ms = 50) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 辅助：读取日志文件内容
function readLogFile(tmpDir) {
  const logsDir = path.join(tmpDir, 'logs');
  if (!fs.existsSync(logsDir)) return [];
  const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log')).sort();
  if (files.length === 0) return [];
  const content = fs.readFileSync(path.join(logsDir, files[files.length - 1]), 'utf8');
  return content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

describe('createLogger', () => {
  test('创建日志目录和日志文件', async () => {
    const logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });
    logger.push({ method: 'GET', path: '/test' });
    logger.flush();
    await waitForWrite();

    expect(fs.existsSync(path.join(tmpDir, 'logs'))).toBe(true);
    const files = fs.readdirSync(path.join(tmpDir, 'logs'));
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^proxy-test-\d{4}-\d{2}-\d{2}\.log$/);

    logger.stop();
  });

  test('push 写入 JSONL 格式日志', async () => {
    const logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });
    logger.push({ id: 1, method: 'POST', path: '/v1/messages' });
    logger.push({ id: 2, method: 'POST', path: '/v1/messages' });
    logger.flush();
    await waitForWrite();

    const entries = readLogFile(tmpDir);
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe(1);
    expect(entries[0].method).toBe('POST');
    expect(entries[1].id).toBe(2);

    logger.stop();
  });

  test('自增 id 由调用方控制，logger 不添加', async () => {
    const logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });
    logger.push({ id: 42, method: 'GET', path: '/health' });
    logger.flush();
    await waitForWrite();

    const entries = readLogFile(tmpDir);
    expect(entries[0].id).toBe(42);

    logger.stop();
  });

  test('flushSync 同步写入磁盘', () => {
    const logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });
    logger.push({ id: 1, method: 'POST', path: '/sync' });
    logger.push({ id: 2, method: 'GET', path: '/sync2' });
    logger.flushSync();

    const entries = readLogFile(tmpDir);
    expect(entries).toHaveLength(2);
    expect(entries[0].path).toBe('/sync');
    expect(entries[1].path).toBe('/sync2');

    logger.stop();
  });

  test('队列溢出时丢弃最早条目并记录 dropped', async () => {
    const logger = createLogger({
      logDir: path.join(tmpDir, 'logs'),
      prefix: 'proxy-test',
      maxQueueSize: 5,
    });

    // 填充超过队列容量
    for (let i = 0; i < 8; i++) {
      logger.push({ id: i, method: 'POST', path: `/req-${i}` });
    }
    logger.flush();
    await waitForWrite();

    const entries = readLogFile(tmpDir);
    // 应有 5 个请求条目 + 1 个 dropped 标记条目
    const requestEntries = entries.filter(e => e.method);
    const droppedEntries = entries.filter(e => e.type === 'dropped');

    expect(requestEntries.length).toBeLessThanOrEqual(5);
    expect(droppedEntries.length).toBe(1);
    expect(droppedEntries[0].count).toBeGreaterThan(0);

    logger.stop();
  });

  test('连续写入失败 3 次后自动禁用', async () => {
    const logDir = path.join(tmpDir, 'logs');
    const logger = createLogger({ logDir, prefix: 'proxy-test', maxFailCount: 3 });

    // 正常写入一次验证初始工作
    logger.push({ id: 1, method: 'GET', path: '/first' });
    logger.flush();
    await waitForWrite();

    // 删除日志目录使其失败，创建同名文件阻止 mkdir
    const files = fs.readdirSync(logDir);
    const logFile = path.join(logDir, files[0]);
    fs.unlinkSync(logFile);
    fs.rmdirSync(logDir);
    fs.writeFileSync(logDir, 'block');

    // 分 3 批 push，每批触发一次 drain 失败
    for (let batch = 0; batch < 3; batch++) {
      logger.push({ id: batch * 10, method: 'POST', path: `/fail-${batch}` });
      // 等待 drain 尝试写入
      await waitForWrite(50);
    }

    // logger 应该已禁用
    expect(logger.isDisabled()).toBe(true);

    // 清理
    fs.unlinkSync(logDir);
    logger.stop();
  });

  test('异步 drain 循环在新条目入队时自动唤醒', async () => {
    const logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });

    // 不调用 flush，依赖 drain 循环自动写入
    logger.push({ id: 1, method: 'POST', path: '/auto' });
    await waitForWrite(100);

    const entries = readLogFile(tmpDir);
    expect(entries.length).toBe(1);
    expect(entries[0].path).toBe('/auto');

    logger.stop();
  });

  test('stop 方法停止 drain 循环', async () => {
    const logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });
    logger.push({ id: 1, method: 'POST', path: '/before-stop' });
    logger.stop();

    // stop 后不应再有 drain 活动
    const countAfterStop = readLogFile(tmpDir).length;
    logger.push({ id: 2, method: 'POST', path: '/after-stop' });
    await waitForWrite(50);

    const countFinal = readLogFile(tmpDir).length;
    // stop 可能在 flush 后才停止，所以 countAfterStop 可能 > 0
    // 但 after-stop 的条目不应被写入
    expect(countFinal).toBe(countAfterStop);
  });
});
