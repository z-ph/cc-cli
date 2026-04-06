# PRD: 代理服务请求日志

## 背景与问题

当前 `cc serve` 启动的代理服务完全无日志记录：
- 请求经过代理时无任何记录，无法追踪模型替换是否生效
- 上游错误只返回 502，无持久化记录，排查问题时只能靠客户端报错
- Worker 进程的 stdout/stderr 被完全忽略（`stdio: ['ignore', 'ignore', 'ignore', 'ipc']`），console.log 输出全部丢失
- 无法统计请求量、延迟、错误率等基础指标

## 目标

1. 为代理服务增加结构化请求日志，记录每次转发的关键信息（时间、模型、状态码、耗时）
2. 日志写入采用异步队列，**绝不阻塞请求转发路径**，优先级始终低于模型转发
3. 日志输出到文件，支持 `cc serve` 命令查看历史日志
4. Worker 进程 stderr 重定向到日志文件，崩溃堆栈不再丢失
5. 保持现有代理核心逻辑不变，仅增加旁路日志能力

## 解决方案

在 `server.js` 中增加旁路日志采集：请求完成后将日志条目推入内存异步队列，由独立写入循环批量写入日志文件。写入循环使用 `setImmediate` 让步（每次 drain 后通过 `setImmediate` 调度下一轮，不使用 `setInterval`/`setTimeout`），确保不与主线程转发逻辑争抢 CPU。Logger 仅写文件，不使用 IPC。

## 功能需求

### 1. 日志条目格式

每条日志为 JSON Lines 格式，包含以下字段：

```json
{
  "id": 1,
  "ts": "2026-04-06T12:00:00.123Z",
  "method": "POST",
  "path": "/v1/messages",
  "stream": true,
  "model": "claude-sonnet-4-6",
  "modelAfter": "claude-opus-4-6",
  "status": 200,
  "durationMs": 1523,
  "error": null
}
```

- `id`: 自增请求计数器，用于关联同一请求的多个事件
- `ts`: ISO 8601 时间戳
- `method`: HTTP 方法
- `path`: 请求路径（不含 query string，避免泄漏敏感参数）
- `stream`: 请求体中 `"stream": true` 时为 true，否则为 false（区分流式/非流式延迟的关键维度）
- `model`: 原始请求中的模型名（无 model 字段时为 null）
- `modelAfter`: 替换后的模型名（未替换时与 model 相同）
- `status`: 上游响应状态码（上游不可达时为 null）
- `durationMs`: 从请求进入 handler 到响应 pipe 完成的耗时（毫秒）
- `error`: 错误信息字符串（无错误时为 null）

### 2. 异步日志队列

新增 `src/proxy/logger.js` 模块：

- `createLogger({ logDir, prefix })` 创建日志写入器
  - `logDir`: 日志目录绝对路径（如 `/home/user/.claude/logs/`）
  - `prefix`: 日志文件名前缀（如 `proxy-my-profile`）
- 内部维护一个内存队列（数组），请求完成后 `push` 日志条目（O(1) 微秒级）
- 独立写入循环使用 `setImmediate` 调度，每次 drain 取出队列中所有条目，拼接为 JSONL 一次性 `fs.appendFile` 写入
- 写入循环在队列为空时暂停，新条目入队时通过 `setImmediate` 唤醒
- 队列满时（默认 10000 条）丢弃最早的条目，内部计数器 `droppedCount++`，下次成功写入时附带 `{"ts":"...","type":"dropped","count":N}` 标记条目
- **连续写入失败保护**：连续失败 3 次后自动禁用 logger，停止 drain 循环，防止空转热循环
- `flush()` 异步方法：将队列剩余条目通过 `appendFile` 写入磁盘，接受 callback
- `flushSync()` 同步方法：使用 `fs.writeFileSync` + `fs.mkdirSync`，专用于崩溃路径，保证数据落盘
- Logger **不使用 IPC**，仅写文件

### 3. 日志文件路径

日志文件存放在 `.claude/logs/` 目录下（与 `models.yaml` 同级的 `.claude/` 目录）：

```
.claude/
├── models.yaml
└── logs/
    └── proxy-<profile-id>-<date>.log
```

- `profile-id`: 代理对应的 profile ID 或 `base`
- `date`: 启动日期，格式 `YYYY-MM-DD`
- 每次启动代理创建新文件（append 模式，同一天同一 profile 追加到同一文件）
- `configDir` = `path.dirname(configPath)`（配置文件所在目录），日志目录 = `path.join(configDir, 'logs')`

### 4. server.js 集成

在 `createProxyServer(options)` 中：

- `options` 新增 `logger` 字段（由 worker.js 创建后传入）
- 请求 handler 入口（健康检查之前）记录 `startTime = Date.now()`
- 模型解析时，在 `parsed.model` 被修改之前保存 `const originalModel = parsed.model`
- 响应完成检测：在 `upstreamRes.pipe(res)` 之后，通过 `res.on('finish', ...)` 捕获 pipe 完成事件，记录 `durationMs` 并推送日志
- 上游请求错误（`upstreamReq.on('error')`）也推送日志，`status: null`，`error: err.message`
- 客户端中途断开（`res.on('close')` 在 `finish` 之前触发）时，如果 `finish` 未触发则记录 `error: "client_disconnect"`
- 健康检查请求（`/__cc_proxy_status`）不记录日志
- 日志推送为同步 push（微秒级），不等待写入完成

### 5. worker.js 传递参数

`worker.js` 从 argv 解析配置时：

- 从 config 中提取 `profileId` 和 `configDir`
- 调用 `createLogger({ logDir: path.join(configDir, 'logs'), prefix: 'proxy-' + profileId })`
- 将 logger 实例传给 `createProxyServer({ ..., logger })`
- `uncaughtException` handler 改为 `logger.flushSync()` 后再 `process.exit(1)`（同步写入保证落盘）
- 新增 `SIGTERM` handler：`logger.flushSync()` 后 `process.exit(0)`（响应 `cc serve stop` 的优雅关闭）

### 6. serve.js 传递参数

`startProxy` 在 spawn worker 时，将 `profileId` 和 `configDir = path.dirname(configPath)` 加入 worker config JSON。

### 7. Worker stderr 重定向

修改 worker spawn 的 `stdio` 配置：

- 从 `['ignore', 'ignore', 'ignore', 'ipc']` 改为 `['ignore', 'ignore', logFd, 'ipc']`
- `logFd = fs.openSync(logFilePath, 'a')`，将 stderr 追加重定向到日志文件
- 这样 worker 的 `console.error`、未捕获异常的堆栈、Node.js 内部警告都会写入日志文件

### 8. 日志查看命令

新增 `cc serve log <profile-id>` 子命令：

- 显示指定 profile 的最新日志文件最后 20 行
- 支持 `-n, --lines <count>` 指定显示行数
- 搜索策略：在 configPath 同级 `.claude/logs/` 下匹配 `proxy-<profile-id>-*.log`，取最新文件
- 无日志时提示 "暂无日志记录"

## 方案

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/proxy/logger.js` | 异步日志队列 + 批量文件写入器 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/proxy/server.js` | 接收 logger 实例，在请求生命周期中采集日志数据 |
| `src/proxy/worker.js` | 解析新参数，创建 logger，新增 SIGTERM handler，flushSync 替代 async flush |
| `src/commands/serve.js` | 传递 profileId/configDir 到 worker；stderr 重定向到日志文件；新增 log 子命令 |
| `bin/cc.js` | 注册 log 子命令选项 |

## 边界情况

| 场景 | 处理方式 |
|------|----------|
| 日志目录不存在 | `createLogger` 调用 `fs.mkdirSync(logDir, { recursive: true })` |
| 磁盘写入失败 | catch 错误后递增 `failCount`，连续 3 次后禁用 logger |
| 队列满（10000 条） | 丢弃最早条目，内部 `droppedCount++`，下次成功写入时附带 dropped 标记条目 |
| worker 崩溃 | `uncaughtException` handler 调用 `logger.flushSync()`（同步）后 `process.exit(1)` |
| worker 被 SIGTERM 终止 | `SIGTERM` handler 调用 `logger.flushSync()` 后 `process.exit(0)` |
| 非法 JSON 请求体 | model/modelAfter 均为 null，stream 为 null，仍记录请求 |
| 上游不可达 | status 为 null，error 字段填充错误信息 |
| 客户端中途断开 | status 为已发送的状态码（或 null），error 为 "client_disconnect" |
| 日志文件被删除 | 下次 appendFile 时自动重新创建 |
| 无 profile-id（--base 模式） | profileId 使用 `"base"` |
| 请求 URL 含 query 参数 | path 字段只保留 pathname 部分，去除 query string |
| 连续写入失败 3 次 | 自动禁用 logger，停止 drain 循环 |

## 不做的事

- 不做日志轮转/清理策略（手动管理）
- 不做日志搜索/过滤功能
- 不做请求体/响应体完整记录（仅记录元数据）
- 不做远程日志上报
- 不做 Web UI 查看日志
- 不做 `--follow` 实时跟踪（v2 考虑，用户可直接 `tail -f` 日志文件）
- 不做 `sourceIp` / `contentLength` 日志字段（v2 考虑）
- 不修改现有代理转发逻辑的任何行为
- 不增加 CLI 输出的详细程度（serve 启动信息不变）
- Logger 不使用 IPC 通道

## 影响范围

| 文件 | 变更类型 |
|------|----------|
| `src/proxy/logger.js` | 新增 |
| `src/proxy/server.js` | 修改（增加日志采集点） |
| `src/proxy/worker.js` | 修改（创建 logger、新增 SIGTERM、flushSync） |
| `src/commands/serve.js` | 修改（传递参数 + stderr 重定向 + log 子命令） |
| `bin/cc.js` | 修改（注册 log 子命令） |

不影响的文件：`loader.js`、`merger.js`、`validator.js`、`launch.js`、`add.js`、`edit.js`、`use.js`、`parse.js`、`env-registry.js`

## 开发检查点

- [ ] 实现 `src/proxy/logger.js`：异步队列 + 批量文件写入 + flushSync + 连续失败禁用
- [ ] 修改 `src/proxy/server.js`：集成日志采集（startTime、originalModel、res.on('finish')、error）
- [ ] 修改 `src/proxy/worker.js`：解析新参数，创建 logger，新增 SIGTERM handler
- [ ] 修改 `src/commands/serve.js`：传递 profileId/configDir、stderr 重定向
- [ ] 修改 `src/commands/serve.js`：新增 log 子命令
- [ ] 修改 `bin/cc.js`：注册 log 子命令

## 测试检查点

- [ ] logger 单元测试：队列 push/flush/溢出/丢弃计数
- [ ] logger 单元测试：写入文件正确性（JSONL 格式）
- [ ] logger 单元测试：flushSync 同步写入
- [ ] logger 单元测试：连续失败自动禁用
- [ ] server 集成测试：日志条目字段完整性（id、ts、method、path、stream、model、modelAfter、status、durationMs、error）
- [ ] server 集成测试：模型替换记录正确（originalModel vs modelAfter）
- [ ] server 集成测试：stream 字段正确反映请求体 stream 参数
- [ ] server 集成测试：上游错误日志记录（status: null, error 有值）
- [ ] server 集成测试：健康检查不产生日志
- [ ] server 集成测试：日志写入不阻塞响应
- [ ] server 集成测试：客户端断开记录 client_disconnect
- [ ] serve 命令测试：log 子命令输出
