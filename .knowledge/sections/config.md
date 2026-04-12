## 配置层 (src/config/)

配置层由 5 个模块组成，负责 YAML 配置文件的加载/保存、校验、合并，以及环境变量注册表管理和交互式选择。模块间依赖关系为：

```
loader.js → merger.js （无循环依赖）
env-registry.js, env-selector-prompt.js, validator.js 各自独立
```

### loader.js — 配置加载与 Profile 解析

核心职责：管理全局 (`~/.claude/models.yaml`) 和本地 (`.claude/models.yaml`) 配置文件的读写，以及按优先级查找并解析 profile。

**常量**
- `GLOBAL_CONFIG_PATH`: `~/.claude/models.yaml`
- `LOCAL_CONFIG_PATH`: `.claude/models.yaml`
- `DEFAULT_CONFIG`: `{ settings: { alias: 'cc' }, base: {}, profiles: {} }`

**导出接口**

| 函数 | 说明 |
|------|------|
| `loadConfig(customConfigPath?)` | 加载配置。无参时加载全局配置，不存在则用 `DEFAULT_CONFIG` 初始化创建。支持自定义路径。 |
| `saveConfig(config, customConfigPath?)` | 将配置对象序列化为 YAML 写入文件，自动创建目录。 |
| `loadGlobalConfig()` | 仅读取全局配置，不存在返回 `null`。不触发默认创建。 |
| `findProfile(profileId, customConfigPath?, options?)` | 按优先级查找 profile：custom → local → global。始终预加载全局配置以支持 base 继承。返回 `{ profile, configPath, source }`。`options.mergeBase`（默认 true）控制是否合并 base。 |
| `resolveProfile(globalConfig, localConfig, profileId)` | 执行三级合并链：`globalBase → localBase → profile`，每层覆盖前一层。 |
| `getSettingsDir(configPath)` | 根据配置文件路径返回 settings JSON 文件应写入的目录。 |
| `getLocalConfigPath()` / `getGlobalConfigPath()` | 返回绝对路径常量。 |

**关键设计决策**
- `loadConfig` 只在全局路径不存在时自动创建默认配置，其他路径不存在则返回空默认值但不写入文件
- `findProfile` 始终预加载全局配置（`loadGlobalConfig`），确保 base 继承链完整
- Launch 命令有意不合并 base，避免覆盖 `~/.claude/settings.json`

### merger.js — 深度合并工具

单一导出 `deepMerge(base, override)`，实现 Claude Code 语义的深度合并：
- **数组**：拼接后去重（`[...new Set([...base, ...override])]`）
- **对象**：递归合并共有键
- **标量**：override 覆盖 base
- `undefined` 一侧直接取另一侧的值

### validator.js — 配置校验

两个纯函数，无外部依赖：

| 函数 | 校验规则 |
|------|---------|
| `validateConfigEntry(entry)` | 必须是非 null 非 Array 的对象 |
| `validateConfigId(configId, existingConfigs)` | 非空字符串，仅允许 `[a-zA-Z0-9._-]`，且不能与已有配置重名 |

返回值统一为 `{ valid: boolean, error?: string }`。

### env-registry.js — 环境变量注册表

管理 Claude Code 支持的全部环境变量定义，提供内置变量库 + 用户自定义变量的合并机制。

**常量 `BUILTIN_ENV_VARS`**
约 170 个预定义环境变量，按 12 个分类组织：Provider、Auth、Model、Network、MCP、Privacy、Context、Shell、Feature、Plugin、OTelemetry、Vertex、Display。每个条目结构为 `{ key, category, desc, type, choices? }`，type 支持 `flag`/`text`/`number`/`choice` 四种。

**存储路径**
- 全局注册表：`~/.claude/env-registry.yaml`
- 本地注册表：`.claude/env-registry.yaml`

**导出接口**

| 函数 | 说明 |
|------|------|
| `loadEnvRegistry()` | 合并三层：内置 → 全局自定义 → 本地自定义。后层覆盖前层同 key 条目。 |
| `saveEnvRegistry(entries, scope)` | 仅保存非内置条目（用户自定义变量），支持 `'local'` / `'global'` 两种 scope。 |
| `appendToRegistry(entry, scope)` | 向指定 scope 的注册表追加单条记录，去重。 |
| `buildEnvChoices(entries, existing)` | 构建 inquirer 原始 choices 列表（按分类分组 + 分隔线），过滤已设置项，末尾附带 Custom/Done 选项。 |
| `buildAutocompleteSource(entries, existing)` | 构建支持模糊搜索的 autocomplete source 函数，按 key/desc 匹配，跨所有分类。 |
| `buildPagedEnvSource(entries, existing)` | 构建分页式 autocomplete source，返回 `{ source, controller }`。controller 支持 `switchCategory('prev'/'next')` 和 `currentCategory` getter，用于左右键切换分类。 |
| `promptEnvValue(varDef, currentValue)` | 根据变量类型（flag → confirm, choice → list, number → 校验数字的 input, text → input）交互式获取值。 |

### env-selector-prompt.js — 自定义交互式选择器

继承 `inquirer-autocomplete-prompt`，扩展左右键分类切换能力：
- 接收 `opt.sourceController` 对象（由 `buildPagedEnvSource` 生成）
- 捕获 `left`/`right` 键事件调用 `sourceController.switchCategory()`
- 切换后清空搜索输入、重置选中索引，触发重新搜索
- 其他按键委托给父类处理