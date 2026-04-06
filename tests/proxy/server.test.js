const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createProxyServer } = require('../../src/proxy/server');
const { createLogger } = require('../../src/proxy/logger');

let tmpDir;
let upstreamServer;
let proxyServer;
let logger;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-server-test-'));
});

afterEach(() => {
  if (proxyServer) {
    proxyServer.close();
    proxyServer = null;
  }
  if (upstreamServer) {
    upstreamServer.close();
    upstreamServer = null;
  }
  if (logger) {
    logger.stop();
    logger = null;
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// 辅助：创建 mock 上游服务器
function createUpstream(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, () => {
      upstreamServer = server;
      resolve(`http://localhost:${server.address().port}`);
    });
  });
}

// 辅助：发送 HTTP 请求
function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const opts = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'POST',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        res.body = Buffer.concat(chunks).toString('utf8');
        resolve(res);
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// 辅助：读取日志
function readLogs() {
  const logsDir = path.join(tmpDir, 'logs');
  if (!fs.existsSync(logsDir)) return [];
  const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
  if (files.length === 0) return [];
  const content = fs.readFileSync(path.join(logsDir, files[0]), 'utf8');
  return content.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}

function waitForWrite(ms = 100) {
  return new Promise(r => setTimeout(r, ms));
}

describe('server.js 日志集成', () => {
  test('正常请求记录完整日志字段', async () => {
    const upstreamUrl = await createUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });

    logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });
    proxyServer = createProxyServer({
      baseUrl: upstreamUrl,
      token: 'test-token',
      logger,
    });

    const proxyPort = await new Promise(r => proxyServer.listen(0, () => r(proxyServer.address().port)));
    const body = JSON.stringify({ model: 'claude-sonnet-4-6', stream: true, messages: [] });
    const res = await request(`http://localhost:${proxyPort}/v1/messages`, { method: 'POST' }, body);

    expect(res.statusCode).toBe(200);

    // 等待日志写入
    await waitForWrite(150);

    const entries = readLogs();
    expect(entries.length).toBe(1);

    const entry = entries[0];
    expect(entry.id).toBe(1);
    expect(entry.method).toBe('POST');
    expect(entry.path).toBe('/v1/messages');
    expect(entry.stream).toBe(true);
    expect(entry.model).toBe('claude-sonnet-4-6');
    expect(entry.modelAfter).toBe('claude-sonnet-4-6');
    expect(entry.status).toBe(200);
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(entry.error).toBeNull();
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('模型替换记录 originalModel 和 modelAfter', async () => {
    const upstreamUrl = await createUpstream((req, res) => {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        const parsed = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ model: parsed.model }));
      });
    });

    logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });
    proxyServer = createProxyServer({
      baseUrl: upstreamUrl,
      modelOverride: { 'claude-sonnet-4-6': 'claude-opus-4-6' },
      token: 'test-token',
      logger,
    });

    const proxyPort = await new Promise(r => proxyServer.listen(0, () => r(proxyServer.address().port)));
    const body = JSON.stringify({ model: 'claude-sonnet-4-6', messages: [] });
    const res = await request(`http://localhost:${proxyPort}/v1/messages`, { method: 'POST' }, body);

    expect(res.statusCode).toBe(200);
    await waitForWrite(150);

    const entries = readLogs();
    expect(entries.length).toBe(1);
    expect(entries[0].model).toBe('claude-sonnet-4-6');
    expect(entries[0].modelAfter).toBe('claude-opus-4-6');
  });

  test('stream 字段正确反映请求体 stream 参数', async () => {
    const upstreamUrl = await createUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });

    logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });
    proxyServer = createProxyServer({
      baseUrl: upstreamUrl,
      token: 'test-token',
      logger,
    });

    const proxyPort = await new Promise(r => proxyServer.listen(0, () => r(proxyServer.address().port)));

    // 非 stream 请求
    const body1 = JSON.stringify({ model: 'claude-sonnet-4-6', stream: false, messages: [] });
    await request(`http://localhost:${proxyPort}/v1/messages`, { method: 'POST' }, body1);

    // 无 stream 字段
    const body2 = JSON.stringify({ model: 'claude-sonnet-4-6', messages: [] });
    await request(`http://localhost:${proxyPort}/v1/messages`, { method: 'POST' }, body2);

    await waitForWrite(150);

    const entries = readLogs();
    expect(entries).toHaveLength(2);
    expect(entries[0].stream).toBe(false);
    expect(entries[1].stream).toBeNull();
  });

  test('上游不可达时记录错误日志', async () => {
    // 使用一个不存在的上游端口
    logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });
    proxyServer = createProxyServer({
      baseUrl: 'http://localhost:1',
      token: 'test-token',
      logger,
    });

    const proxyPort = await new Promise(r => proxyServer.listen(0, () => r(proxyServer.address().port)));
    const body = JSON.stringify({ model: 'test', messages: [] });
    const res = await request(`http://localhost:${proxyPort}/v1/messages`, { method: 'POST' }, body);

    expect(res.statusCode).toBe(502);
    await waitForWrite(150);

    const entries = readLogs();
    expect(entries.length).toBe(1);
    expect(entries[0].status).toBeNull();
    expect(entries[0].error).toBeTruthy();
  });

  test('健康检查请求不产生日志', async () => {
    const upstreamUrl = await createUpstream((req, res) => {
      res.writeHead(200);
      res.end('ok');
    });

    logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });
    proxyServer = createProxyServer({
      baseUrl: upstreamUrl,
      token: 'test-token',
      logger,
    });

    const proxyPort = await new Promise(r => proxyServer.listen(0, () => r(proxyServer.address().port)));
    const res = await request(
      `http://localhost:${proxyPort}/__cc_proxy_status?token=test-token`,
      { method: 'GET' }
    );

    expect(res.statusCode).toBe(200);
    await waitForWrite(100);

    const entries = readLogs();
    expect(entries.length).toBe(0);
  });

  test('日志写入不阻塞响应', async () => {
    const upstreamUrl = await createUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });

    logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });
    proxyServer = createProxyServer({
      baseUrl: upstreamUrl,
      token: 'test-token',
      logger,
    });

    const proxyPort = await new Promise(r => proxyServer.listen(0, () => r(proxyServer.address().port)));

    // 并发 5 个请求，都应快速返回
    const start = Date.now();
    const promises = [];
    for (let i = 0; i < 5; i++) {
      const body = JSON.stringify({ model: 'test', messages: [] });
      promises.push(request(`http://localhost:${proxyPort}/v1/messages`, { method: 'POST' }, body));
    }
    const results = await Promise.all(promises);
    const elapsed = Date.now() - start;

    // 所有请求应在 1 秒内完成（日志写入不应阻塞）
    expect(elapsed).toBeLessThan(1000);
    expect(results.every(r => r.statusCode === 200)).toBe(true);

    await waitForWrite(150);
    const entries = readLogs();
    expect(entries.length).toBe(5);
  });

  test('path 字段不含 query string', async () => {
    const upstreamUrl = await createUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });

    logger = createLogger({ logDir: path.join(tmpDir, 'logs'), prefix: 'proxy-test' });
    proxyServer = createProxyServer({
      baseUrl: upstreamUrl,
      token: 'test-token',
      logger,
    });

    const proxyPort = await new Promise(r => proxyServer.listen(0, () => r(proxyServer.address().port)));
    const body = JSON.stringify({ model: 'test', messages: [] });
    await request(
      `http://localhost:${proxyPort}/v1/messages?beta=true&key=secret`,
      { method: 'POST' },
      body
    );

    await waitForWrite(150);

    const entries = readLogs();
    expect(entries[0].path).toBe('/v1/messages');
  });

  test('无 logger 时不记录日志（向后兼容）', async () => {
    const upstreamUrl = await createUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });

    // 不传 logger
    proxyServer = createProxyServer({
      baseUrl: upstreamUrl,
      token: 'test-token',
    });

    const proxyPort = await new Promise(r => proxyServer.listen(0, () => r(proxyServer.address().port)));
    const body = JSON.stringify({ model: 'test', messages: [] });
    const res = await request(`http://localhost:${proxyPort}/v1/messages`, { method: 'POST' }, body);

    expect(res.statusCode).toBe(200);
  });
});
