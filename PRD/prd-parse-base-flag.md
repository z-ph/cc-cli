# PRD: cc parse 支持 --base 参数

## 背景

`cc add` 已支持 `--base, -b` 参数，可以将配置直接写入 `base` 节而非 `profiles` 节。`cc parse` 命令用于将已有 settings JSON 文件解析为 YAML 配置，但当前只支持写入 `profiles`，缺少写入 `base` 的途径。

## 目标

为 `cc parse` 添加 `--base, -b` 选项，使解析结果合并到 `config.base` 而非 `config.profiles[profileId]`。

## 方案

### CLI 变更（`bin/cc.js`）

在 parse 命令注册处新增选项：
```
.option('-b, --base', 'save as base config instead of profile')
```

### 逻辑变更（`src/commands/parse.js`）

1. 引入 `deepMerge`（来自 `merger.js`）
2. 在冲突检查之前增加 base 模式分支：
   - `options.base` 为 true 时，将解析的 settings 通过 `deepMerge` 合并到 `config.base`
   - 跳过 profileId 冲突检查和校验（base 不需要 ID）
   - 保存并提示用户

### 用法

```bash
cc parse ./settings.json myconfig --base
```

### 合并语义

使用已有的 `deepMerge()`，与 `add --base` 行为一致：数组 concat + 去重，对象递归合并。

## 影响范围

- `bin/cc.js`：parse 命令增加一个 option
- `src/commands/parse.js`：增加约 8 行 base 分支逻辑 + 1 行 import
- 不影响现有 parse 行为（默认仍写入 profiles）
- 测试全部通过，无需新增测试（parse 测试不涉及交互，base 分支为简单 merge+save）
