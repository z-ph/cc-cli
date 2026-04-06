const http = require('http');
const https = require('https');
const { URL } = require('url');

const STATUS_PATH = '/__cc_proxy_status';

/**
 * 创建反向代理 HTTP 服务器
 * @param {object} options
 * @param {string} options.baseUrl - 上游 API 地址
 * @param {object} [options.modelOverride] - 模型映射表 { "源模型": "目标模型" }
 * @param {string} [options.defaultModel] - 无 modelOverride 时的强制路由模型
 * @param {string} options.token - 随机验证 token
 * @returns {http.Server}
 */
function createProxyServer(options) {
  const { baseUrl, modelOverride, defaultModel, token, logger } = options;
  const parsedBase = new URL(baseUrl);
  const isHttps = parsedBase.protocol === 'https:';
  const transport = isHttps ? https : http;
  let requestIdCounter = 0;

  const server = http.createServer(async (req, res) => {
    const startTime = Date.now();

    // 健康检查端点
    if (req.url.startsWith(STATUS_PATH)) {
      const url = new URL(req.url, 'http://localhost');
      const reqToken = url.searchParams.get('token');
      if (reqToken !== token) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid token' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', pid: process.pid }));
      return;
    }

    // 提取 pathname（去除 query string）
    const reqUrl = new URL(req.url, 'http://localhost');
    const reqPath = reqUrl.pathname;

    // 收集请求体
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // 解析并修改 model
    let body = rawBody;
    let originalModel = null;
    let replacedModel = null;
    let streamFlag = null;
    try {
      const parsed = JSON.parse(rawBody.toString('utf8'));
      if (typeof parsed.model === 'string') {
        originalModel = parsed.model;
        if (modelOverride && modelOverride[parsed.model]) {
          parsed.model = modelOverride[parsed.model];
        } else if (defaultModel) {
          parsed.model = defaultModel;
        }
        replacedModel = parsed.model;
        body = Buffer.from(JSON.stringify(parsed), 'utf8');
      }
      if ('stream' in parsed) {
        streamFlag = !!parsed.stream;
      }
    } catch {
      // 非 JSON 请求，透传
    }

    // 构建上游请求
    const upstreamPath = parsedBase.pathname === '/'
      ? req.url
      : parsedBase.pathname.replace(/\/$/, '') + req.url;

    const upstreamHeaders = { ...req.headers };
    upstreamHeaders['host'] = parsedBase.host;
    upstreamHeaders['content-length'] = body.length;
    // 移除可能导致问题的头
    delete upstreamHeaders['connection'];
    delete upstreamHeaders['transfer-encoding'];

    const upstreamOptions = {
      hostname: parsedBase.hostname,
      port: parsedBase.port || (isHttps ? 443 : 80),
      path: upstreamPath,
      method: req.method,
      headers: upstreamHeaders,
    };

    // HTTPS 需要设置 rejectUnauthorized 以支持自签证书的上游
    if (isHttps) {
      upstreamOptions.rejectUnauthorized = false;
    }

    // 日志采集辅助
    const logId = ++requestIdCounter;
    let logged = false;

    function pushLog(status, error) {
      if (logged || !logger) return;
      logged = true;
      logger.push({
        id: logId,
        ts: new Date().toISOString(),
        method: req.method,
        path: reqPath,
        stream: streamFlag,
        model: originalModel,
        modelAfter: replacedModel !== null ? replacedModel : originalModel,
        status,
        durationMs: Date.now() - startTime,
        error: error || null,
      });
    }

    const upstreamReq = transport.request(upstreamOptions, (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
      res.on('finish', () => {
        pushLog(upstreamRes.statusCode, null);
      });
    });

    upstreamReq.on('error', (err) => {
      const msg = `上游 ${baseUrl} 不可达: ${err.message}`;
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'proxy_error',
          message: msg,
        }));
      }
      pushLog(null, msg);
    });

    upstreamReq.end(body);
  });

  return server;
}

module.exports = { createProxyServer };
