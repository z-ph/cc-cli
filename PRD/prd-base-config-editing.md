# PRD: add/edit 命令支持 --base 参数编辑 base 配置

## 背景与问题

`models.yaml` 支持 `base` 节点，作为所有 profile 的共享默认配置，在 `resolveProfile()` 中通过 `globalBase → localBase → profile` 链自动合并。但当前没有用户可触达的方式编辑 `base`：

- `cc add <id>` — 只操作 `config.profiles[id]`
- `cc edit <id>` — 只操作 `config.profiles[id]`
- 用户只能手动编辑 YAML 文件

## 解决方案

为 `add` 和 `edit` 命令引入 `--base, -b` 参数，将操作目标从 `profiles[id]` 切换到 `base`。

## 功能需求

### `cc add base -b`

1. 忽略 `<profile-id>` 参数 — `base` 没有 ID，positional arg 仅占位
2. 交互流程不变 — 环境变量、权限、自定义 JSON 的提示流程与现有 add 完全一致
3. 写入目标切换 — 将结果写入 `config.base` 而非 `config.profiles[id]`
4. 合并策略 — 使用 `deepMerge` 将用户输入与已有 `config.base` 合并（而非覆盖）
5. 成功提示 — 输出 `Base config updated in '<configPath>'`

### `cc edit base -b`

1. 忽略 `<profile-id>` 参数
2. 编辑器内容 — 预填 `config.base` 当前内容（JSON 格式）
3. 跳过 ID 重命名步骤 — `base` 无需询问新 ID
4. 保存 — 解析编辑器结果写入 `config.base`
5. 成功提示 — 输出 `Base config updated in '<configPath>'`

### 作用域

`-g` / `-t` 照常生效：

```bash
cc add base -b           # 编辑本地 ./.claude/models.yaml 的 base
cc add base -b -g        # 编辑全局 ~/.claude/models.yaml 的 base
cc edit base -b -t file  # 编辑自定义配置文件的 base
```

## 边界情况

| 场景 | 处理方式 |
|------|----------|
| `config.base` 不存在 | 当作空对象 `{}` 处理 |
| `config.base` 为空对象 | 正常进入交互流程 / 编辑器显示 `{}` |
| `--base` 与 `--source` 同时传入 | 合法，source 内容作为预填值 |
| 不带 `--base` 执行 `cc add base` | 按现有逻辑创建名为 `base` 的 profile（不破坏向后兼容） |

## 不做的事

- 不新增独立命令（如 `cc base`），复用现有命令降低学习成本
- 不修改 `remove` / `list` — `base` 不是 profile
- 不修改 `launch` / `use` — 已通过 `resolveProfile()` 自动合并 base

---

## 开发检查点

- [ ] `bin/cc.js` — `add` 命令注册 `.option('-b, --base', ...)`
- [ ] `bin/cc.js` — `edit` 命令注册 `.option('-b, --base', ...)`
- [ ] `src/commands/add.js` — 检测 `options.base`，跳过 profileId 校验，写入 `config.base`
- [ ] `src/commands/edit.js` — 检测 `options.base`，跳过 ID 重命名，编辑 `config.base`

## 测试检查点

- [ ] `cc add base -b -g` 交互流程正常，写入全局 `base` 节点
- [ ] `cc edit base -b -g` 编辑器打开并预填当前 base 内容，保存后正确写入
- [ ] `cc add base -b`（本地）写入本地配置的 `base` 节点
- [ ] 已有 `base` 内容不被覆盖，而是 `deepMerge` 合并
- [ ] 不带 `-b` 的 `cc add base` 仍然创建名为 `base` 的 profile（向后兼容）
- [ ] `--base` 与 `--source` 同时传入时，source 内容作为预填值
- [ ] `config.base` 不存在时当作 `{}` 处理，不报错
- [ ] 已有测试不受影响（`pnpm test` 全部通过）
