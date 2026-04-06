const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const { default: inquirer } = require('inquirer');
const Separator = inquirer.Separator;

const GLOBAL_REGISTRY_DIR = path.join(os.homedir(), '.claude');
const GLOBAL_REGISTRY_PATH = path.join(GLOBAL_REGISTRY_DIR, 'env-registry.yaml');
const LOCAL_REGISTRY_PATH = path.join('.claude', 'env-registry.yaml');

// Built-in env vars shipped with cc-cli
const BUILTIN_ENV_VARS = [
  // ── Provider ──
  { key: 'CLAUDE_CODE_USE_BEDROCK', category: 'Provider', desc: '使用 AWS Bedrock', type: 'flag' },
  { key: 'CLAUDE_CODE_USE_VERTEX', category: 'Provider', desc: '使用 Google Vertex AI', type: 'flag' },
  { key: 'CLAUDE_CODE_USE_FOUNDRY', category: 'Provider', desc: '使用 Microsoft Foundry', type: 'flag' },
  { key: 'ANTHROPIC_BEDROCK_BASE_URL', category: 'Provider', desc: 'Bedrock 端点 URL 覆盖', type: 'text' },
  { key: 'ANTHROPIC_VERTEX_BASE_URL', category: 'Provider', desc: 'Vertex AI 端点 URL 覆盖', type: 'text' },
  { key: 'ANTHROPIC_VERTEX_PROJECT_ID', category: 'Provider', desc: 'Vertex AI 的 GCP 项目 ID', type: 'text' },
  { key: 'ANTHROPIC_FOUNDRY_API_KEY', category: 'Provider', desc: 'Microsoft Foundry API 密钥', type: 'text' },
  { key: 'ANTHROPIC_FOUNDRY_BASE_URL', category: 'Provider', desc: 'Foundry 资源的完整 Base URL', type: 'text' },
  { key: 'ANTHROPIC_FOUNDRY_RESOURCE', category: 'Provider', desc: 'Foundry 资源名称', type: 'text' },
  { key: 'ANTHROPIC_BEARER_TOKEN_BEDROCK', category: 'Provider', desc: 'Bedrock Bearer Token', type: 'text' },
  { key: 'AWS_BEARER_TOKEN_BEDROCK', category: 'Provider', desc: 'Bedrock API 密钥', type: 'text' },
  { key: 'ANTHROPIC_CUSTOM_HEADERS', category: 'Provider', desc: '自定义请求头 (Name: Value 格式)', type: 'text' },
  { key: 'ANTHROPIC_BETAS', category: 'Provider', desc: '额外 anthropic-beta 头 (逗号分隔)', type: 'text' },
  { key: 'CLAUDE_CODE_SKIP_BEDROCK_AUTH', category: 'Provider', desc: '跳过 Bedrock AWS 认证', type: 'flag' },
  { key: 'CLAUDE_CODE_SKIP_VERTEX_AUTH', category: 'Provider', desc: '跳过 Vertex Google 认证', type: 'flag' },
  { key: 'CLAUDE_CODE_SKIP_FOUNDRY_AUTH', category: 'Provider', desc: '跳过 Foundry Azure 认证', type: 'flag' },
  { key: 'CLAUDE_CODE_CLIENT_CERT', category: 'Provider', desc: 'mTLS 客户端证书路径', type: 'text' },
  { key: 'CLAUDE_CODE_CLIENT_KEY', category: 'Provider', desc: 'mTLS 客户端私钥路径', type: 'text' },
  { key: 'CLAUDE_CODE_CLIENT_KEY_PASSPHRASE', category: 'Provider', desc: '客户端私钥密码 (可选)', type: 'text' },
  { key: 'CLAUDE_CONFIG_DIR', category: 'Provider', desc: '覆盖配置目录 (默认 ~/.claude)', type: 'text' },

  // ── Auth ──
  { key: 'CLAUDE_CODE_OAUTH_TOKEN', category: 'Auth', desc: 'OAuth 访问令牌', type: 'text' },
  { key: 'CLAUDE_CODE_OAUTH_REFRESH_TOKEN', category: 'Auth', desc: 'OAuth 刷新令牌', type: 'text' },
  { key: 'CLAUDE_CODE_OAUTH_SCOPES', category: 'Auth', desc: 'OAuth 作用域 (空格分隔)', type: 'text' },

  // ── Model ──
  { key: 'CLAUDE_CODE_EFFORT_LEVEL', category: 'Model', desc: '推理努力等级', type: 'choice', choices: ['low', 'medium', 'high', 'max', 'auto'] },
  { key: 'MAX_THINKING_TOKENS', category: 'Model', desc: 'Thinking token 预算 (0 禁用)', type: 'number' },
  { key: 'CLAUDE_CODE_DISABLE_THINKING', category: 'Model', desc: '禁用扩展思考', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING', category: 'Model', desc: '禁用自适应推理', type: 'flag' },
  { key: 'CLAUDE_CODE_SUBAGENT_MODEL', category: 'Model', desc: '子代理使用的模型', type: 'text' },
  { key: 'ANTHROPIC_CUSTOM_MODEL_OPTION', category: 'Model', desc: '自定义模型选择器中的模型 ID', type: 'text' },
  { key: 'ANTHROPIC_CUSTOM_MODEL_OPTION_NAME', category: 'Model', desc: '自定义模型显示名称', type: 'text' },
  { key: 'ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION', category: 'Model', desc: '自定义模型显示描述', type: 'text' },
  { key: 'ANTHROPIC_DEFAULT_SONNET_MODEL', category: 'Model', desc: '默认 Sonnet 模型 ID', type: 'text' },
  { key: 'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME', category: 'Model', desc: 'Sonnet 模型显示名称', type: 'text' },
  { key: 'ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION', category: 'Model', desc: 'Sonnet 模型显示描述', type: 'text' },
  { key: 'ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES', category: 'Model', desc: 'Sonnet 支持的能力', type: 'text' },
  { key: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', category: 'Model', desc: '默认 Haiku 模型 ID', type: 'text' },
  { key: 'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME', category: 'Model', desc: 'Haiku 模型显示名称', type: 'text' },
  { key: 'ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION', category: 'Model', desc: 'Haiku 模型显示描述', type: 'text' },
  { key: 'ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES', category: 'Model', desc: 'Haiku 支持的能力', type: 'text' },
  { key: 'ANTHROPIC_DEFAULT_OPUS_MODEL', category: 'Model', desc: '默认 Opus 模型 ID', type: 'text' },
  { key: 'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME', category: 'Model', desc: 'Opus 模型显示名称', type: 'text' },
  { key: 'ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION', category: 'Model', desc: 'Opus 模型显示描述', type: 'text' },
  { key: 'ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES', category: 'Model', desc: 'Opus 支持的能力', type: 'text' },
  { key: 'ANTHROPIC_SMALL_FAST_MODEL', category: 'Model', desc: '[已弃用] 后台任务的 Haiku 级模型', type: 'text' },
  { key: 'ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION', category: 'Model', desc: 'Haiku 模型的 Bedrock AWS 区域', type: 'text' },
  { key: 'CLAUDE_CODE_DISABLE_LEGACY_MODEL_REMAP', category: 'Model', desc: '禁用旧版 Opus 模型自动重映射', type: 'flag' },
  { key: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS', category: 'Model', desc: '最大输出 token 数', type: 'number' },
  { key: 'CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS', category: 'Model', desc: '文件读取最大 token 数', type: 'number' },
  { key: 'DISABLE_INTERLEAVED_THINKING', category: 'Model', desc: '禁用交错思考 beta 头', type: 'flag' },
  { key: 'DISABLE_PROMPT_CACHING', category: 'Model', desc: '禁用所有模型的 prompt 缓存', type: 'flag' },
  { key: 'DISABLE_PROMPT_CACHING_HAIKU', category: 'Model', desc: '禁用 Haiku 的 prompt 缓存', type: 'flag' },
  { key: 'DISABLE_PROMPT_CACHING_OPUS', category: 'Model', desc: '禁用 Opus 的 prompt 缓存', type: 'flag' },
  { key: 'DISABLE_PROMPT_CACHING_SONNET', category: 'Model', desc: '禁用 Sonnet 的 prompt 缓存', type: 'flag' },
  { key: 'ENABLE_PROMPT_CACHING_1H_BEDROCK', category: 'Model', desc: 'Bedrock 使用 1 小时 prompt 缓存 TTL', type: 'flag' },
  { key: 'MAX_STRUCTURED_OUTPUT_RETRIES', category: 'Model', desc: '结构化输出验证重试次数 (默认 5)', type: 'number' },
  { key: 'FALLBACK_FOR_ALL_PRIMARY_MODELS', category: 'Model', desc: '所有主模型过载时启用 fallback', type: 'flag' },

  // ── Network ──
  { key: 'HTTP_PROXY', category: 'Network', desc: 'HTTP 代理地址', type: 'text' },
  { key: 'HTTPS_PROXY', category: 'Network', desc: 'HTTPS 代理地址', type: 'text' },
  { key: 'NO_PROXY', category: 'Network', desc: '绕过代理的域名', type: 'text' },
  { key: 'API_TIMEOUT_MS', category: 'Network', desc: 'API 请求超时 (ms, 默认 600000)', type: 'number' },
  { key: 'CLAUDE_CODE_MAX_RETRIES', category: 'Network', desc: '失败请求重试次数 (默认 10)', type: 'number' },
  { key: 'CLAUDE_CODE_PROXY_RESOLVES_HOSTS', category: 'Network', desc: '让代理执行 DNS 解析', type: 'flag' },
  { key: 'CLAUDE_ENABLE_STREAM_WATCHDOG', category: 'Network', desc: '启用流式响应超时看门狗', type: 'flag' },
  { key: 'CLAUDE_STREAM_IDLE_TIMEOUT_MS', category: 'Network', desc: '流式空闲超时 (ms, 默认 90000)', type: 'number' },

  // ── MCP ──
  { key: 'MCP_TIMEOUT', category: 'MCP', desc: 'MCP 服务器启动超时 (ms)', type: 'number' },
  { key: 'MCP_TOOL_TIMEOUT', category: 'MCP', desc: 'MCP 工具执行超时 (ms)', type: 'number' },
  { key: 'MAX_MCP_OUTPUT_TOKENS', category: 'MCP', desc: 'MCP 响应最大 token 数 (默认 25000)', type: 'number' },
  { key: 'ENABLE_CLAUDEAI_MCP_SERVERS', category: 'MCP', desc: '启用 claude.ai MCP 服务器', type: 'flag' },
  { key: 'ENABLE_TOOL_SEARCH', category: 'MCP', desc: 'MCP 工具搜索模式', type: 'choice', choices: ['true', 'auto', 'false'] },
  { key: 'MCP_CLIENT_SECRET', category: 'MCP', desc: 'MCP OAuth 客户端密钥', type: 'text' },
  { key: 'MCP_CONNECTION_NONBLOCKING', category: 'MCP', desc: '跳过 MCP 连接等待', type: 'flag' },
  { key: 'MCP_OAUTH_CALLBACK_PORT', category: 'MCP', desc: 'OAuth 回调固定端口', type: 'number' },
  { key: 'MCP_REMOTE_SERVER_CONNECTION_BATCH_SIZE', category: 'MCP', desc: '远程 MCP 并行连接数 (默认 20)', type: 'number' },
  { key: 'MCP_SERVER_CONNECTION_BATCH_SIZE', category: 'MCP', desc: '本地 MCP 并行连接数 (默认 3)', type: 'number' },

  // ── Privacy ──
  { key: 'DISABLE_TELEMETRY', category: 'Privacy', desc: '禁用遥测', type: 'flag' },
  { key: 'DISABLE_ERROR_REPORTING', category: 'Privacy', desc: '禁用错误报告', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', category: 'Privacy', desc: '禁用所有非必要网络流量', type: 'flag' },
  { key: 'DISABLE_COST_WARNINGS', category: 'Privacy', desc: '禁用费用警告', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY', category: 'Privacy', desc: '禁用会话质量调查', type: 'flag' },
  { key: 'IS_DEMO', category: 'Privacy', desc: '演示模式: 隐藏邮箱和组织名', type: 'flag' },

  // ── Context ──
  { key: 'DISABLE_AUTO_COMPACT', category: 'Context', desc: '禁用自动压缩', type: 'flag' },
  { key: 'CLAUDE_AUTOCOMPACT_PCT_OVERRIDE', category: 'Context', desc: '自动压缩触发百分比 (1-100)', type: 'number' },
  { key: 'CLAUDE_CODE_DISABLE_1M_CONTEXT', category: 'Context', desc: '禁用 1M 上下文窗口', type: 'flag' },
  { key: 'DISABLE_COMPACT', category: 'Context', desc: '禁用所有压缩 (含手动)', type: 'flag' },
  { key: 'CLAUDE_CODE_AUTO_COMPACT_WINDOW', category: 'Context', desc: '自动压缩的上下文容量 (token)', type: 'number' },

  // ── Shell ──
  { key: 'BASH_DEFAULT_TIMEOUT_MS', category: 'Shell', desc: '默认 Bash 命令超时 (ms)', type: 'number' },
  { key: 'BASH_MAX_TIMEOUT_MS', category: 'Shell', desc: '最大 Bash 命令超时 (ms)', type: 'number' },
  { key: 'CLAUDE_CODE_SHELL', category: 'Shell', desc: '覆盖 shell (如 bash, zsh)', type: 'text' },
  { key: 'CLAUDE_CODE_SHELL_PREFIX', category: 'Shell', desc: 'Bash 命令前缀包装器', type: 'text' },
  { key: 'BASH_MAX_OUTPUT_LENGTH', category: 'Shell', desc: 'Bash 输出最大字符数', type: 'number' },
  { key: 'CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR', category: 'Shell', desc: '每次命令后回到原工作目录', type: 'flag' },
  { key: 'TASK_MAX_OUTPUT_LENGTH', category: 'Shell', desc: '子代理输出最大字符数 (默认 32000)', type: 'number' },

  // ── Feature ──
  { key: 'CLAUDE_CODE_DISABLE_FAST_MODE', category: 'Feature', desc: '禁用快速模式', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_AUTO_MEMORY', category: 'Feature', desc: '禁用自动记忆', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_BACKGROUND_TASKS', category: 'Feature', desc: '禁用后台任务', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_CRON', category: 'Feature', desc: '禁用定时任务', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_ATTACHMENTS', category: 'Feature', desc: '禁用附件处理', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_CLAUDE_MDS', category: 'Feature', desc: '禁止加载 CLAUDE.md 文件', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING', category: 'Feature', desc: '禁用文件检查点', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS', category: 'Feature', desc: '移除内置 Git 指令', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_MOUSE', category: 'Feature', desc: '禁用鼠标追踪', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_TERMINAL_TITLE', category: 'Feature', desc: '禁用终端标题自动更新', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS', category: 'Feature', desc: '移除实验性 beta 头', type: 'flag' },
  { key: 'CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK', category: 'Feature', desc: '禁用非流式回退', type: 'flag' },
  { key: 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', category: 'Feature', desc: '启用实验性代理团队', type: 'flag' },
  { key: 'CLAUDE_AUTO_BACKGROUND_TASKS', category: 'Feature', desc: '强制启用长任务自动后台化', type: 'flag' },
  { key: 'CLAUDE_CODE_ENABLE_TASKS', category: 'Feature', desc: '非交互模式下启用任务跟踪', type: 'flag' },
  { key: 'CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION', category: 'Feature', desc: '启用提示建议', type: 'flag' },
  { key: 'CLAUDE_CODE_ENABLE_TELEMETRY', category: 'Feature', desc: '启用 OpenTelemetry 数据采集', type: 'flag' },
  { key: 'CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING', category: 'Feature', desc: '启用细粒度工具输入流', type: 'flag' },
  { key: 'CLAUDE_CODE_SUBPROCESS_ENV_SCRUB', category: 'Feature', desc: '清除子进程中的凭证', type: 'flag' },
  { key: 'CLAUDE_CODE_EXIT_AFTER_STOP_DELAY', category: 'Feature', desc: '空闲后自动退出的延迟 (ms)', type: 'number' },
  { key: 'CLAUDE_CODE_RESUME_INTERRUPTED_TURN', category: 'Feature', desc: '自动恢复中断的对话轮次', type: 'flag' },
  { key: 'CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS', category: 'Feature', desc: '网络错误时仍允许快速模式', type: 'flag' },
  { key: 'CLAUDE_CODE_USE_POWERSHELL_TOOL', category: 'Feature', desc: '启用 PowerShell 工具 (Windows)', type: 'flag' },
  { key: 'DISABLE_AUTOUPDATER', category: 'Feature', desc: '禁用自动更新', type: 'flag' },
  { key: 'DISABLE_DOCTOR_COMMAND', category: 'Feature', desc: '隐藏 /doctor 命令', type: 'flag' },
  { key: 'DISABLE_EXTRA_USAGE_COMMAND', category: 'Feature', desc: '隐藏 /extra-usage 命令', type: 'flag' },
  { key: 'DISABLE_FEEDBACK_COMMAND', category: 'Feature', desc: '禁用 /feedback 命令', type: 'flag' },
  { key: 'DISABLE_INSTALLATION_CHECKS', category: 'Feature', desc: '禁用安装检查警告', type: 'flag' },
  { key: 'DISABLE_INSTALL_GITHUB_APP_COMMAND', category: 'Feature', desc: '隐藏 /install-github-app 命令', type: 'flag' },
  { key: 'DISABLE_LOGIN_COMMAND', category: 'Feature', desc: '隐藏 /login 命令', type: 'flag' },
  { key: 'DISABLE_LOGOUT_COMMAND', category: 'Feature', desc: '隐藏 /logout 命令', type: 'flag' },
  { key: 'DISABLE_UPGRADE_COMMAND', category: 'Feature', desc: '隐藏 /upgrade 命令', type: 'flag' },
  { key: 'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD', category: 'Feature', desc: '从 --add-dir 加载 CLAUDE.md', type: 'flag' },
  { key: 'CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS', category: 'Feature', desc: 'SessionEnd 钩子最大超时 (ms, 默认 1500)', type: 'number' },
  { key: 'CLAUDE_CODE_TASK_LIST_ID', category: 'Feature', desc: '跨会话共享的任务列表 ID', type: 'text' },
  { key: 'CLAUDE_CODE_TEAM_NAME', category: 'Feature', desc: '代理团队名称', type: 'text' },
  { key: 'CLAUDE_ENV_FILE', category: 'Feature', desc: '每次 Bash 前加载的环境脚本路径', type: 'text' },
  { key: 'USE_BUILTIN_RIPGREP', category: 'Feature', desc: '设为 0 使用系统 rg', type: 'flag' },

  // ── Plugin ──
  { key: 'CLAUDE_CODE_PLUGIN_CACHE_DIR', category: 'Plugin', desc: '插件根目录覆盖', type: 'text' },
  { key: 'CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS', category: 'Plugin', desc: '插件 Git 操作超时 (ms, 默认 120000)', type: 'number' },
  { key: 'CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE', category: 'Plugin', desc: 'Git 失败时保留 marketplace 缓存', type: 'flag' },
  { key: 'CLAUDE_CODE_PLUGIN_SEED_DIR', category: 'Plugin', desc: '预填充插件种子目录路径', type: 'text' },
  { key: 'CLAUDE_CODE_SYNC_PLUGIN_INSTALL', category: 'Plugin', desc: '等待插件安装完成', type: 'flag' },
  { key: 'CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS', category: 'Plugin', desc: '同步插件安装超时 (ms)', type: 'number' },
  { key: 'CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL', category: 'Plugin', desc: '跳过官方 marketplace 自动安装', type: 'flag' },
  { key: 'FORCE_AUTOUPDATE_PLUGINS', category: 'Plugin', desc: '强制插件自动更新', type: 'flag' },

  // ── OTelemetry ──
  { key: 'OTEL_LOG_TOOL_CONTENT', category: 'OTelemetry', desc: '在 OTel 中记录工具输入输出', type: 'flag' },
  { key: 'OTEL_LOG_TOOL_DETAILS', category: 'OTelemetry', desc: '在 OTel 中记录 MCP 和工具细节', type: 'flag' },
  { key: 'OTEL_LOG_USER_PROMPTS', category: 'OTelemetry', desc: '在 OTel 中记录用户提示', type: 'flag' },
  { key: 'OTEL_METRICS_INCLUDE_ACCOUNT_UUID', category: 'OTelemetry', desc: '指标中包含账户 UUID', type: 'flag' },
  { key: 'OTEL_METRICS_INCLUDE_SESSION_ID', category: 'OTelemetry', desc: '指标中包含会话 ID', type: 'flag' },
  { key: 'OTEL_METRICS_INCLUDE_VERSION', category: 'OTelemetry', desc: '指标中包含版本号', type: 'flag' },
  { key: 'CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS', category: 'OTelemetry', desc: 'OTel 刷新超时 (ms, 默认 5000)', type: 'number' },
  { key: 'CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS', category: 'OTelemetry', desc: 'OTel 动态头刷新间隔 (ms, 默认 1740000)', type: 'number' },
  { key: 'CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS', category: 'OTelemetry', desc: 'OTel 关闭超时 (ms, 默认 2000)', type: 'number' },

  // ── Vertex ──
  { key: 'VERTEX_REGION_CLAUDE_3_5_HAIKU', category: 'Vertex', desc: 'Claude 3.5 Haiku Vertex 区域覆盖', type: 'text' },
  { key: 'VERTEX_REGION_CLAUDE_3_5_SONNET', category: 'Vertex', desc: 'Claude 3.5 Sonnet Vertex 区域覆盖', type: 'text' },
  { key: 'VERTEX_REGION_CLAUDE_3_7_SONNET', category: 'Vertex', desc: 'Claude 3.7 Sonnet Vertex 区域覆盖', type: 'text' },
  { key: 'VERTEX_REGION_CLAUDE_4_0_OPUS', category: 'Vertex', desc: 'Claude 4.0 Opus Vertex 区域覆盖', type: 'text' },
  { key: 'VERTEX_REGION_CLAUDE_4_0_SONNET', category: 'Vertex', desc: 'Claude 4.0 Sonnet Vertex 区域覆盖', type: 'text' },
  { key: 'VERTEX_REGION_CLAUDE_4_1_OPUS', category: 'Vertex', desc: 'Claude 4.1 Opus Vertex 区域覆盖', type: 'text' },
  { key: 'VERTEX_REGION_CLAUDE_4_5_SONNET', category: 'Vertex', desc: 'Claude Sonnet 4.5 Vertex 区域覆盖', type: 'text' },
  { key: 'VERTEX_REGION_CLAUDE_4_6_SONNET', category: 'Vertex', desc: 'Claude Sonnet 4.6 Vertex 区域覆盖', type: 'text' },
  { key: 'VERTEX_REGION_CLAUDE_HAIKU_4_5', category: 'Vertex', desc: 'Claude Haiku 4.5 Vertex 区域覆盖', type: 'text' },

  // ── Display ──
  { key: 'CLAUDE_CODE_ACCESSIBILITY', category: 'Display', desc: '保持原生终端光标可见', type: 'flag' },
  { key: 'CLAUDE_CODE_SYNTAX_HIGHLIGHT', category: 'Display', desc: '设为 false 禁用语法高亮', type: 'flag' },
  { key: 'CLAUDE_CODE_NO_FLICKER', category: 'Display', desc: '启用全屏渲染减少闪烁', type: 'flag' },
  { key: 'CLAUDE_CODE_SCROLL_SPEED', category: 'Display', desc: '鼠标滚轮滚动倍率 (1-20)', type: 'number' },
  { key: 'CLAUDE_CODE_GLOB_HIDDEN', category: 'Display', desc: '设为 false 排除 dotfile', type: 'flag' },
  { key: 'CLAUDE_CODE_GLOB_NO_IGNORE', category: 'Display', desc: '设为 false 让 Glob 遵循 .gitignore', type: 'flag' },
  { key: 'CLAUDE_CODE_GLOB_TIMEOUT_SECONDS', category: 'Display', desc: 'Glob 文件发现超时 (秒, 默认 20)', type: 'number' },
  { key: 'CLAUDE_CODE_SIMPLE', category: 'Display', desc: '精简模式: 最小系统提示', type: 'flag' },
  { key: 'CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY', category: 'Display', desc: '并行工具执行上限 (默认 10)', type: 'number' },
  { key: 'CLAUDE_CODE_NEW_INIT', category: 'Display', desc: '/init 使用交互式设置流程', type: 'flag' },
  { key: 'CLAUDE_CODE_IDE_HOST_OVERRIDE', category: 'Display', desc: '覆盖 IDE 连接地址', type: 'text' },
  { key: 'CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL', category: 'Display', desc: '跳过 IDE 扩展自动安装', type: 'flag' },
  { key: 'CLAUDE_CODE_IDE_SKIP_VALID_CHECK', category: 'Display', desc: '跳过 IDE 锁文件验证', type: 'flag' },
  { key: 'CLAUDE_CODE_AUTO_CONNECT_IDE', category: 'Display', desc: '覆盖 IDE 自动连接行为', type: 'text' },
  { key: 'CLAUDE_CODE_TMPDIR', category: 'Display', desc: '临时文件目录覆盖', type: 'text' },
  { key: 'CLAUDE_CODE_DEBUG_LOGS_DIR', category: 'Display', desc: '调试日志文件路径', type: 'text' },
  { key: 'CLAUDE_CODE_DEBUG_LOG_LEVEL', category: 'Display', desc: '调试日志级别', type: 'choice', choices: ['verbose', 'debug', 'info', 'warn', 'error'] },
  { key: 'CLAUDE_CODE_GIT_BASH_PATH', category: 'Display', desc: 'Windows: Git Bash 路径', type: 'text' },
  { key: 'SLASH_COMMAND_TOOL_CHAR_BUDGET', category: 'Display', desc: 'Skill 元数据字符预算', type: 'number' },
  { key: 'CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS', category: 'Display', desc: '禁用内置子代理类型', type: 'flag' },
  { key: 'CLAUDE_AGENT_SDK_MCP_NO_PREFIX', category: 'Display', desc: '跳过 MCP 工具名前缀', type: 'flag' },
  { key: 'CLAUDE_CODE_API_KEY_HELPER_TTL_MS', category: 'Display', desc: '凭证刷新间隔 (ms)', type: 'number' },
];

function getLocalRegistryPath() {
  return path.resolve(process.cwd(), LOCAL_REGISTRY_PATH);
}

function getGlobalRegistryPath() {
  return GLOBAL_REGISTRY_PATH;
}

function mergeEntries(base, overrides) {
  const result = base.map(e => ({ ...e }));
  for (const entry of overrides) {
    const idx = result.findIndex(e => e.key === entry.key);
    if (idx >= 0) {
      result[idx] = { ...result[idx], ...entry };
    } else {
      result.push({ ...entry });
    }
  }
  return result;
}

function loadYaml(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function loadEnvRegistry() {
  let result = BUILTIN_ENV_VARS.map(e => ({ ...e }));

  const globalData = loadYaml(GLOBAL_REGISTRY_PATH);
  if (globalData?.entries) {
    result = mergeEntries(result, globalData.entries);
  }

  const localPath = getLocalRegistryPath();
  const localData = loadYaml(localPath);
  if (localData?.entries) {
    result = mergeEntries(result, localData.entries);
  }

  return result;
}

function saveEnvRegistry(entries, scope) {
  const filePath = scope === 'local' ? getLocalRegistryPath() : GLOBAL_REGISTRY_PATH;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Only save user-defined entries (not built-in, unless modified)
  const userEntries = [];
  for (const entry of entries) {
    const builtin = BUILTIN_ENV_VARS.find(b => b.key === entry.key);
    if (!builtin) {
      userEntries.push({ ...entry });
    }
  }

  const content = yaml.dump({ entries: userEntries }, { indent: 2 });
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function appendToRegistry(entry, scope) {
  const filePath = scope === 'local' ? getLocalRegistryPath() : GLOBAL_REGISTRY_PATH;
  const existing = loadYaml(filePath);
  const entries = existing?.entries || [];

  // Don't duplicate
  if (entries.find(e => e.key === entry.key)) return filePath;

  entries.push(entry);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const content = yaml.dump({ entries }, { indent: 2 });
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function buildEnvChoices(entries, existing) {
  const choices = [];
  const categories = [...new Set(entries.map(v => v.category))];
  for (const cat of categories) {
    choices.push(new Separator(`── ${cat} ──`));
    for (const v of entries) {
      if (v.category !== cat) continue;
      if (existing && existing[v.key]) continue;
      const hint = v.type === 'flag' ? '(flag)' : v.type === 'choice' ? `(${v.choices.join('/')})` : `(${v.type})`;
      choices.push({ name: `${v.key} - ${v.desc} ${hint}`, value: v.key });
    }
  }
  choices.push(new Separator('── Other ──'));
  choices.push({ name: 'Custom - Enter key manually', value: '__custom__' });
  choices.push({ name: '✓ Done', value: '__done__' });
  return choices;
}

async function promptEnvValue(varDef, currentValue) {
  if (varDef.type === 'flag') {
    const answer = await inquirer.prompt([
      { type: 'confirm', name: 'enable', message: `Enable ${varDef.key}?`, default: currentValue ? true : false }
    ]);
    return answer.enable ? '1' : null;
  }
  if (varDef.type === 'choice') {
    const answer = await inquirer.prompt([
      { type: 'list', name: 'value', message: `${varDef.key}:`, choices: varDef.choices, default: currentValue }
    ]);
    return answer.value;
  }
  if (varDef.type === 'number') {
    const answer = await inquirer.prompt([
      { type: 'input', name: 'value', message: `${varDef.key}:`, default: currentValue || '', validate: (i) => i.trim() === '' || /^\d+$/.test(i.trim()) || 'Must be a number' }
    ]);
    return answer.value.trim();
  }
  // text
  const answer = await inquirer.prompt([
    { type: 'input', name: 'value', message: `${varDef.key}:`, default: currentValue || '' }
  ]);
  return answer.value.trim();
}

function buildAutocompleteSource(entries, existing) {
  return async function (answers, input) {

    input = (input || '').toLowerCase();

    // 过滤：按 key 和 desc 模糊匹配
    let filtered = entries.filter(v => {
      if (existing && existing[v.key]) return false; // 已设置的隐藏
      if (!input) return true;
      return v.key.toLowerCase().includes(input) || v.desc.toLowerCase().includes(input);
    });

    // 按分类分组
    const choices = [];
    const categories = [...new Set(filtered.map(v => v.category))];
    for (const cat of categories) {
      choices.push(new Separator(`── ${cat} ──`));
      for (const v of filtered) {
        if (v.category !== cat) continue;
        const hint = v.type === 'flag' ? '(flag)' : v.type === 'choice' ? `(${v.choices.join('/')})` : `(${v.type})`;
        choices.push({ name: `${v.key} - ${v.desc} ${hint}`, value: v.key });
      }
    }

    // 末尾选项始终存在
    choices.push(new Separator('── Other ──'));
    choices.push({ name: 'Custom - 手动输入变量名', value: '__custom__' });
    choices.push({ name: '✓ 完成', value: '__done__' });

    return choices;
  };
}

function buildPagedEnvSource(entries, existing) {
  const categories = [...new Set(entries.map(v => v.category))];
  let currentIndex = 0;

  const controller = {
    switchCategory(dir) {
      if (dir === 'next') {
        currentIndex = (currentIndex + 1) % categories.length;
      } else {
        currentIndex = (currentIndex - 1 + categories.length) % categories.length;
      }
    },
    get currentCategory() {
      return categories[currentIndex];
    },
    categories
  };

  const source = async function (answers, input) {
    input = (input || '').toLowerCase();

    const choices = [];

    // 顶部常驻项
    choices.push({ name: 'Custom - 手动输入变量名', value: '__custom__' });
    choices.push({ name: '✓ 完成', value: '__done__' });

    if (input) {
      // 搜索模式：跨所有分类过滤
      const filtered = entries.filter(v => {
        if (existing && existing[v.key]) return false;
        return v.key.toLowerCase().includes(input) || v.desc.toLowerCase().includes(input);
      });

      if (filtered.length > 0) {
        const filteredCats = [...new Set(filtered.map(v => v.category))];
        for (const cat of filteredCats) {
          choices.push(new Separator(`── ${cat} ──`));
          for (const v of filtered) {
            if (v.category !== cat) continue;
            const hint = v.type === 'flag' ? '(flag)' : v.type === 'choice' ? `(${v.choices.join('/')})` : `(${v.type})`;
            choices.push({ name: `${v.key} - ${v.desc} ${hint}`, value: v.key });
          }
        }
      }
    } else {
      // 分类模式：只显示当前分类
      const cat = categories[currentIndex];
      const catEntries = entries.filter(v => {
        if (v.category !== cat) return false;
        if (existing && existing[v.key]) return false;
        return true;
      });

      if (catEntries.length > 0) {
        choices.push(new Separator(`── ${cat} (${currentIndex + 1}/${categories.length}) ──`));
        for (const v of catEntries) {
          const hint = v.type === 'flag' ? '(flag)' : v.type === 'choice' ? `(${v.choices.join('/')})` : `(${v.type})`;
          choices.push({ name: `${v.key} - ${v.desc} ${hint}`, value: v.key });
        }
      }
    }

    return choices;
  };

  return { source, controller };
}

module.exports = {
  BUILTIN_ENV_VARS,
  loadEnvRegistry,
  saveEnvRegistry,
  appendToRegistry,
  buildEnvChoices,
  buildAutocompleteSource,
  buildPagedEnvSource,
  promptEnvValue,
  getLocalRegistryPath,
  getGlobalRegistryPath
};
