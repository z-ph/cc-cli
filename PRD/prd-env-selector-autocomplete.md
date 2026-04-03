# PRD: 环境变量选择器升级 — autocomplete 搜索 + 全量枚举

## 背景与问题

当前 `cc add` 的"添加其他环境变量"交互使用 inquirer `list` 类型，存在两个问题：

1. **内置列表不全** — `BUILTIN_ENV_VARS` 仅枚举了约 25 个变量，而 Claude Code 官方文档有 ~200 个环境变量，大量常用变量缺失（如模型映射 `ANTHROPIC_DEFAULT_SONNET_MODEL` 系列、认证相关、功能开关等）
2. **无搜索能力** — 当列表项变多后，`list` 类型只能上下翻页，无法快速定位目标变量

## 目标

1. 补全所有 Claude Code 文档中的环境变量到 `BUILTIN_ENV_VARS`
2. 将交互从 `list` 升级为 `autocomplete`（实时搜索 + 分页），提升大量选项下的选择效率
3. 保留手动输入自定义变量的能力（覆盖未来新增变量或非 Claude Code 变量）

## 方案

### 新增依赖

- `inquirer-autocomplete-prompt` — inquirer v9 兼容的 autocomplete 插件，提供实时搜索过滤 + 分页

### 变更范围

#### 1. `src/config/env-registry.js` — 补全 BUILTIN_ENV_VARS

从 `env.md` 文档提取所有环境变量，按分类补全到 `BUILTIN_ENV_VARS` 数组。每个条目包含：

- `key` — 变量名
- `category` — 分类（Provider / Auth / Model / Network / MCP / Privacy / Context / Shell / Feature / Plugin / OTelemetry / Vertex / Custom）
- `desc` — 中文简短描述
- `type` — 输入类型（`flag` / `text` / `number` / `choice`）

已枚举的 ~25 个保持不变，其余新增。

#### 2. `src/config/env-registry.js` — 新增 buildAutocompleteSource 函数

新增 `buildAutocompleteSource(entries, existing)` 函数，返回符合 `inquirer-autocomplete-prompt` 签名的 source 函数：

- 接收用户输入作为搜索关键词
- 按 key 和 desc 模糊匹配过滤
- 按分类分组展示（用 Separator）
- 在列表末尾保留 "Custom - 手动输入" 和 "Done - 完成" 选项
- 使用 `pageSize: 15` 控制分页

#### 3. `src/commands/add.js` — 替换 list 为 autocomplete

将 "Add other environment variables" 循环中的 `type: 'list'` 替换为 `type: 'autocomplete'`，调用 `buildAutocompleteSource`。

交互流程不变：
- 选择变量 → 输入值 → 可继续选择或完成
- 选 Custom → 手动输入 key + value → 可保存到 registry

#### 4. `edit.js` 不受影响

`edit` 命令直接打开 JSON 编辑器，不涉及变量选择器，无需修改。

### 搜索行为

- 输入为空时：按分类分组，展示全部变量
- 输入关键词时：对 `key` 和 `desc` 做大小写不敏感的子串匹配
- 匹配结果按分类排序
- 已设置的变量从列表中隐藏（与当前行为一致）

### 自定义输入

列表末尾的 "Custom - 手动输入" 选项始终存在（不受搜索过滤影响），选中后进入手动输入 key/value 的流程，与现有逻辑一致。

## 不做的事

- 不改变 profile 编辑的整体流程（环境变量 → 权限 → 自定义 JSON）
- 不改变 env-registry.yaml 的持久化逻辑
- 不添加变量值的校验（如 URL 格式、数字范围等）
