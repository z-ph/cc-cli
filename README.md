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

### 1. 添加配置

```bash
cc add glm5.1
```

按提示输入：
- `Model`: 模型名称（如 `glm-5.1`，可留空使用 Claude Code 默认值）
- 是否添加环境变量（`ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN` 等）

### 2. 启动 Claude Code

```bash
cc glm5.1
```

这会将配置合并写入 `.claude/settings.local.json`，然后启动 Claude Code。

### 3. 切换配置（不启动）

```bash
cc use glm5.1      # 写入 ./.claude/settings.local.json
cc use glm5.1 -g   # 写入 ~/.claude/settings.json
```

---

## 配置文件查找规则

CC CLI 按以下优先级查找配置文件：

1. **当前目录**（优先）：`./.claude/models.yaml`
2. **用户目录**（备选）：`~/.claude/models.yaml`

如果当前目录有配置文件，优先使用；否则使用全局配置。

### 指定自定义配置文件

使用 `-t/--target` 参数指定任意 YAML 文件：

```bash
cc glm5.1 -t ./project-a/models.yaml     # 使用指定文件启动
cc list -t /path/to/custom-config.yaml  # 查看指定文件中的配置
cc add glm5.1 -t ./team-config.yaml     # 添加配置到指定文件
```

---

## 命令参考

全局选项：
- `-t, --target <file>` - 指定自定义配置文件（所有命令都支持）

### `cc <config-id>`
启动指定配置的 Claude Code。

```bash
cc glm5.1      # 使用 glm5.1 配置
cc gpt4        # 使用 gpt4 配置
cc local       # 使用本地模型配置
```

### `cc use <config-id>`
将配置应用到 settings 文件，不启动 Claude Code。

```bash
cc use glm5.1         # 写入 ./.claude/settings.local.json
cc use glm5.1 -g      # 写入 ~/.claude/settings.json
```

### `cc list`
查看所有已配置的配置项。

```bash
cc list
```

输出示例：
```
Config file: /project/.claude/models.yaml

Available configurations:

  glm5.1
    model: glm-5.1
    env:   ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN

  gpt4
    model: gpt-4o

Total: 2 configuration(s)
```

### `cc add <config-id>`
交互式添加新配置。

```bash
cc add my-model
cc add my-model -g    # 添加到全局配置
```

配置 ID 规则：
- 只能包含字母、数字、点、下划线和连字符
- 不能重复

### `cc remove <config-id>`
删除配置。

```bash
cc remove glm5.1
cc remove glm5.1 -g   # 从全局配置删除
```

### `cc edit <config-id>`
交互式编辑现有配置。

```bash
cc edit glm5.1
```

可以修改：
- Model
- 环境变量（保留/编辑/清空）

### `cc alias [name]`
查看或修改命令别名。

```bash
cc alias         # 查看当前别名
cc alias cl      # 将命令改为 `cl`
```

---

## 配置文件

配置文件位置：`~/.claude/models.yaml`（全局）或 `./.claude/models.yaml`（项目级）

### 结构说明

配置直接使用 Claude Code 的官方 settings 字段，支持 `base` 定义共享默认值，`configs` 定义多个命名配置。

```yaml
settings:
  alias: cc                # CLI 命令别名（非 Claude Code 字段）

base:                      # 共享默认值，合并到每个 config
  model: claude-sonnet-4-6
  env:
    ANTHROPIC_BASE_URL: https://api.anthropic.com
  permissions:
    allow:
      - "Bash(npm run *)"
    deny:
      - "Read(./.env)"

configs:
  <config-id>:             # 配置标识名
    model: <name>          # 模型名称（Claude Code 的 model 字段）
    env:                   # 环境变量（Claude Code 的 env 字段）
      ANTHROPIC_BASE_URL: <url>
      ANTHROPIC_AUTH_TOKEN: <key>
    permissions:           # 权限设置（可选）
      allow: [...]
      deny: [...]
```

### 合并规则

启动或 `use` 时，`base` 和对应 config 会深度合并：
- **字符串/数字**：config 覆盖 base
- **对象**（env、permissions 等）：递归合并
- **数组**（permissions.allow、permissions.deny 等）：拼接并去重

### 示例配置

```yaml
settings:
  alias: cc

base:
  permissions:
    allow:
      - "Bash(npm run *)"
    deny:
      - "Read(./.env)"

configs:
  # 智谱 GLM-5.1
  glm5.1:
    model: glm-5.1
    env:
      ANTHROPIC_BASE_URL: https://open.bigmodel.cn/api/paas/v4
      ANTHROPIC_AUTH_TOKEN: sk-your-key-here

  # OpenAI GPT-4o
  gpt4o:
    model: gpt-4o
    env:
      ANTHROPIC_BASE_URL: https://api.openai.com/v1
      ANTHROPIC_AUTH_TOKEN: sk-your-key-here
    permissions:
      allow:
        - "Bash(*)"

  # 本地 Ollama
  local:
    model: llama3.1
    env:
      ANTHROPIC_BASE_URL: http://localhost:11434/v1
      ANTHROPIC_AUTH_TOKEN: ollama
```

---

## 常见问题

### Q: 提示 "Configuration 'xxx' not found"
配置不存在。先使用 `cc add xxx` 创建配置，或用 `cc list` 查看可用配置。

### Q: 提示 "Claude Code is not installed"
你需要先安装 Claude Code：
```bash
npm install -g @anthropic-ai/claude-code
```

### Q: 如何切换不同的模型？
使用不同的配置 ID 启动：
```bash
cc glm5.1    # 智谱
cc gpt4o     # OpenAI
cc local     # 本地模型
```

或使用 `use` 命令只切换配置不启动：
```bash
cc use glm5.1
```

### Q: `cc <config-id>` 和 `cc use <config-id>` 有什么区别？
- `cc <config-id>`：写入 settings 文件并启动 Claude Code
- `cc use <config-id>`：只写入 settings 文件，不启动

### Q: 环境变量如何使用？
在 `env` 字段中添加任意键值对，会写入 Claude Code 的 settings 文件：

```yaml
configs:
  myconfig:
    model: model-name
    env:
      ANTHROPIC_BASE_URL: https://api.example.com
      ANTHROPIC_AUTH_TOKEN: sk-xxx
      HTTP_PROXY: http://127.0.0.1:7890
      CLAUDE_CODE_DEBUG: "true"
```

### Q: 命令冲突（`cc` 被其他程序占用）
修改别名：
```bash
cc alias ccl    # 改用 ccl 命令
```

然后重新创建 npm 链接（如需）。

---

## 卸载

```bash
# 取消全局链接
npm unlink -g cc-cli

# 删除配置文件（可选）
rm ~/.claude/models.yaml
```

---

## 支持

如有问题或建议，请提交 issue 或联系开发者。
