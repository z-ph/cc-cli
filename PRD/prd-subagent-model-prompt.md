# PRD: add/edit 交互流程新增 CLAUDE_CODE_SUBAGENT_MODEL 提示

## 背景与问题

`CLAUDE_CODE_SUBAGENT_MODEL` 是 Claude Code 的子代理模型环境变量，用于控制 spawn 的子代理使用哪个模型。当前用户只能通过以下方式设置：

1. 在 `cc add` / `cc edit` 的 env-selector 中手动搜索并选择（需要翻到 Model 分类）
2. 直接编辑 YAML 文件

由于子代理模型通常与主模型 (`ANTHROPIC_MODEL`) 一致或密切相关，用户每次都要在 env-selector 中翻找，体验不佳。

## 目标

在 `cc add` 和 `cc edit` 的核心环境变量交互流程中，紧跟 `ANTHROPIC_MODEL` 之后新增 `CLAUDE_CODE_SUBAGENT_MODEL` 提示，直接询问是否与 `ANTHROPIC_MODEL` 一致，减少操作步骤。

## 方案设计

### 交互流程

在 `ANTHROPIC_MODEL` 输入之后，新增：

1. **用户已填写 ANTHROPIC_MODEL**：
   - 确认提示：`CLAUDE_CODE_SUBAGENT_MODEL 是否与 ANTHROPIC_MODEL 一致?`
   - 选「是」→ 自动复制 `ANTHROPIC_MODEL` 的值
   - 选「否」→ 弹出输入框，可手动填写（可选，回车跳过）
   - 默认值逻辑：如果已有值且与 model 相同 → `true`，否则 → `true`（新增场景默认一致）

2. **用户未填写 ANTHROPIC_MODEL**：
   - 不弹出提示（用户可通过 env-selector 单独添加）

### 涉及文件

- `src/commands/add.js` — base 模式 + profile 模式，共 2 处
- `src/commands/edit.js` — base 模式 + profile 模式，共 2 处
- `tests/commands/edit.test.js` — 更新 `buildProfileChain` / `buildBaseChain` 补充 mock 响应

### 技术细节

1. `CLAUDE_CODE_SUBAGENT_MODEL` 加入核心环境变量列表 (`coreKeys` / `CORE_ENV_KEYS`)，使其：
   - 不出现在 env-selector 的候选项中（已设置的隐藏）
   - 在 edit 的 checkbox 删除列表中被排除（由核心提示管理）
   - 在 source 预填时作为核心变量处理

2. `env-registry.js` 无需修改 — `CLAUDE_CODE_SUBAGENT_MODEL` 已在 `BUILTIN_ENV_VARS` 的 Model 分类中

3. 空值安全：subagent model 输入使用可选链 `?.trim()` 防止 undefined

## 测试计划

- 现有 144 个测试用例全部通过（无回归）
- `buildProfileChain` / `buildBaseChain` 新增 `subagentSameAsModel` 和 `subagentModel` 选项，默认 `sameAsModel: true`
- 新增场景（后续可补）：
  - 设置 ANTHROPIC_MODEL 后确认 subagent 一致 → 验证 env 中两者相同
  - 设置 ANTHROPIC_MODEL 后拒绝一致 → 手动输入自定义 subagent model
  - 不设置 ANTHROPIC_MODEL → 不弹出 subagent 提示
  - edit 模式下已有不同值 → 默认值为 false
