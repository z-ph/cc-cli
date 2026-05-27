# edit/add JSON 编辑器默认不弹窗

## 背景

`zcc edit` / `zcc add` 交互末尾有 "Add other settings fields as JSON?" 确认项。当前 default 值会检测 profile/base 中是否存在非 env/permissions 字段（如 `hooks`、`proxy`、`modelOverride`），存在则默认为 `true`。用户一路回车时会意外触发 `type: 'editor'` 弹出记事本，体验很差。

## 目标

将 "Add other settings fields as JSON?" 的默认值改为 `false`，用户需明确选择 Yes 才会进入 JSON 编辑环节。

## 方案

修改 2 个文件，共 4 处，将 `default` 从动态检测改为固定 `false`：

| 文件 | 行号 | 模式 |
|------|------|------|
| `src/commands/edit.js` | 125 | base |
| `src/commands/edit.js` | 274 | profile |
| `src/commands/add.js` | 139 | base |
| `src/commands/add.js` | 321 | profile |

改动示例：
```js
// before
default: Object.keys(entry).some(k => k !== 'permissions' && k !== 'env') || false

// after
default: false
```

## 测试计划

- `add.js` / `edit.js` 不在 Jest 覆盖范围，手动验证：
  1. 对有 proxy/hooks 等额外字段的 profile 执行 `zcc edit <profile>`，一路回车，确认不弹记事本
  2. `zcc add`、`zcc edit --base`、`zcc add --base` 同样验证
  3. 手动选 Yes 时编辑器功能仍然正常

## 文档影响

无。
