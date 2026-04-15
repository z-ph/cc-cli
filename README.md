# CC CLI 使用手册

快速启动不同配置的 Claude Code 命令行工具。

---

## 安装

```bash
npm i -g @zphhpzzph/cc-cli@latest
```

> **项目地址：** [https://github.com/z-ph/cc-cli](https://github.com/z-ph/cc-cli) — 可下载源码查看或参与贡献

---

## 快速开始

### 1. 添加配置

```bash
zcc add glm51       # 默认保存到当前项目 ./claude/models.yaml
zcc add glm51 -g    # 推荐保存到全局 ~/.claude/models.yaml
```

> **注意：** `zcc add` 默认作用域为当前项目目录。推荐使用 `-g` 参数将配置添加到全局，这样在任意目录下都可以使用该配置。

按提示输入：
- `ANTHROPIC_BASE_URL`: API 地址
- `ANTHROPIC_AUTH_TOKEN`: API 密钥
- `ANTHROPIC_MODEL`: 模型名称（可留空）
- 权限配置（可留空）
- 其他环境变量（支持 autocomplete 搜索，覆盖 ~200 个 Claude Code 内置变量）

### 2. 启动 Claude Code

```bash
zcc glm51    # 生成 settings.glm51.json，以 --settings 方式启动
```

### 3. 应用配置到 settings 文件（不启动）

```bash
zcc use strict       # 写入 .claude/settings.local.json
zcc use strict -g    # 写入 ~/.claude/settings.json（全局）
```

---

## 命令列表

| 命令 | 说明 |
|------|------|
| `zcc <id>` | 启动 Claude Code，自动生成 settings 文件并通过 --settings 传入 |
| `zcc add <id>` | 添加配置方案（`-b` 编辑 base） |
| `zcc edit <id>` | 编辑配置方案（`-b` 编辑 base） |
| `zcc remove <id>` | 删除配置方案 |
| `zcc parse <settings-path> [profile-id]` | 从 settings JSON 文件导入为 profile（`-b` 写入 base，`-c` 仅复制到剪贴板） |
| `zcc list` | 列出所有配置方案 |
| `zcc use [profile-id]` | 将配置写入 settings 文件（不启动，`-b` 应用 base） |
| `zcc restore` | 恢复 settings 备份 |
| `zcc alias [name]` | 修改 CLI 命令别名 |
| `zcc serve [profile-id]` | 启动本地模型代理服务（`-b` 基于 base 启动，`--run` 启动代理后启动 Claude Code） |
| `zcc serve list` | 列出运行中的代理 |
| `zcc serve stop [profile-id]` | 停止指定代理（`--all` 停止所有） |
| `zcc serve log <profile-id>` | 查看代理请求日志（`-n` 指定行数，默认 20） |
| `zcc web` | 启动 Web 可视化配置界面（`-p` 指定端口） |
| `zcc knowledge status` | 检查知识库章节时效性 |
| `zcc knowledge update` | 增量更新过期的知识章节 |
| `zcc knowledge verify` | 验证知识库完整性 |
| `zcc knowledge rebuild` | 重建知识库（扫描项目目录结构） |

所有命令支持 `-g`（全局）和 `-t <file>`（自定义配置文件）选项。

---

## 配置文件

配置文件位置：`~/.claude/models.yaml`（全局）或 `./.claude/models.yaml`（项目级）

### 结构说明

```yaml
settings:
  alias: zcc              # CLI 命令别名

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

    # 以下字段由 zcc serve 自动管理，无需手动编辑
    proxy:               # 代理服务信息（自动生成）
      url: http://localhost:34567
      pid: 12345
      port: 34567
      token: a1b2c3d4
    modelOverride:       # 可选：模型名称映射表
      claude-sonnet-4-20250514: claude-opus-4-20250514
```

### Base 传导链

`base` 配置具有跨文件传导能力，合并顺序为 **全局 base → 本地 base → profile**：

- 当 profile 在本地 `./.claude/models.yaml` 中找到时，全局 `~/.claude/models.yaml` 的 `base` 也会被加载
- 同名字段的优先级：profile > 本地 base > 全局 base
- 当 profile 仅在全局配置中时，只应用全局 base

示例：全局 base 定义共享 token，本地 base 覆盖 URL，profile 指定模型——三层配置自动合并。

### 启动流程

`zcc <id>` 的工作方式：
1. 加载全局 base + 本地 base（传导链）
2. 从 `profiles[id]` 读取配置，仅使用 profile 自身内容生成 settings 文件（不合并 base，避免覆盖全局用户设置）
3. 生成 `settings.<id>.json` 到 models.yaml 所在的 `.claude/` 目录下
4. 使用 `claude --settings settings.<id>.json` 启动

> **为什么 launch 不合并 base？** Claude Code 本身会自动加载 `~/.claude/settings.json`。如果 `--settings` 传入的文件中已包含 base 内容，base 配置项会以最高优先级覆盖用户的全局 settings，导致全局配置失效。因此 `zcc <id>` 只传入 profile 自身配置，让 base 通过 Claude Code 自然加载的全局 settings 文件生效。

### Settings 合并与优先级

`zcc <id>` 通过 `--settings` 传入 profile 配置，但 Claude Code 仍会自动加载以下三个内置层级：

| 层级 | 文件路径 | 说明 |
|------|----------|------|
| 1（最高） | `--settings` 传入的文件 | `zcc <id>` 生成的 `settings.<id>.json`（仅 profile 内容） |
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

## Base 配置编辑

通过 `--base`（`-b`）参数可以直接编辑 base 节点，无需手动修改 YAML。

```bash
# 添加/更新 base 配置（本地）
zcc add base -b

# 添加/更新 base 配置（全局）
zcc add base -b -g

# 编辑 base 配置（交互式引导，预填现有值）
zcc edit base -b

# 将 base 配置应用到 settings 文件
zcc use -b
zcc use -b -g

# 从 JSON 文件导入到 base
zcc parse ./settings.json -b
```

---

## 本地模型代理（zcc serve）

`zcc serve` 为 profile 启动一个本地 HTTP 反向代理，用于模型路由和名称映射。

### 使用场景

- 将请求路由到第三方 API（如智谱、OpenAI、Ollama）
- 按需重映射模型名称（`claude-sonnet` → `claude-opus`）
- 无模型映射时，强制所有请求走指定模型

### 快速上手

```bash
# 启动代理（profile 需配置 env.ANTHROPIC_BASE_URL）
zcc serve my-profile

# 启动代理并直接启动 Claude Code
zcc serve my-profile --run

# 基于 base 配置启动代理
zcc serve --base

# 查看运行中的代理
zcc serve list

# 停止代理
zcc serve stop my-profile
zcc serve stop --all

# 查看代理请求日志
zcc serve log my-profile          # 最近 20 条
zcc serve log my-profile -n 50    # 最近 50 条
```

### 模型路由逻辑

按以下优先级决定如何处理请求中的 model 字段：

1. **profile 有 `modelOverride` 映射表** → 按映射替换（如 `claude-sonnet-4-20250514` → `claude-opus-4-20250514`）
2. **无 `modelOverride`，但 profile 有 `env.ANTHROPIC_MODEL`** → 强制所有请求使用该模型
3. **两者都没有** → 透传原始 model

### 配置示例

```yaml
profiles:
  my-proxy:
    modelOverride:
      claude-sonnet-4-20250514: claude-opus-4-20250514
    env:
      ANTHROPIC_BASE_URL: https://api.anthropic.com
      ANTHROPIC_AUTH_TOKEN: sk-xxx
      ANTHROPIC_MODEL: claude-sonnet-4-20250514
```

> **注意：** 代理启动后会在 profile 中自动写入 `proxy` 字段（url/pid/port/token），无需手动编辑。`zcc <id>` 检测到 `proxy` 字段且进程存活时，会自动通过代理地址启动。

---

## 知识库管理（zcc knowledge）

`zcc knowledge` 提供项目知识库管理功能，基于 git commit hash 追踪知识时效性，支持增量更新。

知识库结构：
```
.knowledge/
  index.json          # version 2, sections: { key: { commit, paths } }
  sections/
    bin.md
    config.md
    commands.md
    ...
```

### 快速上手

```bash
# 重建知识库（自动扫描项目目录结构）
zcc knowledge rebuild

# 使用 AI 分析生成知识章节（推荐）
zcc knowledge rebuild --profile <profile-id>

# 检查知识库时效性
zcc knowledge status

# 增量更新过期的章节
zcc knowledge update

# 使用 AI 分析更新章节内容
zcc knowledge update --profile <profile-id>

# 验证知识库完整性
zcc knowledge verify
```

### 自动发现规则

`zcc knowledge rebuild` 自动扫描项目目录结构：
- `src/` 的子目录各自成为独立 section
- 其他顶层目录各自成为一个 section
- 排除常见非源码目录（`node_modules`、`.vscode`、`tests`、`docs` 等）

### 更新检测

`zcc knowledge status` 基于 `git diff --numstat` 检测变更：
- ✅ up to date — 章节已最新
- ⚡ minor — 轻微变更，可选更新
- ⚠️ stale — 重大变更，建议更新

---

## Web 可视化配置（zcc web）

`zcc web` 提供基于浏览器的可视化配置管理界面，支持对所有配置的增删改查操作。

### 安装

```bash
npm i -g @zphhpzzph/cc-cli@latest
```

安装后即可使用，无需额外构建步骤。

### 快速上手

```bash
# 启动 Web 服务，自动打开浏览器
zcc web

# 指定端口启动
zcc web -p 8080
```

### 功能特性

| 功能 | 说明 |
|------|------|
| Profile 管理 | 列出、添加、编辑、删除 profiles |
| Base 配置编辑 | 编辑所有 profiles 共享的 base 配置 |
| 环境变量编辑 | 可视化编辑 ANTHROPIC_BASE_URL 等环境变量 |
| 权限配置 | 管理 allow/deny 规则列表 |
| 快速操作 | 一键启动 Claude Code、应用配置到 settings |
| 导入/导出 | 支持 JSON/YAML 格式的导入导出 |
| 查看原始 YAML | 查看配置文件的原始内容 |

### 界面布局

- **左侧导航**：切换本地/全局配置，访问各种操作
- **主内容区**：显示 profiles 列表，支持编辑、删除、启动等操作
- **浮动按钮**：快速添加新的 profile

### 技术说明

- 前端：React + Material UI
- 后端：Express 服务器
- 默认端口：自动查找空闲端口（从 3000 开始）
- 按 Ctrl+C 停止服务

---

## 常见问题

### Q: 提示 "Profile 'xxx' not found"
配置不存在。先使用 `zcc add xxx` 创建配置，或用 `zcc list` 查看可用配置。

### Q: `zcc <id>` 和 `zcc use <id>` 有什么区别？
- `zcc <id>`：生成临时 settings 文件并启动 Claude Code（不合并 base）
- `zcc use <id>`：将配置合并写入 `.claude/settings.local.json`（不启动，合并 base）

### Q: 如何恢复被覆盖的 settings 文件？
```bash
zcc restore       # 恢复 .claude/settings.local.json
zcc restore -g    # 恢复 ~/.claude/settings.json
```

### Q: 如何从现有 settings JSON 导入配置？
```bash
zcc parse /path/to/settings.json myprofile    # 导入到 profile
zcc parse /path/to/settings.json myprofile -g  # 导入到全局 profile
zcc parse /path/to/settings.json -b             # 导入到 base
zcc parse /path/to/settings.json myprofile -c  # 复制 YAML 到剪贴板，不写入配置文件
```

### Q: 命令冲突（`zcc` 被其他程序占用）
修改别名：
```bash
zcc alias ccl    # 改用 ccl 命令
```

### Q: 代理启动后如何使用？
代理启动后会自动写入 `proxy` 字段。直接 `zcc <id>` 即可，launch 命令会检测到代理并通过代理地址启动。代理停止后会自动降级为直连。

### Q: `zcc web` 启动后浏览器没有自动打开？
手动访问终端中显示的地址（如 `http://localhost:3001`）即可。

---

## 卸载

```bash
npm uninstall -g @zphhpzzph/cc-cli

# 删除配置文件（可选）
rm ~/.claude/models.yaml
```

> 喜欢的话可以给个star，欢迎大佬们提出宝贵建议和贡献代码~
> 欢迎在 GitHub 上提交 pull request，或在 issue 中讨论。
> github: https://github.com/z-ph/cc-cli