## 入口与 CLI (bin/)

**文件：** `bin/cc.js` — 程序唯一入口点，基于 Commander.js 构建 CLI。

### 全局选项

| 选项 | 作用 |
|------|------|
| `-t, --target <file>` | 指定自定义配置文件路径（YAML），可被子命令覆盖 |

所有子命令通过 `options.target || program.opts().target` 实现全局选项透传，即子命令未指定 `-t` 时回退到全局 `-t`。

### 默认动作（无子命令）

当直接运行 `zcc <profile-id>` 时，调用 `launchCommand(profileId, options, extraArgs)` 启动 Claude Code。不传 profile-id 则显示帮助。`passThroughOptions()` 确保额外参数（如 `--verbose`）不被 Commander 消费，原样传递给 launch。

### 子命令注册表

| 子命令 | 处理函数 | 来源模块 | 说明 |
|--------|---------|----------|------|
| `list` | `listCommand` | `src/commands/list` | 列出所有 profiles，支持 `-g` |
| `add <id>` | `addCommand` | `src/commands/add` | 新增 profile，支持 `-g` `-s <file>` `-b` |
| `remove <id>` | `removeCommand` | `src/commands/remove` | 删除 profile，支持 `-g` |
| `edit <id>` | `editCommand` | `src/commands/edit` | 编辑 profile，支持 `-g` `-b` |
| `alias [name]` | `aliasCommand` | `src/commands/alias` | 修改 CLI 命令别名 |
| `use [id]` | `useCommand` | `src/commands/use` | 应用 profile 到 settings 文件（不启动），支持 `-g` `-b` |
| `restore` | `restoreCommand` | `src/commands/restore` | 从备份恢复 settings，支持 `-g` |
| `parse <path> [id]` | `parseCommand` | `src/commands/parse` | 导入 settings JSON 为 profile，支持 `-g` `-b` `-c` |
| `test [id]` | `testCommand` | `src/commands/test` | 测试 profile 的 API 连通性，支持 `-b` |
| `models [id]` | `modelsCommand` | `src/commands/models` | 查询可用模型列表，支持 `-b` |
| `knowledge <sub>` | `knowledgeCommand` | `src/commands/knowledge` | 知识库管理，子命令：status/update/verify/rebuild |
| `serve [id]` | `serveCommand` | `src/commands/serve` | 本地模型代理，含嵌套子命令 list/stop/log |

### serve 嵌套子命令

`serve` 是唯一拥有嵌套子命令的命令：

- **`serve [profile-id]`** — 启动代理，`--run` 同时启动 Claude Code
- **`serve list`** — 列出运行中的代理
- **`serve stop [profile-id]`** — 停止代理，`--all` 停止全部，支持 `-b`
- **`serve log <profile-id>`** — 查看请求日志，`-n` 控制行数

`serveCommand` 通过第一个参数区分动作类型（`undefined`/`'list'`/`'stop'`/`'log'`），即一个处理函数覆盖所有子命令。

### 依赖关系

```
bin/cc.js
├── commander (Command)
└── src/commands/
    ├── launch, list, add, remove, edit, alias,
    ├── use, restore, parse, serve, test, models,
    └── knowledge
```

入口文件仅负责命令注册和参数解析，不含业务逻辑。每个子命令的处理函数从 `src/commands/` 对应模块导入，各模块导出单一函数。