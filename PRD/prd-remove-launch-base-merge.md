# PRD: 移除 launch 命令中的 base 合并逻辑

## 背景与问题

当前 `cc <id>` (launch) 命令通过 `findProfile()` 解析 profile 时，会执行 base 合并链：

```
deepMerge(deepMerge(globalBase, localBase), profile)
```

合并后的完整结果写入 `settings.<id>.json`，再通过 `claude --settings <path>` 启动。

**问题**：Claude Code 本身会自动加载 `~/.claude/settings.json`（全局用户配置）。如果我们在 `settings.<id>.json` 中也包含了 base 配置（通过合并），那么：

1. Claude Code 加载 `~/.claude/settings.json` 作为全局配置
2. Claude Code 加载 `--settings settings.<id>.json`，该文件已包含 base 合并的结果
3. `--settings` 优先级最高，因此 base 中的配置项会**覆盖**用户在 `~/.claude/settings.json` 中的设置
4. 结果：全局配置反而变成了最高优先级，profile 无法真正覆盖 base 中的配置项

## 解决方案

在 launch 命令中，**不合并 base**，只使用 profile 自身的内容生成 `settings.<id>.json`。

这样配置优先级变为：

1. Claude Code 自动加载 `~/.claude/settings.json`（最低）
2. Claude Code 加载 `--settings settings.<id>.json`，仅包含 profile 配置（最高）

用户可以通过 `~/.claude/settings.json` 管理全局配置，通过 profile 管理特定覆盖，优先级正确。

## 功能变更

### `findProfile()` 新增参数

`findProfile(profileId, customConfigPath, options)` 新增第三个参数 `options`，支持 `{ mergeBase: false }` 跳过 base 合并。

- `mergeBase: true`（默认）— 保持现有行为，返回 `resolveProfile()` 合并结果
- `mergeBase: false` — 返回原始 profile，不合并 base

### `launch.js` 调整

调用 `findProfile()` 时传入 `{ mergeBase: false }`，仅获取 profile 自身配置。

### `use.js` 不变

`use` 命令仍然合并 base，因为它是写入 `settings.local.json` / `settings.json`，需要包含完整配置。

## 影响范围

| 文件 | 变更 |
|------|------|
| `src/config/loader.js` | `findProfile()` 新增 `options.mergeBase` 参数 |
| `src/commands/launch.js` | 传入 `mergeBase: false` |
| `tests/commands/launch.test.js` | 更新测试 |

不影响：`use`、`add`、`edit`、`remove`、`list`、`parse`、`alias`、`restore` 命令。

---

## 开发检查点

- [ ] `src/config/loader.js` — `findProfile()` 支持 `options.mergeBase`
- [ ] `src/commands/launch.js` — 传入 `{ mergeBase: false }`

## 测试检查点

- [ ] launch 生成的 settings 文件仅包含 profile 内容，不含 base
- [ ] use 命令仍正常合并 base（不受影响）
- [ ] 已有测试全部通过
