# PRD: 环境变量选择器分页 — 左右切换分类 + Custom/完成常驻顶部

## 背景与问题

当前 `cc add` 的环境变量选择器（`autocomplete` 模式）将 200+ 个变量按分类垂直排列，用户需要上下滚动浏览全部列表。虽然有搜索过滤能力，但"浏览模式"下找到目标分类效率低——需要滚过大量不相关分类的条目。

痛点：
1. 浏览模式下所有分类混在一起，200+ 条目需要大量上下滚动
2. "Custom" 和 "完成" 选项在列表最底部，每次都要滚动到底部才能操作
3. 缺乏分类维度的快速切换手段

## 目标

1. 将浏览模式从"全量垂直列表"改为"按分类左右切换分页"
2. "Custom - 手动输入变量名" 和 "✓ 完成" 选项固定在顶部常驻
3. 分类标题显示当前序号（如 `Provider (2/13)`），让用户了解分类总数
4. 保留输入即搜索（autocomplete）的能力，搜索时跨所有分类过滤

## 方案

### 交互设计

```
? Add environment variable (← → 切换分类, 输入搜索):
❯ Custom - 手动输入变量名
  ✓ 完成
  ── Provider (1/13) ──
  CLAUDE_CODE_USE_BEDROCK - 使用 AWS Bedrock (flag)
  CLAUDE_CODE_USE_VERTEX - 使用 Google Vertex AI (flag)
  ...

按 → 切换到下一个分类：
❯ Custom - 手动输入变量名
  ✓ 完成
  ── Model (3/13) ──
  CLAUDE_CODE_EFFORT_LEVEL - 推理努力等级 (low/medium/high/max/auto)
  ...

输入文字时切换为搜索模式，跨所有分类过滤：
? Add environment variable (← → 切换分类, 输入搜索): timeout
❯ Custom - 手动输入变量名
  ✓ 完成
  ── Network ──
  API_TIMEOUT_MS - API 请求超时 (number)
  ── MCP ──
  MCP_TIMEOUT - MCP 启动超时 (number)
  ...
```

键盘操作：
- **↑↓** — 上下选择列表项（继承 autocomplete 行为）
- **←→** — 切换分类（新功能）
- **输入字符** — 实时搜索过滤（继承 autocomplete 行为）
- **Enter** — 确认选择
- 左右切换分类时自动清空搜索输入，回到浏览模式

### 变更范围

#### 1. 新建 `src/config/env-selector-prompt.js` — 自定义 inquirer prompt

继承 `inquirer-autocomplete-prompt`，重写 `onKeypress` 方法：

- 拦截左/右箭头事件
- 调用 `sourceController.switchCategory('prev'/'next')` 切换分类
- 清空搜索输入（`this.rl.line = ''`）并重新渲染
- 其余按键委托给父类处理（上下箭头、输入、回车等）

通过 `opt.sourceController` 接收外部传入的分类控制器。

#### 2. 修改 `src/config/env-registry.js` — 新增 buildPagedEnvSource

新增 `buildPagedEnvSource(entries, existing)` 函数，返回 `{ source, controller }`：

- **`source(answers, input)`** — 符合 autocomplete source 签名的异步函数
  - `input` 为空：只显示当前分类的变量 + 顶部 Custom/完成
  - `input` 非空：跨所有分类过滤匹配项
  - Custom 和完成始终在 choices 最前面

- **`controller`** — 分类控制器
  - `switchCategory(dir)` — `'prev'` / `'next'` 切换，循环环绕
  - `currentCategory` — getter，返回当前分类名
  - `categories` — 分类名数组

保留原有 `buildAutocompleteSource` 不修改，向后兼容。

#### 3. 修改 `src/commands/add.js` — 注册并使用 env-selector prompt

- `inquirer.registerPrompt('env-selector', EnvSelectorPrompt)` 注册自定义 prompt
- 两处环境变量选择循环（base 模式 ~line 105 和 profile 模式 ~line 251）：
  - `type: 'autocomplete'` → `type: 'env-selector'`
  - `buildAutocompleteSource` → `buildPagedEnvSource`
  - 传入 `sourceController: controller` 参数
  - 提示信息增加"输入搜索"说明

#### 4. 修改 `tests/config/env-registry.test.js` — 新增测试

为 `buildPagedEnvSource` 添加测试用例：
- 返回结构验证（source + controller）
- 顶部常驻 Custom/完成
- 浏览模式只显示当前分类
- 分类切换与环绕
- 搜索模式跨分类过滤
- 已设置变量隐藏
- 分类标题含序号

## 不做的事

- 不改变 `edit` 命令（不涉及变量选择器）
- 不改变 env-registry.yaml 的持久化逻辑
- 不引入新依赖（复用 inquirer-autocomplete-prompt）
- 不修改 `buildAutocompleteSource`（保留向后兼容）
- 搜索模式下不支持左右箭头翻页（MVP 范围外）

## 验证

1. `pnpm test` 全量通过
2. 手动运行 `cc add test` 验证：
   - Custom 和完成在顶部常驻
   - ←→ 切换分类，标题显示序号（如 `Provider (2/13)`）
   - 输入文字搜索跨分类过滤
   - 清空搜索后回到当前分类浏览
   - 选择变量 → 输入值 → 正常保存
   - 选择 Custom → 手动输入 → 正常保存
   - 选择完成 → 正常退出循环
