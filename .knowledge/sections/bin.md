## bin (bin/)

**入口文件：`bin/cc.js`** — 基于 Commander.js 的 CLI 入口，注册名称 `zcc`，版本 `1.0.0`。

### 全局选项

- `-t, --target <file>`：指定自定义 YAML 配置文件路径，所有子命令均继承此选项

### 默认动作（无子命令）

```
zcc <profile-id> [extra args...]
```

当直接传入 profile-id 时，调用 `launchCommand` 启动 Claude Code，`passThroughOptions()` 使额外参数原样透传。未提供 profile-id 时显示帮助。

### 子命令注册

| 子命令 | 参数 | 核心选项 | 说明 |
|---|---|---|---|
| `list` | 无 | `-g, --global` | 列出所有 profiles |
| `add <profile-id>` | 必填 | `-g, --global`, `-s, --source <file>`, `-b, --base` | 新增 profile，支持从 JSON 导入 |
| `remove <profile-id>` | 必填 | `-g, --global` | 删除 profile |
| `edit <profile-id>` | 必填 | `-g, --global`, `-b, --base` | 编辑已有 profile |
| `alias [name]` | 可选 | 无 | 修改 CLI 命令别名 |
| `use [profile-id]` | 可选 | `-g, --global`, `-b, --base` | 将 profile 写入 settings 文件但不启动 |
| `restore` | 无 | `-g, --global` | 从备份恢复 settings 文件 |
| `parse <path> [id]` | 必填+可选 | `-g, --global`, `-b, --base`, `-c, --copy` | 导入 settings JSON 为 profile |
| `test [profile-id]` | 可选 | `-b, --base` | 测试 API 连接 |
| `models [profile-id]` | 可选 | `-b, --base` | 查询可用模型列表 |
| `knowledge <sub>` | 必填 | `--section <name>`, `--profile <id>` | 知识库管理（status/update/verify/rebuild） |

### serve 子命令树

`serve` 自带嵌套子命令：

- `zcc serve [profile-id]` — 启动代理，`--run` 同时启动 Claude Code，`-b, --base`
- `zcc serve list` — 列出运行中的代理
- `zcc serve stop [profile-id]` — 停止代理，`--all` 全停，`-b, --base`
- `zcc serve log <profile-id>` — 查看请求日志，`-n, --lines <count>`（默认 20 行）

### 选项透传机制

各子命令在 `action` 中将自身 options 与全局 `program.opts().target` 合并后传给命令处理函数，确保 `-t, --target` 在任意子命令层级均生效。模式：`{ ...options, target: options.target || program.opts().target }`。

### 模块依赖

每个子命令从 `src/commands/` 导入对应的处理函数：`launch`、`list`、`add`、`remove`、`edit`、`alias`、`use`、`restore`、`parse`、`serve`、`test`、`models`、`knowledge`。