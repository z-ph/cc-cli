# Web 端环境变量建议列表补全

## 背景

`src/web/components/ProfileEditor.jsx` 中的 `ENV_KEY_SUGGESTIONS` 数组用于为 Web UI 的环境变量输入框提供自动补全建议。该列表长期未维护，仅包含约 20 个变量，缺少大量 Claude Code 实际支持的配置项（如 `CLAUDE_CODE_USE_FOUNDRY`、`DISABLE_TELEMETRY`、`MCP_TIMEOUT` 等），导致用户在 Web 界面配置 profile 时无法获得完整的字段提示。

## 目标

将 `ENV_KEY_SUGGESTIONS` 补全为与 CLI 端 `src/config/env-registry.js` 中 `BUILTIN_ENV_VARS` 一致的完整列表，确保 Web 和 CLI 的环境变量提示能力对齐。

## 变更范围

- **文件**：`src/web/components/ProfileEditor.jsx`
- **内容**：替换 `ENV_KEY_SUGGESTIONS` 常量数组

## 新增字段分类

按 `env-registry.js` 的分类体系，补充以下类别变量：

1. **Provider** — Bedrock/Vertex/Foundry 切换、端点覆盖、认证跳过、mTLS 证书等
2. **Auth** — OAuth 令牌/刷新令牌/作用域
3. **Model** — 推理努力等级、思考 token 预算、子代理模型、自定义模型选项、默认模型映射、prompt 缓存开关等
4. **Network** — 代理、超时、重试、流式看门狗
5. **MCP** — MCP 超时、工具 token 限制、OAuth 回调端口、连接并发数等
6. **Privacy** — 遥测、错误报告、费用警告、调查开关
7. **Context** — 自动压缩、1M 上下文窗口
8. **Shell** — Bash 超时、shell 覆盖、输出长度限制
9. **Feature** — 快速模式、自动记忆、后台任务、附件、检查点、Git 指令、实验性代理团队、各种命令禁用开关等
10. **Plugin** — 插件缓存、marketplace 自动安装、同步安装超时
11. **OTelemetry** — OTel 日志/指标/刷新超时
12. **Vertex** — 各模型在 Vertex 的区域覆盖
13. **Display** — 语法高亮、无闪烁模式、滚动速度、Glob 超时、IDE 覆盖、调试日志级别等

## 不变项

- 保留原有的 `ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`、`ANTHROPIC_MODEL` 等核心字段
- 保留部分历史 web 专用字段（如 `CLAUDE_CODE_DEBUG`、`CLAUDE_CODE_WORKING_DIR`）在 Debug 分类末尾
- 自动补全交互逻辑（Autocomplete 组件使用）保持不变

## 验收标准

- [x] `pnpm web:build` 构建成功无报错
- [x] `ENV_KEY_SUGGESTIONS` 长度从 20 个扩展到约 180 个
- [x] 字段集合与 `src/config/env-registry.js` 的 `BUILTIN_ENV_VARS` 基本一致
