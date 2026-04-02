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
- `Base URL`: API 地址（如 `https://open.bigmodel.cn/api/paas/v4`）
- `API Key`: 你的 API 密钥
- `Model`: 模型名称（如 `glm-5.1`）
- 是否需要添加自定义环境变量（可选）

### 2. 启动 Claude Code

```bash
cc glm5.1
```

这会使用你配置的 `glm5.1` 设置启动 Claude Code。

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

这对于项目特定的配置很有用，可以在项目目录下创建 `.claude/models.yaml`，与代码一起提交到版本控制。

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

### `cc list`
查看所有已配置的配置项。

```bash
cc list
```

输出示例：
```
Available configurations:

  glm5.1
    base_url: https://open.bigmodel.cn/api/paas/v4
    model:   glm-5.1
    env:     ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN

  gpt4
    base_url: https://api.openai.com/v1
    model:   gpt-4o

Total: 2 configuration(s)
```

### `cc add <config-id>`
交互式添加新配置。

```bash
cc add my-model
```

配置 ID 规则：
- 只能包含字母、数字、点、下划线和连字符
- 不能重复

### `cc remove <config-id>`
删除配置。

```bash
cc remove glm5.1
```

### `cc edit <config-id>`
交互式编辑现有配置。

```bash
cc edit glm5.1
```

可以修改：
- Base URL
- API Key（按回车保持当前值）
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

配置文件位置：`~/.claude/models.yaml`

### 结构说明

```yaml
settings:
  alias: cc              # 命令别名

models:
  <config-id>:           # 配置标识名
    base_url: <url>       # API 基础地址 → ANTHROPIC_BASE_URL
    api_key: <key>        # API 密钥 → ANTHROPIC_AUTH_TOKEN
    model: <name>        # 模型名称 → ANTHROPIC_MODEL
    env:                 # 额外环境变量
      KEY: value
```

### 示例配置

```yaml
settings:
  alias: cc

models:
  # 智谱 GLM-5.1
  glm5.1:
    base_url: https://open.bigmodel.cn/api/paas/v4
    api_key: sk-your-key-here
    model: glm-5.1
    env:
      ANTHROPIC_BASE_URL: https://open.bigmodel.cn/api/paas/v4
      ANTHROPIC_AUTH_TOKEN: sk-your-key-here

  # OpenAI GPT-4o
  gpt4o:
    base_url: https://api.openai.com/v1
    api_key: sk-your-key-here
    model: gpt-4o
    env:
      OPENAI_BASE_URL: https://api.openai.com/v1
      ANTHROPIC_AUTH_TOKEN: sk-your-key-here

  # 本地 Ollama
  local:
    base_url: http://localhost:11434/v1
    api_key: ollama
    model: llama3.1
    env:
      OLLAMA_HOST: http://localhost:11434
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

### Q: 环境变量如何使用？
在 `env` 部分添加任意键值对，会全部透传给 Claude Code 进程：

```yaml
models:
  myconfig:
    base_url: https://api.example.com
    api_key: sk-xxx
    model: model-name
    env:
      # 自定义头
      CUSTOM_HEADER: value
      # 代理设置
      HTTP_PROXY: http://127.0.0.1:7890
      # Claude Code 调试
      CLAUDE_CODE_DEBUG: "true"
```

### Q: 命令冲突（`cc` 被其他程序占用）
修改别名：
```bash
cc alias ccl    # 改用 ccl 命令
```

然后重新创建 npm 链接（如需）。

---

## 配置文件示例

项目目录下的 `example.yaml` 提供了 4 个常用配置模板：

- `glm4` - 智谱 GLM
- `gpt4` - OpenAI GPT
- `local` - 本地 Ollama
- `proxy` - OneAPI 转发

复制需要的配置到 `~/.claude/models.yaml` 并填入你的 API key。

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
