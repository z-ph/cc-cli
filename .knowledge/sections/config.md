## config (src/config/)

配置子系统的核心模块，负责 YAML 配置文件的加载、存储、合并、校验，以及环境变量注册表的维护和交互式选择。

### 文件结构与职责

| 文件 | 职责 |
|------|------|
| `loader.js` | 配置文件 I/O、profile 查找与 base 继承合并 |
| `merger.js` | 通用深合并工具，处理数组拼接去重语义 |
| `validator.js` | 配置条目和 ID 的格式校验 |
| `env-registry.js` | 环境变量注册表：内置变量定义、持久化、交互式选择源 |
| `env-selector-prompt.js` | 自定义 inquirer prompt，支持左右键切换分类 |

### loader.js

**路径常量：**
- 全局：`~/.claude/models.yaml`，局部：`./.claude/models.yaml`

**默认配置结构：** `{ settings: { alias: 'cc' }, base: {}, profiles: {} }`

**核心函数：**

- `loadConfig(customConfigPath?)` — 加载配置文件。无 `customConfigPath` 时默认读全局路径；文件不存在时自动创建默认配置并保存后返回
- `saveConfig(config, customConfigPath?)` — 将配置对象序列化为 YAML 写入文件，自动创建目标目录
- `loadGlobalConfig()` — 仅在全局配置存在时加载，否则返回 `null`（不触发创建）
- `resolveProfile(globalConfig, localConfig, profileId)` — 按继承链 `globalBase → localBase → profile` 三层 `deepMerge` 得到最终 profile
- `findProfile(profileId, customConfigPath, options?)` — 按 **custom > local > global** 优先级查找 profile，返回 `{ profile, configPath, source }`。`options.mergeBase`（默认 `true`）控制是否合并 base 层。全局配置始终预加载用于 base 继承
- `getSettingsDir(configPath)` — 返回 `settings.<id>.json` 应写入的目录（即 configPath 所在目录）

**导出：** `loadConfig`, `saveConfig`, `findProfile`, `getSettingsDir`, `getLocalConfigPath`, `getGlobalConfigPath`

### merger.js

- `deepMerge(base, override)` — 递归深合并。数组类型执行拼接 + `Set` 去重；对象类型递归合并共享 key；标量类型 override 覆盖。`undefined` 值不覆盖对方

**导出：** `{ deepMerge }`

### validator.js

- `validateConfigEntry(entry)` — 校验条目是否为非 null 对象
- `validateConfigId(configId, existingConfigs)` — 校验 ID 非空、仅含 `[a-zA-Z0-9._-]`、不与已有配置冲突

**导出：** `{ validateConfigEntry, validateConfigId }`

### env-registry.js

**内置环境变量注册表 `BUILTIN_ENV_VARS`：** 约 130+ 条，按 category 分组：Provider、Auth、Model、Network、MCP、Privacy、Context、Shell、Feature、Plugin、OTelemetry、Vertex、Display。每条包含 `{ key, category, desc, type }`，type 可选 `flag`/`text`/`number`/`choice`。

**注册表分层存储：**
- 全局：`~/.claude/env-registry.yaml`
- 局部：`./.claude/env-registry.yaml`
- 加载时按 `builtin → global override → local override` 三层合并（`mergeEntries`：按 key 匹配覆盖或追加）

**核心函数：**

- `loadEnvRegistry()` — 三层合并后返回完整变量列表
- `saveEnvRegistry(entries, scope)` — 仅保存用户自定义条目（过滤掉内置条目）到指定 scope 的文件
- `appendToRegistry(entry, scope)` — 向指定 scope 文件追加单条（key 去重）
- `buildEnvChoices(entries, existing)` — 构建分类分组的 inquirer choices 列表（已设置变量隐藏，末尾有 Custom/Done 选项）
- `buildAutocompleteSource(entries, existing)` — 返回支持模糊搜索的 autocomplete source 函数（按 key/desc 匹配）
- `buildPagedEnvSource(entries, existing)` — 返回分页式 autocomplete source + controller 对象。controller 提供 `switchCategory(dir)` 和 `currentCategory`，支持左右切换分类浏览
- `promptEnvValue(varDef, currentValue?)` — 根据 varDef.type 弹出对应类型的 inquirer 输入提示（flag→confirm、choice→list、number→input with validation、text→input）

**导出：** `BUILTIN_ENV_VARS`, `loadEnvRegistry`, `saveEnvRegistry`, `appendToRegistry`, `buildEnvChoices`, `buildAutocompleteSource`, `buildPagedEnvSource`, `promptEnvValue`, `getLocalRegistryPath`, `getGlobalRegistryPath`

### env-selector-prompt.js

继承 `inquirer-autocomplete-prompt` 的自定义 prompt 类 `EnvSelectorPrompt`。

- 扩展 `onKeypress(e)`：捕获左右方向键，调用 `this.sourceController.switchCategory(dir)` 切换分类，重置选中索引和搜索输入后刷新列表；其余按键委托给父类处理
- 构造函数从 `opt.sourceController` 读取控制器实例（由 `buildPagedEnvSource` 产生）

**导出：** `EnvSelectorPrompt`（class 本身）

### 模块间依赖关系

```
loader.js ──→ merger.js (deepMerge)
env-selector-prompt.js ──→ inquirer-autocomplete-prompt (继承)
env-registry.js ──→ inquirer (交互提示)
                 ──→ js-yaml (序列化)
loader.js ──→ js-yaml, fs, path, os
```

`validator.js` 和 `merger.js` 为纯工具模块，无外部依赖。`env-selector-prompt.js` 仅被 `add` 命令引用，配合 `env-registry.js` 的 `buildPagedEnvSource` 使用。