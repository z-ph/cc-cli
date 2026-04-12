## api (src/api/)

`src/api/` 目录包含一个模块 `client.js`，封装了底层 HTTP 请求能力，供 `models` 和 `test` 命令调用。

### client.js

**职责**：通用的 HTTP/HTTPS API 请求客户端，基于 Node.js 原生 `http`/`https` 模块实现，无第三方依赖。

**核心函数**：

- `sendApiRequest(baseUrl, token, options)` — 向 API 端点发送 HTTP 请求
  - `baseUrl` — API 基地址（如 `https://api.example.com/v1`），自动去除末尾斜杠
  - `token` — 认证令牌，为 `null` 时不添加认证头；同时设置 `Authorization: Bearer` 和 `x-api-key` 两个头
  - `options.path` — 请求路径（如 `/models`）
  - `options.method` — HTTP 方法，默认 `GET`
  - `options.timeout` — 超时毫秒数，默认 `10000`（10 秒）
  - `options.body` — 请求体字符串，设置时自动添加 `Content-Type: application/json`
  - 返回 `Promise<{ statusCode, statusMessage, durationMs, body, data }>`，`data` 为 JSON 解析结果，解析失败则为 `null`

**设计要点**：

- 根据 URL 协议自动选择 `http` 或 `https` 模块
- HTTPS 请求设置 `rejectUnauthorized: false`，支持自签名证书
- 记录请求耗时（`durationMs`）
- 超时时销毁请求并抛出中文错误消息 `请求超时 (Ns)`
- URL 解析失败时抛出 `无效的 URL` 错误

**导出接口**：

```js
module.exports = { sendApiRequest }
```

**消费者**：

- `src/commands/models.js` — 查询可用模型列表
- `src/commands/test.js` — 测试 API 连通性和认证