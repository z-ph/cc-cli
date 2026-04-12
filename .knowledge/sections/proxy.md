## 代理层 (src/proxy/)

代理层实现本地反向代理服务，用于在 Claude Code 与上游 API 之间拦截请求并透明替换 `model` 字段。由三个模块组成：

### server.js — HTTP 反向代理服务器

**职责**：创建反向代理 HTTP 服务器，拦截请求体中的 `model` 字段进行替换后转发至上游。

**核心函数**：

- `createProxyServer(options)` → `http.Server`
  - `options.baseUrl`：上游 API 地址（支持 HTTP/HTTPS）
  - `options.modelOverride`：模型映射表 `{ "源模型": "目标模型" }`，按精确匹配替换
  - `options.defaultModel`：当请求的 model 不在 modelOverride 中时，强制替换为该默认模型
  - `options.token`：随机验证 token，用于健康检查端点鉴权
  - `options.logger`：可选的日志写入器实例

**请求处理流程**：

1. 健康检查端点 `GET /__cc_proxy_status?token=xxx`：验证 token 后返回 `{ status, pid }`
2. 收集完整请求体（`for await` 拚接 chunks）
3. 解析 JSON，按优先级替换 model：`modelOverride[original]` > `defaultModel` > 不替换
4. 重建请求体，转发至上游（自动处理路径前缀拼接、Host 头、Content-Length 更新）
5. HTTPS 上游设置 `rejectUnauthorized: false` 以支持自签证书
6. 管道式响应转发（`upstreamRes.pipe(res)`），支持流式响应
7. 上游不可达时返回 502 错误

**日志采集**：每个请求生成一条结构化日志（id、时间戳、方法、路径、stream 标志、原始/替换后模型、状态码、耗时、错误信息），通过 `logger.push()` 异步写入。

### worker.js — 后台代理进程入口

**职责**：作为独立子进程运行代理服务器，由 `src/commands/serve.js` 通过 `child_process.fork()` 启动。

**启动流程**：

1. 从 `process.argv[2]` 解析 JSON 配置（含 baseUrl、modelOverride、defaultModel、token、configDir、profileId）
2. 根据配置创建 `createLogger` 实例（日志目录为 `{configDir}/logs/`，文件前缀 `proxy-{profileId}`）
3. 创建代理服务器并监听随机端口（`server.listen(0)`）
4. 通过 IPC `process.send({ type: 'ready', port, pid })` 通知父进程就绪

**进程生命周期**：

- `disconnect` 事件：父进程断开后继续保持运行（守护进程模式）
- `SIGTERM` 信号：`cc serve stop` 触发优雅关闭，同步刷写日志后退出
- `uncaughtException`：通过 IPC 上报错误消息，同步刷写日志后以 code 1 退出

### logger.js — 异步批量日志写入器

**职责**：提供高性能的异步日志写入能力，避免阻塞代理请求处理。

**核心函数**：

- `createLogger(options)` → logger 实例
  - `options.logDir`：日志目录绝对路径
  - `options.prefix`：文件名前缀（如 `proxy-my-profile`）
  - `options.maxQueueSize`（默认 10000）：内存队列最大容量
  - `options.maxFailCount`（默认 3）：连续写入失败上限，超过后自动禁用

**写入机制**：

- 日志文件懒初始化，按日期命名：`{prefix}-{YYYY-MM-DD}.log`
- `push(entry)`：同步入队（微秒级），通过 `setImmediate` 触发异步 drain 循环
- drain 循环：批量取出队列所有条目，拼接为 JSONL 格式，单次 `fs.appendFile` 写入
- 队列满时丢弃最旧条目并记录 `dropped` 标记

**导出接口**：

| 方法 | 说明 |
|---|---|
| `push(entry)` | 同步推入日志条目，触发异步写入 |
| `flush(callback)` | 异步刷写队列剩余条目，完成后回调 |
| `flushSync()` | 同步刷写，专用于进程崩溃/退出路径 |
| `stop()` | 停止 logger 并同步刷写剩余条目 |
| `isDisabled()` | 查询 logger 是否因连续失败被禁用 |

### 模块间依赖关系

```
serve.js (command)
  └── fork → worker.js
              ├── server.js (createProxyServer)
              └── logger.js (createLogger → 注入 server)
```

- `server.js` 不直接依赖 `logger.js`，通过 options 注入 logger 实例（松耦合）
- `worker.js` 是唯一同时依赖 `server.js` 和 `logger.js` 的组装点
- `logger.js` 完全独立，无外部依赖