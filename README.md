# CC CLI 用户手册

快速启动不同配置的 Claude Code 命令行工具。

---

## 安装

```bash
# 进入项目目录
cd /path/to/cli

# 安装依赖
npm install

# 创建全局链接
npm link
```

---

## 快速开始

### 1. 添加 env 配置（模型/服务提供商）

```bash
cc add glm5.1
```

按提示输入：
- `ANTHROPIC_BASE_URL`: API 地址
- `ANTHROPIC_AUTH_TOKEN`: API 密钥
- `ANTHROPIC_MODEL`: 模型名称（可留空）

### 2. 启动 Claude Code

```bash
cc glm5.1    # 以 env 注入方式启动
```

### 3. 添加 settings 配置（权限/沙箱等）

```bash
cc add-config strict
```

按提示配置 permissions 等 Claude Code settings 字段。

### 4. 应用 settings 配置

```bash
cc use strict       # 写入 .claude/settings.local.json
cc use strict -g    # 写入 ~/.claude/settings.json（全局）
```

---

## 命令列表

| 命令 | 说明 |
|------|------|
| `cc <env-id>` | 以 env 注入方式启动 Claude Code |
| `cc use <config-id>` | 将 settings 配置写入 settings 文件（不启动） |
| `cc add <id>` | 添加 env 配置 |
| `cc add-config <id>` | 添加 settings 配置 |
| `cc edit <id>` | 编辑 env 配置 |
| `cc edit-config <id>` | 编辑 settings 配置 |
| `cc remove <id>` | 删除 env 配置 |
| `cc remove-config <id>` | 删除 settings 配置 |
| `cc list` | 列出所有配置 |
| `cc restore` | 恢复 settings 备份 |
| `cc alias [name]` | 修改 CLI 命令别名 |

---

## 配置文件

配置文件位置：`~/.claude/models.yaml`（全局）或 `./.claude/models.yaml`（项目级）

### 结构说明

```yaml
settings:
  alias: cc              # CLI 命令别名

envs:                    # 环境变量配置（通过 env 注入启动）
  <env-id>:
    ANTHROPIC_BASE_URL: <url>
    ANTHROPIC_AUTH_TOKEN: <key>
    ANTHROPIC_MODEL: <model-name>
    # 其他环境变量...

configs:                 # Claude Code settings 配置（通过 settings 文件应用）
  <config-id>:
    permissions:
      allow: [...]
      deny: [...]
    hooks: {...}
    # 其他 Claude Code settings 字段...
```

### 使用流程

**env 配置**（`cc <env-id>`）：直接通过环境变量注入启动 Claude Code，不修改 settings 文件。

**settings 配置**（`cc use <config-id>`）：合并到 `.claude/settings.local.json`（或 `~/.claude/settings.json`），首次使用时自动备份原文件为 `settings.source.json`。

---

## 常见问题

### Q: 提示 "Env configuration 'xxx' not found"
配置不存在。先使用 `cc add xxx` 创建配置，或用 `cc list` 查看可用配置。

### Q: `cc <id>` 和 `cc use <id>` 有什么区别？
- `cc <id>`：从 `envs` 读取环境变量，以 env 注入方式启动 Claude Code
- `cc use <id>`：从 `configs` 读取 settings 配置，写入 settings 文件

### Q: 如何恢复被覆盖的 settings 文件？
```bash
cc restore       # 恢复 .claude/settings.local.json
cc restore -g    # 恢复 ~/.claude/settings.json
```

### Q: 命令冲突（`cc` 被其他程序占用）
修改别名：
```bash
cc alias ccl    # 改用 ccl 命令
```

---

## 卸载

```bash
# 取消全局链接
npm unlink -g cc-cli

# 删除配置文件（可选）
rm ~/.claude/models.yaml
```
