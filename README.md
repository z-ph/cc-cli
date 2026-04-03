# CC CLI 使用手册

快速启动不同配置的 Claude Code 命令行工具。

---

## 安装

```bash
npm i -g @zphhpzzph/cc-cli@latest
```

> **项目地址：** [https://github.com/zphhpzzph/cc-cli](https://github.com/zphhpzzph/cc-cli) — 可下载源码查看或参与贡献

---

## 快速开始

### 1. 添加配置

```bash
cc add glm51       # 默认保存到当前项目 ./claude/models.yaml
cc add glm51 -g    # 推荐保存到全局 ~/.claude/models.yaml
```

> **注意：** `cc add` 默认作用域为当前项目目录。推荐使用 `-g` 参数将配置添加到全局，这样在任意目录下都可以使用该配置。

按提示输入：
- `ANTHROPIC_BASE_URL`: API 地址
- `ANTHROPIC_AUTH_TOKEN`: API 密钥
- `ANTHROPIC_MODEL`: 模型名称（可留空）
- 权限配置（可留空）
- 其他设置字段（可选）

### 2. 启动 Claude Code

```bash
cc glm51    # 生成 settings.glm51.json，以 --settings 方式启动
```

### 3. 应用配置到 settings 文件（不启动）

```bash
cc use strict       # 写入 .claude/settings.local.json
cc use strict -g    # 写入 ~/.claude/settings.json（全局）
```

---

## 命令列表

| 命令 | 说明 |
|------|------|
| `cc <id>` | 启动 Claude Code，自动生成 settings 文件并通过 --settings 传入 |
| `cc add <id>` | 添加配置方案 |
| `cc edit <id>` | 编辑配置方案 |
| `cc remove <id>` | 删除配置方案 |
| `cc parse <file> <id>` | 从 settings JSON 文件导入为 profile（`-c` 仅复制到剪贴板） |
| `cc list` | 列出所有配置方案 |
| `cc use <id>` | 将配置写入 settings 文件（不启动） |
| `cc restore` | 恢复 settings 备份 |
| `cc alias [name]` | 修改 CLI 命令别名 |

所有命令支持 `-g`（全局）和 `-t <file>`（自定义配置文件）选项。

---

## 配置文件

配置文件位置：`~/.claude/models.yaml`（全局）或 `./.claude/models.yaml`（项目级）

### 结构说明

```yaml
settings:
  alias: cc              # CLI 命令别名

base:                    # 所有 profiles 共享的默认配置（可选）
  env:                   # profile 中同名字段会覆盖 base
    ANTHROPIC_AUTH_TOKEN: <shared-key>
  permissions:
    deny:
      - "Bash(rm -rf *)"

profiles:                # 统一的配置方案
  <id>:
    env:                 # 环境变量（可选）
      ANTHROPIC_BASE_URL: <url>
      ANTHROPIC_MODEL: <model-name>
    permissions:         # Claude Code 设置（可选）
      allow: [...]
      deny: [...]
    hooks: {...}         # 其他 Claude Code settings 字段
```

### Base 传导链

`base` 配置具有跨文件传导能力，合并顺序为 **全局 base → 本地 base → profile**：

- 当 profile 在本地 `./.claude/models.yaml` 中找到时，全局 `~/.claude/models.yaml` 的 `base` 也会被加载
- 同名字段的优先级：profile > 本地 base > 全局 base
- 当 profile 仅在全局配置中时，只应用全局 base

示例：全局 base 定义共享 token，本地 base 覆盖 URL，profile 指定模型——三层配置自动合并。

### 启动流程

`cc <id>` 的工作方式：
1. 加载全局 base + 本地 base（传导链）
2. 从 `profiles[id]` 读取配置，合并 base 后生成完整 settings
3. 生成 `settings.<id>.json` 到 models.yaml 所在的 `.claude/` 目录下
4. 使用 `claude --settings settings.<id>.json` 启动

### Settings 合并与优先级

`cc <id>` 通过 `--settings` 传入 profile 配置，但 Claude Code 仍会自动加载以下三个内置层级：

| 层级 | 文件路径 | 说明 |
|------|----------|------|
| 1（最高） | `--settings` 传入的文件 | `cc <id>` 生成的 `settings.<id>.json` |
| 2 | `.claude/settings.local.json` | 项目本地设置（不提交到 git） |
| 3 | `.claude/settings.json` | 项目共享设置（提交到 git） |
| 4（最低） | `~/.claude/settings.json` | 全局用户设置 |

**合并规则：**

- **标量值**（如 `model`、`theme`）：高优先级覆盖低优先级，`--settings` 传入的 profile 会覆盖项目级和全局设置
- **数组值**（如 `permissions.allow`、`permissions.deny`）：所有层级**合并拼接并去重**，不会互相覆盖。例如全局允许 `Bash(npm run *)`，profile 允许 `Bash(git:*)`，两者同时生效
- **对象值**：深度合并，同路径的键高优先级覆盖

> **注意：** `permissions.deny` 的规则在运行时优先于 `allow`。即使 profile 的 `allow` 允许了某操作，如果其他层级的 `deny` 包含该操作，仍会被拒绝。

### settings 文件位置

| models.yaml 来源 | settings 文件路径 |
|---|---|
| 本地 `./.claude/models.yaml` | `./.claude/settings.<id>.json` |
| 全局 `~/.claude/models.yaml` | `~/.claude/settings.<id>.json` |
| 自定义 `-t path/models.yaml` | `path/settings.<id>.json` |

---

## 常见问题

### Q: 提示 "Profile 'xxx' not found"
配置不存在。先使用 `cc add xxx` 创建配置，或用 `cc list` 查看可用配置。

### Q: `cc <id>` 和 `cc use <id>` 有什么区别？
- `cc <id>`：生成临时 settings 文件并启动 Claude Code
- `cc use <id>`：将配置合并写入 `.claude/settings.local.json`（不启动）

### Q: 如何恢复被覆盖的 settings 文件？
```bash
cc restore       # 恢复 .claude/settings.local.json
cc restore -g    # 恢复 ~/.claude/settings.json
```

### Q: 如何从现有 settings JSON 导入配置？
```bash
cc parse /path/to/settings.json myprofile    # 导入到本地
cc parse /path/to/settings.json myprofile -g  # 导入到全局
cc parse /path/to/settings.json myprofile -c  # 复制 YAML 到剪贴板，不写入配置文件
```

### Q: 命令冲突（`cc` 被其他程序占用）
修改别名：
```bash
cc alias ccl    # 改用 ccl 命令
```

---

## 卸载

```bash
npm uninstall -g @zphhpzzph/cc-cli

# 删除配置文件（可选）
rm ~/.claude/models.yaml
```
