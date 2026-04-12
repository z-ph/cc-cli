## 命令层 (src/commands/)

命令层包含 13 个模块，每个模块对应一个 CLI 子命令。所有模块遵循统一模式：导出单个主函数（async 或 sync），接收 `profileId` 和 `options` 参数，通过 `config/loader` 加载配置。

### 模块总览

| 模块 | 导出函数 | 类型 | 核心职责 |
|------|---------|------|---------|
| `list.js` | `listCommand` | sync | 列出配置文件中的所有 profiles |
| `add.js` | `addCommand`, `maybeSaveToRegistry`, `promptSubagentModel` | async | 交互式创建 profile 或 base 配置 |
| `edit.js` | `editCommand` | async | 交互式编辑已有 profile 或 base 配置 |
| `remove.js` | `removeCommand` | sync | 删除指定 profile |
| `parse.js` | `parseCommand` | async/sync | 导入 Claude Code settings JSON 为 profile |
| `alias.js` | `aliasCommand` | sync | 查看/修改 CLI 别名 |
| `use.js` | `useCommand` | sync | 将 profile 应用为当前 settings |
| `restore.js` | `restoreCommand` | sync | 从备份恢复原始 settings |
| `launch.js` | `launchCommand` | async | 启动 Claude Code 进程 |
| `serve.js` | `serveCommand`, `checkProxyAlive` | async | 代理服务管理（启动/停止/列表/日志） |
| `test.js` | `testCommand` | async | 测试 profile 的 API 连通性 |
| `models.js` | `modelsCommand` | async | 查询 profile 的可用模型列表 |
| `knowledge.js` | `knowledgeCommand` 及各子命令函数 | async | 项目知识库管理 |

### 统一的配置定位模式

几乎所有命令共享相同的配置文件定位逻辑：

1. `options.target` → 使用指定路径
2. `options.global` → 全局配置 `~/.claude/models.yaml`
3. 默认 → 本地配置 `./.claude/models.yaml`，不存在时创建空配置

异常：`alias` 始终默认全局配置；`restore` 不加载 models.yaml，直接操作 settings 文件。

### 核心模块详解

#### add.js — 交互式创建

最复杂的命令之一（~440 行）。支持两种模式：

- **普通模式** (`addCommand(profileId)`)：通过 inquirer 交互式引导用户输入核心环境变量（`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL`），再选择非核心环境变量（通过 `env-selector` 自定义 prompt 支持分页和搜索），最后配置 permissions 和自定义 JSON 设置。
- **base 模式** (`options.base`)：向 `config.base` 写入共享默认配置，使用 `deepMerge` 合并。
- **源导入** (`options.source`)：从 JSON 文件预填 env vars 和 settings 字段。

辅助函数：
- `maybeSaveToRegistry(key, registry)` — 提示用户将自定义环境变量保存到 env-registry
- `promptSubagentModel(modelValue, existingValue)` — 引导设置 `CLAUDE_CODE_SUBAGENT_MODEL`，可选择与 `ANTHROPIC_MODEL` 一致

依赖：`config/loader`, `config/validator`, `config/env-registry`, `config/merger`, `config/env-selector-prompt`, `inquirer`

#### edit.js — 交互式编辑

结构与 `add.js` 高度相似，额外功能：
- 允许修改 profile ID（重命名）
- 通过 `manageExistingEnvVars()` 用 checkbox 让用户选择删除非核心环境变量
- 使用 `runEnvSelector()` 封装环境变量选择循环
- 编辑时预填现有值作为 default
- 保存时使用直接赋值而非 merge（覆盖式更新）

从 `add.js` 导入 `maybeSaveToRegistry` 和 `promptSubagentModel` 复用逻辑。

#### parse.js — JSON 导入

从 Claude Code 的 `settings.json` 文件导入为 profile。支持：
- **普通模式**：解析 JSON → 写入 `config.profiles[profileId]`
- **base 模式** (`options.base`)：解析 JSON → `deepMerge` 到 `config.base`
- **copy 模式** (`options.copy`)：转为 YAML 复制到剪贴板，供手动粘贴
- **冲突处理** (`handleConflict`)：profile ID 已存在时，交互选择重命名（自动后缀 `-1`/`-2`）或手动输入新名

辅助函数：`copyToClipboard`（跨平台剪贴板写入），`findAvailableSuffix`（自动递增后缀），`doSave`，`handleConflict`

依赖：`config/loader`, `config/validator`, `config/merger`, `inquirer`, `js-yaml`, `child_process`

#### use.js — 应用配置

将 profile 内容写入 Claude Code 的 settings 文件：
- **本地模式**（默认）：写入 `.claude/settings.local.json`
- **全局模式** (`options.global`)：写入 `~/.claude/settings.json`
- **base 模式** (`options.base`)：直接使用 `config.base` 作为 profile

关键机制：首次 `use` 时自动创建 `settings.source.json` 备份原始 settings，后续应用时以 `deepMerge(sourceSettings, profile)` 合并，profile 优先。

#### restore.js — 恢复配置

`use` 的逆操作：将 `settings.source.json` 复制回 `settings.json`（或 `settings.local.json`），恢复原始状态。极简实现（~30 行），仅依赖 `fs`/`path`/`os`。

#### launch.js — 启动 Claude Code

通过 `spawn('claude', ['--settings', file])` 启动 Claude Code CLI：
1. 将 profile 内容写入临时 settings 文件（`.claude/settings.<id>.json`）
2. **代理模式**：若 profile 有 `proxy` 字段且存活，生成 `settings.<id>.proxy.json`，替换 `ANTHROPIC_BASE_URL` 为代理地址
3. **降级处理**：若代理已停止，自动清理 `proxy` 字段，降级为直连模式
4. Windows 兼容：使用 `shell: true` 启动

依赖：`config/loader`, `./serve`（`checkProxyAlive`）

#### serve.js — 代理服务管理

最复杂的命令（~500 行），管理 API 代理进程的生命周期。子命令路由：

- **无 action / start**：`startProxy(profileId)` — fork `src/proxy/worker.js` 子进程，等待 IPC ready 消息，写入 `proxy` 字段到配置
- **stop**：`stopProxy(profileId)` — 通过 PID 终止进程，清理配置中的 `proxy` 字段
- **list**：`listProxies()` — 扫描本地+全局配置中的 proxy 字段，HTTP 健康检查存活状态
- **log**：`logProxy(profileId)` — 读取 `.claude/logs/proxy-<id>-<date>.log`，格式化输出

关键机制：
- `proxy` 字段结构：`{ url, pid, port, token }`，自动管理在配置中
- `checkProxyAlive(proxy)` — 通过 HTTP GET `/__cc_proxy_status?token=...` 验证进程存活
- `scanProxies()` — 扫描本地和全局配置中所有带 proxy 的 profile/base
- 重复启动保护：已存活则拒绝，已停止则自动清理
- `--run` 选项：启动代理后立即调用 `launchCommand`

导出 `checkProxyAlive` 供 `launch.js` 使用。

依赖：`config/loader`, `../proxy/worker`, `child_process`, `crypto`, `http`

#### test.js — API 连通性测试

读取 profile 的 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_AUTH_TOKEN`，调用 `sendApiRequest(baseUrl, token, { path: '/models' })` 测试连接。支持 base 模式和普通 profile 模式。根据状态码给出不同的反馈信息（成功/认证失败/不支持/连接失败）。

依赖：`config/loader`, `../api/client`

#### models.js — 模型列表查询

与 `test.js` 结构相似，查询 `/models` 端点并解析响应。`extractModelNames(data)` 兼容多种 API 响应格式（`data.data[]`, `data.models[]`, 顶层数组）。

依赖：`config/loader`, `../api/client`

#### knowledge.js — 知识库管理

基于 git commit hash 追踪知识时效性的子系统（~580 行）。子命令：

- **status**：对比每个 section 的 commit 与 HEAD，通过 `git diff --numstat` 分析变更量，分为 `unchanged`/`minor`/`stale` 三级
- **update**：增量更新 stale 章节。收集 diff 摘要，可选调用 Claude Code agent（`callClaudeCode`）进行 AI 分析重写
- **verify**：验证 index.json 格式、sections 目录存在、各 commit 有效
- **rebuild**：从零重建知识库，生成 index.json 和所有 section 骨架文件

Section 定义在 `DEFAULT_SECTIONS` 中：`bin`, `config`, `commands`, `proxy`, `api`，每个映射到对应源码路径。

关键函数：
- `callClaudeCode(prompt, profileId)` — 通过 `spawn('claude', ['-p', '--output-format', 'text'])` 调用 Claude Code agent
- `classifyChange(stats)` — 基于变更行数和文件数判断变更等级
- `atomicWrite(filePath, content)` — 先写临时文件再 rename，保证原子性

依赖：`config/loader`, `child_process`

### 模块间依赖关系

```
launch.js ──→ serve.js (checkProxyAlive)
edit.js ──→ add.js (maybeSaveToRegistry, promptSubagentModel)
serve.js ──→ launch.js (--run 模式，动态 require 避免循环)
test.js ──→ api/client.js
models.js ──→ api/client.js
serve.js ──→ proxy/worker.js (fork 子进程)
所有命令模块 ──→ config/loader.js
add/edit/parse ──→ config/validator.js, config/merger.js
add/edit ──→ config/env-registry.js, config/env-selector-prompt.js
```

### 设计模式

- **交互式命令**（`add`, `edit`, `parse` 冲突处理）使用 `inquirer`，因高度交互性被排除在 Jest 覆盖率之外
- **非交互式命令**（`list`, `remove`, `alias`, `use`, `restore`）纯同步，便于测试
- **异步命令**（`launch`, `serve`, `test`, `models`, `knowledge`）涉及子进程或网络 I/O
- `serve.js` 与 `launch.js` 存在潜在循环依赖，`serve.js` 的 `--run` 模式使用动态 `require('./launch')` 延迟加载来规避