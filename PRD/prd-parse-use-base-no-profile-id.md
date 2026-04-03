# PRD: cc parse --base 和 cc use --base 不再要求 profile-id

## 背景

当前 `cc parse <settings-path> <profile-id>` 中 `profile-id` 是必填参数，即使用户指定了 `--base`（base 模式不使用 profile-id），Commander.js 仍会强制要求提供第二个参数。用户必须传入一个无意义的占位值（如 `cc parse ./settings.json dummy -b`），体验不佳。

同样，`cc use` 命令只支持按 profile-id 查找并应用配置，缺少对 base 配置的支持。用户无法通过 `use` 将 base 配置应用到 settings 文件。

## 目标

1. `cc parse --base` 不再要求 `profile-id` 参数
2. `cc use --base` 支持将 base 配置应用到 settings 文件，不要求 `profile-id`

## 方案

### 1. cc parse：profile-id 改为可选

**CLI 变更（`bin/cc.js`）**

将 parse 命令的 `<profile-id>` 改为 `[profile-id]`（可选参数）：
```
.command('parse <settings-path> [profile-id]')
```

**逻辑变更（`src/commands/parse.js`）**

在函数入口增加校验：当未提供 `profileId` 且未使用 `--base` 或 `--copy` 时，报错提示 profile-id 是必需的（除非使用 --base）。

### 2. cc use：新增 --base 支持

**CLI 变更（`bin/cc.js`）**

- 将 `<profile-id>` 改为 `[profile-id]`（可选）
- 新增选项：`.option('-b, --base', 'apply base config instead of a profile')`

**逻辑变更（`src/commands/use.js`）**

1. 当 `options.base` 为 true 时：
   - 按优先级加载配置文件（custom > local > global）
   - 读取 `config.base` 作为 profile 数据
   - 若 base 为空或不存在，报错提示用户先创建 base 配置
   - 跳过 `findProfile()` 调用
2. 当未提供 `profileId` 且未使用 `--base` 时，报错提示
3. 其余逻辑（settings 文件路径、备份、合并、写入）保持不变
4. 日志消息根据模式区分：base 模式显示 "Base config applied"，profile 模式显示 "Profile 'xxx' applied"

### 用法

```bash
# parse 使用 --base，无需 profile-id
cc parse ./settings.json -b

# use 使用 --base，无需 profile-id
cc use -b
cc use -b -g
```

## 影响范围

- `bin/cc.js`：parse 和 use 命令参数和选项调整
- `src/commands/parse.js`：增加 profile-id 缺失校验（约 3 行）
- `src/commands/use.js`：增加 base 模式分支（约 25 行），需额外 import `loadConfig`、`getLocalConfigPath`、`getGlobalConfigPath`
- 不影响现有行为：parse 不带 --base 仍需 profile-id，use 不带 --base 仍需 profile-id
