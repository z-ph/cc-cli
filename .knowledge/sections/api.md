## API 层 (src/api/)

`src/api/` 目录封装了项目对外部 API 的 HTTP 通信能力，目前仅包含一个模块文件 `client.js`。该层作为底层网络请求基础设施，供上层的 `models`、`test` 等命令调用。

### client.js — 通用 HTTP 请求客户端

**职责**：提供统一的 HTTP/HTTPS 请求发送函数，处理 URL 解析、认证头注入、超时控制、响应解析等基础逻辑。

**导出接口**：

- `sendApiRequest(baseUrl, token, options)` → `Promise<{ statusCode, statusMessage, durationMs, body, data }>`
  - `baseUrl`（string）：API 基础地址，末尾斜杠会自动去除
  - `token`（string|null）：认证令牌，非空时同时注入 `Authorization: Bearer` 和 `x-api-key` 两个请求头
  - `options.path`（string）：请求路径，拼接在 baseUrl 之后
  - `options.method`（string，默认 `'GET'`）：HTTP 方法
  - `options.timeout`（number，默认 10000）：超时毫秒数
  - `options.body`（string，可选）：请求体，存在时自动设置 `Content-Type: application/json`
  - 返回值中 `data` 为 JSON 解析后的对象，解析失败则为 `null`；`durationMs` 记录请求耗时

**关键实现细节**：

- 使用 Node.js 原生 `http`/`https` 模块，零第三方依赖
- 自动根据 URL 协议选择 http 或 https 传输层
- HTTPS 请求设置 `rejectUnauthorized: false`，允许自签名证书（适用于代理/本地测试环境）
- 超时通过 `req.setTimeout()` 实现，超时后调用 `req.destroy()` 终止连接并抛出 `"请求超时"` 错误

**依赖方**：

- `src/commands/models.js` — 查询模型列表时调用
- `src/commands/test.js` — 测试 API 连通性时调用