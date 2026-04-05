# PRD: cc serve 命令 — 本地模型路由反代

## 背景与问题

用户使用 Claude Code 连接第三方 API 或需要模型映射时，缺少一个本地代理服务来统一处理：
- 将请求路由到指定的上游 API（`env.ANTHROPIC_BASE_URL`）
- 按需重映射模型名称（如 `claude-sonnet` → `claude-opus`）
- 无模型映射配置时，强制所有请求走 profile 指定的模型

## 解决方案

新增 `cc serve` 子命令，为 profile 启动一个本地 HTTP 反向代理服务。代理在后台运行，`cc <id>` 检测到 `proxy` 字段时自动使用代理地址启动 Claude Code。

## 功能需求

### 1. `cc serve <profile-id>` — 启动代理

1. **Profile 搜索逻辑**同 `cc <id>`（launch）— `findProfile(profileId, target, { mergeBase: false })`，三级搜索：自定义 > 本地 > 全局
2. **校验** — profile 必须有 `env.ANTHROPIC_BASE_URL` 字段（上游 API 地址），否则报错退出
3. **重复启动保护** — 若 profile 已有 `proxy` 字段且进程存活（token 验证通过），拒绝启动并提示先 `cc serve stop`
4. **启动代理服务** — 在后台 fork 一个独立进程，监听随机端口
5. **模型路由逻辑**：
   - 若 profile 有 `modelOverride` 映射表（`{ "源模型": "目标模型" }`）→ 按映射替换请求中的 model 字段
   - 若无 `modelOverride` 但 profile 有 `env.ANTHROPIC_MODEL` → 强制所有请求使用该模型
   - 若两者都没有 → 透传原始 model
6. **写入 proxy 字段** — 代理启动成功后，在 profile 中写入：
   ```yaml
   proxy:
     url: http://localhost:<port>
     pid: <子进程PID>
     port: <端口号>
     token: <随机验证token>
   ```
7. **日志输出** — 启动后打印代理地址和上游地址

### 2. `cc serve --base` — 基于 base 配置启动代理

- 使用 `config.base` 而非 profile
- 同样要求 `env.ANTHROPIC_BASE_URL` 字段
- `proxy` 字段写入 `base` 而非 profile

### 3. `cc serve <profile-id> --run` — 启动代理并启动 Claude Code

1. 先启动代理服务（同上）
2. 代理就绪后，自动执行 `cc <profile-id>` 的逻辑启动 Claude Code
3. Claude Code 退出后代理继续运行（用户需手动 `cc serve stop`）
4. **不支持 `--base --run`** — base 无独立 profile ID，无法直接启动 Claude Code

### 4. `cc serve list` — 列出运行中的代理

- 扫描全局和本地配置中所有含 `proxy` 字段的 profile / base
- 通过 HTTP `GET /__cc_proxy_status` + token 验证进程身份（解决 PID 回收问题）
- 已停止或验证失败的自动清理 proxy 字段
- 不扫描自定义 `-t` 路径（边界场景）
- 输出格式：
  ```
  代理服务列表：
    my-proxy    http://localhost:34567    PID: 12345    [运行中]    (全局)
    local-api   http://localhost:34568    PID: 12346    [已停止]    (本地)
  ```

### 5. `cc serve stop <profile-id>` — 停止指定代理

1. 搜索逻辑同启动（三级搜索 + `-t` 参数）
2. 查找 profile 的 `proxy.pid`
3. 终止进程（`process.kill(pid)`）
4. **删除 profile 中的 `proxy` 字段**
5. 保存配置
6. PID 不存在时静默清理 proxy 字段

### 6. `cc serve stop --all` — 停止所有代理

- 扫描全局 + 本地配置，逐个停止并清理

### 7. `cc <id>` 增强 — 检测 proxy 字段

- 现有 launch 逻辑中新增检测：若 profile 有 `proxy` 字段：
  - 通过 `/__cc_proxy_status` + token 验证进程存活
  - 存活：创建 `settings.<id>.proxy.json`，其中 `env.ANTHROPIC_BASE_URL` 设为 `proxy.url`
  - 合并 profile 的其他设置（permissions、hooks 等，但 `env.ANTHROPIC_BASE_URL` 替换为代理地址）
  - 使用该 settings 文件启动 Claude Code
- 验证失败 → 清理 proxy 字段，按原有逻辑继续（直连）

## Profile Schema 扩展

```yaml
profiles:
  my-proxy:
    modelOverride:                              # 可选：模型映射表
      claude-sonnet-4-20250514: claude-opus-4-20250514
    env:
      ANTHROPIC_BASE_URL: https://api.anthropic.com  # 必填：上游 API 地址（代理转发目标）
      ANTHROPIC_AUTH_TOKEN: sk-xxx
      ANTHROPIC_MODEL: claude-sonnet-4-20250514      # 可选：无 modelOverride 时的默认路由模型
    permissions:
      allow: ["Read", "Write"]
    proxy:                                            # 自动管理，用户不应手动编辑
      url: http://localhost:34567
      pid: 12345
      port: 34567
      token: a1b2c3d4                                  # 随机生成，用于验证进程身份
```

## 新增文件

| 文件 | 职责 |
|------|------|
| `src/proxy/server.js` | HTTP 反向代理核心逻辑（拦截请求、model 替换、转发上游、流式响应回传、健康检查端点） |
| `src/proxy/worker.js` | 后台进程入口，接收配置参数，启动 HTTP 服务器，通过 IPC 通知就绪 |
| `src/commands/serve.js` | serve 命令逻辑（start / list / stop / stopAll） |

## 代理服务实现方案

**不引入新依赖**，使用 Node.js 原生 `http` / `https` 模块：

1. 请求处理：收集完整请求体 → JSON 解析 → 替换 model → 转发到上游
2. 响应回传：`upstreamRes.pipe(res)` 保持流式传输（支持 SSE）
3. 协议自适应：根据 `baseUrl` 协议选择 `http` 或 `https` 模块
4. 后台进程：`child_process.fork(workerPath, [config], { detached: true })` → IPC 通知就绪 → `child.unref()`
5. 健康检查：`GET /__cc_proxy_status?token=<token>` → 返回 `{ status: "ok", pid: <pid> }`，token 不匹配返回 403

## 边界情况

| 场景 | 处理方式 |
|------|----------|
| profile 缺少 `env.ANTHROPIC_BASE_URL` | 报错：`配置 '<id>' 缺少 env.ANTHROPIC_BASE_URL，无法启动代理` |
| profile 已有 proxy 且存活 | 拒绝启动：`代理已在运行中: http://localhost:<port>，请先执行 cc serve stop <id>` |
| 端口被占用 | 随机分配端口（`server.listen(0)`），不冲突 |
| PID 已停止但 proxy 字段未清理 | `serve list` / `cc <id>` 自动清理 |
| PID 被回收（不同进程） | token 验证失败，判定为已停止并清理 |
| 同时有全局和本地同名 profile | 遵循现有三级搜索优先级 |
| `cc serve stop` 时 PID 已不存在 | 静默清理 proxy 字段，不报错 |
| Windows 平台 | `process.kill(pid)` 兼容；detached 进程 + `disconnect` 事件处理 |
| 代理上游不可达 | 返回 502 Bad Gateway |
| 上游为 HTTP（如 Ollama） | 根据协议自动选择 http/https 模块 |

## 不做的事

- 不做 API Key 注入 — auth token 由 Claude Code 通过 `env.ANTHROPIC_AUTH_TOKEN` 发送，代理透传
- 不做请求日志/监控 — 保持代理极简
- 不做负载均衡 — 单上游地址
- 不支持自定义端口 — 随机分配避免冲突
- 不支持 `--base --run` — base 无 profile ID，无法直接启动 Claude Code
- `serve list` 不扫描自定义 `-t` 路径

---

## 开发检查点

- [ ] `src/proxy/server.js` — HTTP 反代核心（请求拦截、model 替换、转发、流式响应、健康检查端点）
- [ ] `src/proxy/worker.js` — 后台进程入口（加载配置、启动 server、IPC 通知就绪、处理 disconnect）
- [ ] `src/commands/serve.js` — serve 命令（start / list / stop / stopAll 逻辑）
- [ ] `bin/cc.js` — 注册 `serve` 子命令及其选项
- [ ] `src/commands/launch.js` — 检测 `proxy` 字段，token 验证，使用 `settings.<id>.proxy.json`

## 测试检查点

- [ ] 代理服务器正确转发请求到上游（HTTP/HTTPS）
- [ ] `modelOverride` 映射生效：请求中的 model 被替换
- [ ] 无 `modelOverride` 时，强制使用 profile 的 `ANTHROPIC_MODEL`
- [ ] 无 model 配置时，透传原始 model
- [ ] `/__cc_proxy_status` 端点 token 验证正常
- [ ] PID 回收场景下 token 验证失败 → 正确清理
- [ ] 重复启动被拒绝，提示先 stop
- [ ] `cc serve list` 正确显示运行状态并清理僵尸条目
- [ ] `cc serve stop` 正确终止进程并清理 proxy 字段
- [ ] `cc serve stop --all` 清理所有代理
- [ ] `cc <id>` 检测到 proxy 字段时生成正确的 `settings.<id>.proxy.json`
- [ ] proxy 进程已停止时 `cc <id>` 清理字段并降级为直连
- [ ] 缺少 `env.ANTHROPIC_BASE_URL` 时 `cc serve` 报错
- [ ] `--base` 模式正常工作
- [ ] `--run` 模式启动代理并启动 Claude Code
- [ ] 已有测试不受影响（`pnpm test` 全部通过）
