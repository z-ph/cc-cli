## commands (src/commands/)

`src/commands/` 包含所有 CLI 子命令的实现，每个文件导出单一主函数，由 `bin/cc.js` 通过 Commander.js 注册调用。所有命令共享统一的配置路径解析模式：`--target` 自定义路径 > `--global` 全局路径 > 默认本地路径（`./.claude/models.yaml`）。

### 模块清单

#### list.js — 列出配置档案

- **导出**：`listCommand(options)`
- **职责**：读取配置文件，显示所有 profile 的 ID 及其包含的 env 变量和 settings 字段摘要
- **依赖**：`config/loader`（加载配置）

#### add.js — 交互式添加配置档案

- **导出**：`addCommand(profileId, options)`、`maybeSaveToRegistry(key, registry)`、`promptSubagentModel(modelValue, existingValue)`
- **职责**：通过 inquirer 交互式收集 env 变量（ANTHROPIC_BASE_URL、ANTHROPIC_AUTH_TOKEN、ANTHROPIC_MODEL、CLAUDE_CODE_SUBAGENT_MODEL 及自定义变量）、permissions、自定义 JSON 设置，保存为新 profile 或 base 配置
- **特性**：
  - 支持 `--base` 模式添加共享默认配置，使用 `deepMerge` 合并
  - 支持 `--source <file>` 从现有 settings JSON 预填表单
  - `maybeSaveToRegistry` 将自定义环境变量保存到 env-registry 供后续快速选择
  - `promptSubagentModel` 在设置 ANTHROPIC_MODEL 后提示是否同步 CLAUDE_CODE_SUBAGENT_MODEL
- **依赖**：`config/loader`、`config/validator`、`config/env-registry`、`config/merger`、`config/env-selector-prompt`、`inquirer`

#### edit.js — 交互式编辑配置档案

- **导出**：`editCommand(profileId, options)`
- **职责**：编辑已有 profile 或 base 配置。与 add 交互流程类似，但预填现有值，并支持重命名 profile ID、删除非核心环境变量
- **内部函数**：
  - `manageExistingEnvVars(env, coreKeys)` — checkbox 交互，允许用户标记删除非核心 env 变量
  - `runEnvSelector(env)` — env-selector 循环添加环境变量
- **依赖**：`config/loader`、`config/validator`、`config/env-registry`、`config/merger`、`config/env-selector-prompt`、`inquirer`、**`commands/add`**（复用 `maybeSaveToRegistry`、`promptSubagentModel`）

#### remove.js — 删除配置档案

- **导出**：`removeCommand(profileId, options)`
- **职责**：从配置文件中删除指定 profile
- **依赖**：`config/loader`

#### parse.js — 从 settings JSON 导入配置

- **导出**：`parseCommand(settingsPath, profileId, options)`
- **职责**：读取 Claude Code 的 `settings.json` 文件，将其内容解析为 profile 保存到 YAML 配置中
- **特性**：
  - `--base` 模式：合并到 config.base
  - `--copy` 模式：格式化为 YAML 并复制到剪贴板（跨平台：clip/pbcopy/xclip）
  - 冲突处理：profile ID 重复时提供自动后缀或手动重命名选项（`handleConflict`、`findAvailableSuffix`）
- **依赖**：`config/loader`、`config/validator`、`config/merger`、`inquirer`

#### alias.js — 管理 CLI 别名

- **导出**：`aliasCommand(newAlias, options)`
- **职责**：查看或修改 `settings.alias` 字段，影响 CLI 调用命令名（默认 `zcc`）
- **依赖**：`config/loader`

#### use.js — 应用配置到 settings 文件

- **导出**：`useCommand(profileId, options)`
- **职责**：将 profile 或 base 配置写入 Claude Code 的 settings 文件（`--global` 写入 `~/.claude/settings.json`，否则写入 `./.claude/settings.local.json`）
- **特性**：
  - 首次使用时自动备份原始 settings 为 `settings.source.json`
  - 后续应用时与原始 settings 做 `deepMerge`，profile 值覆盖冲突
- **依赖**：`config/loader`（含 `findProfile`）、`config/merger`

#### restore.js — 恢复原始 settings

- **导出**：`restoreCommand(options)`
- **职责**：从 `settings.source.json` 备份恢复 Claude Code 的 settings 文件，撤销 `use` 命令的效果
- **依赖**：无外部模块依赖（仅 `fs`、`path`、`os`）

#### serve.js — 代理服务管理（最大模块，~500 行）

- **导出**：`serveCommand(action, id, options)`、`checkProxyAlive(proxy)`
- **职责**：管理 API 代理服务的完整生命周期，包括启动、停止、列表、日志查看
- **子命令路由**：
  - 无 action / `start` — `startProxy(profileId, options)`：fork `src/proxy/worker.js` 子进程，生成随机 token，等待 IPC ready 消息，将 proxy 字段（url、pid、port、token）写入配置
  - `stop` — `stopProxy(profileId, options)` / `stopAllProxies()`：通过 PID 终止进程，清理配置中的 proxy 字段
  - `list` — `listProxies()`：扫描本地和全局配置中的 proxy 字段，健康检查并报告状态，自动清理已停止的代理
  - `log` — `logProxy(profileId, options)`：读取 `.claude/logs/proxy-<id>-<date>.log` 日志文件，格式化输出 JSON 结构的请求日志
- **关键辅助函数**：
  - `checkProxyAlive(proxy)` — HTTP GET `/__cc_proxy_status?token=...`，3 秒超时
  - `scanProxies()` — 扫描本地+全局配置中的所有 proxy 字段
  - `removeProxyFromConfig(configPath, config, target)` — 删除 proxy 字段并保存
  - `generateToken()` — `crypto.randomBytes(16).toString('hex')`
- **特性**：`--base` 支持为 base 配置启动代理；`--run` 启动代理后自动执行 `launchCommand`；原子写入、进程分离（`unref`）、日志按日期轮转
- **依赖**：`config/loader`、`child_process`、`crypto`、`http`

#### launch.js — 启动 Claude Code

- **导出**：`launchCommand(profileId, options, extraArgs)`
- **职责**：使用指定 profile 的配置生成临时 settings 文件，通过 `spawn('claude', ['--settings', ...])` 启动 Claude Code
- **特性**：
  - 代理模式：检测 profile.proxy 字段，若代理存活则替换 `ANTHROPIC_BASE_URL` 为代理地址，写入 `settings.<id>.proxy.json`；若代理已停止则清理 proxy 字段并降级为直连
  - 设置文件存放在 models.yaml 同级 `.claude/` 目录下（`settings.<id>.json`）
- **依赖**：`config/loader`、**`commands/serve`**（`checkProxyAlive`）

#### test.js — 测试 API 连接

- **导出**：`testCommand(profileId, options)`
- **职责**：验证 profile 或 base 配置的 API 连通性，向 `ANTHROPIC_BASE_URL/models` 发送请求，报告连接状态（成功/认证失败/不可达）
- **依赖**：`config/loader`（含 `findProfile`）、`api/client`

#### models.js — 查询可用模型

- **导出**：`modelsCommand(profileId, options)`
- **职责**：查询 profile 或 base 配置对应 API 端点的可用模型列表，解析响应中的模型名称并排序输出
- **内部函数**：`extractModelNames(data)` — 兼容多种 API 响应格式（`data.data[]`、`data.models[]`、裸数组）
- **依赖**：`config/loader`（含 `findProfile`）、`api/client`

#### knowledge.js — 知识库管理（~640 行）

- **导出**：`knowledgeCommand(subcommand, options)`、`statusKnowledge()`、`updateKnowledge(options)`、`verifyKnowledge()`、`rebuildKnowledge(options)`、`classifyChange(stats)`、`parseNumstat(output)`、`discoverSections(projectDir)`、`sectionTitle(key, paths)`
- **职责**：基于 git commit hash 追踪知识时效性的项目知识库管理系统，支持自动发现、增量更新和 AI 分析
- **子命令路由**：`status`、`update`、`verify`、`rebuild`
- **存储结构**：`.knowledge/index.json`（version 2，sections 各记录 commit 和 paths）+ `.knowledge/sections/<key>.md`
- **自动发现**（`discoverSections`）：扫描项目目录，`src/` 子目录各自独立，其他顶层目录各自独立，排除 node_modules/.vscode/tests/docs 等非源码目录
- **时效性检测**：通过 `git diff --numstat <section.commit>..HEAD -- <paths>` 计算变更量，`classifyChange` 分为 unchanged / minor / significant 三级
- **AI 集成**（`--profile <id>`）：通过 `spawn('claude', ...)` 调用 Claude Code CLI，使用指定 profile 的 settings，传入 prompt 分析源码并生成/更新章节内容
- **原子写入**：`atomicWrite` 先写临时文件再 rename，`cleanupTempFiles` 清理残留临时文件
- **依赖**：`config/loader`（`findProfile`、`getSettingsDir`）

### 模块间依赖关系

```
edit.js ──→ add.js（复用 maybeSaveToRegistry、promptSubagentModel）
launch.js ──→ serve.js（使用 checkProxyAlive）
serve.js ──→ launch.js（--run 模式，延迟 require 避免循环依赖）
test.js ──→ api/client
models.js ──→ api/client
knowledge.js ──→ config/loader
```

所有命令模块共同依赖 `config/loader` 进行配置路径解析和文件读写。`add.js` 和 `edit.js` 是最重的交互式模块，共享 env-selector 和 env-registry 逻辑。`serve.js` 和 `launch.js` 构成代理启动-使用的核心链路，通过延迟 require 解决循环依赖。