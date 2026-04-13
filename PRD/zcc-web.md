# zcc web - 前端可视化配置界面

## 背景

目前 cc-cli 提供了一套完整的命令行界面来管理 Claude Code 的配置（profiles），包括添加、编辑、删除、列出配置等操作。但对于不熟悉命令行的用户，或者希望更直观地管理配置的用户，需要一个可视化的前端界面。

## 目标

1. 提供一个 Web 前端界面，让用户可以通过浏览器可视化管理所有配置
2. 支持对所有 profile 的增删改查操作
3. 支持对 base 配置的编辑
4. 支持配置文件的导入导出
5. 支持快速操作（启动 Claude Code、应用配置、代理管理）
6. 前端界面通过 `zcc web` 命令启动

## 技术选型

### 前端框架
- **React 18** - 组件化开发
- **Material UI v5** - UI 组件库
- **SPA 模式** - 预构建为静态文件，Express 提供服务

### 为什么选择 SPA 而非 SSR？
- SSR 实现复杂度高（需要 Babel/webpack SSR 配置）
- SPA 预构建后部署简单，符合 CLI 工具简洁风格
- 首屏加载通过代码分割和优化可接受

### 后端框架
- **Express** - 轻量级 HTTP 服务器，提供静态文件服务和 API
- Node.js 原生模块（fs, path, os）

### 依赖
- 新增：`react@^18.2.0`, `react-dom@^18.2.0`, `express@^4.x`, `@mui/material@^5.x`, `@emotion/react@^11.x`, `@emotion/styled@^11.x`
- 现有：`js-yaml`（已依赖）
- 构建工具（开发时）：`vite`（可选，用于本地开发）

## 功能设计

### 1. Profile 管理

| 功能 | 说明 |
|------|------|
| 列表展示 | 表格列出所有 profiles，显示环境变量、权限等摘要信息 |
| 添加 Profile | 表单引导创建新 profile |
| 编辑 Profile | 预填现有值，支持修改所有字段 |
| 删除 Profile | 带确认对话框 |
| 切换作用域 | 本地/全局配置切换 |

### 2. Base 配置编辑

- 独立入口编辑 base 节点
- 表单引导式编辑
- 支持环境变量、权限配置、其他 settings 字段

### 3. 配置编辑器

| 编辑器 | 说明 |
|--------|------|
| 环境变量 | 支持 autocomplete 搜索（覆盖 ~200 个 Claude Code 内置变量） |
| 权限配置 | allow/deny 列表，支持动态增删 |
| 其他 Settings | hooks、proxy、modelOverride 等字段 |

### 4. 配置文件管理

| 功能 | 说明 |
|------|------|
| 查看原始 YAML | 代码高亮显示完整配置内容 |
| 导入配置 | 支持 JSON/YAML 文件上传导入 |
| 导出配置 | 下载配置为 JSON/YAML 文件 |

### 5. 快速操作

| 操作 | 对应命令 |
|------|----------|
| 启动 Claude Code | `zcc <id>` |
| 应用配置到 settings | `zcc use <id>` |
| 启动代理 | `zcc serve <id>` |
| 停止代理 | `zcc serve stop <id>` |

### 6. 其他功能

- 动态端口选择（自动使用空闲端口）
- 自动打开默认浏览器
- 操作成功/失败通知（Material UI Snackbar）
- 响应式布局（适配不同屏幕尺寸）

## 目录结构

```
src/
  commands/
    web.js              # web 命令入口
  web/
    server.js           # Express 服务器（静态文件 + API）
    public/             # 构建后的静态文件（生产环境）
      index.html
      assets/
        index.js
        index.css
    components/         # React 组件（开发环境/源码）
      App.jsx
      Layout.jsx
      ProfileList.jsx
      ProfileEditor.jsx
      BaseEditor.jsx
      RawYamlViewer.jsx
      ConfigImport.jsx
      ConfigExport.jsx
      QuickActions.jsx
      EnvEditor.jsx
      PermissionsEditor.jsx
    styles/
      theme.js          # Material UI 主题配置
```

### 构建策略

**开发模式**：
- `zcc web:dev` - 启动 Vite 开发服务器，支持热重载

**生产模式**：
- `zcc web` - Express 服务 `web/public` 目录的静态文件
- 静态文件预构建后打包到 npm 包中

## API 设计

### REST API 端点

| 端点 | 方法 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| `/` | GET | 主页面（静态文件） | - | HTML |
| `/api/config` | GET | 获取完整配置 | - | `{ profiles, base, settings }` |
| `/api/profiles` | GET | 获取所有 profiles | - | `[{ id, ...profile }]` |
| `/api/profiles/:id` | GET | 获取单个 profile | - | profile 对象 |
| `/api/profiles` | POST | 创建 profile | `{ id, ...profile }` | `{ success, message }` |
| `/api/profiles/:id` | PUT | 更新 profile | profile 对象 | `{ success, message }` |
| `/api/profiles/:id` | DELETE | 删除 profile | - | `{ success, message }` |
| `/api/base` | GET | 获取 base 配置 | - | base 对象 |
| `/api/base` | PUT | 更新 base 配置 | base 对象 | `{ success, message }` |
| `/api/config/raw` | GET | 获取原始 YAML | - | YAML 字符串 |
| `/api/launch/:id` | POST | 触发 `zcc <id>` | - | `{ success, message }` |
| `/api/use/:id` | POST | 触发 `zcc use <id>` | - | `{ success, message }` |
| `/api/serve/:id` | POST | 启动代理 | - | `{ success, message, port }` |
| `/api/serve/:id` | DELETE | 停止代理 | - | `{ success, message }` |

### 边界情况处理

| 场景 | 处理方案 |
|------|----------|
| 并发编辑冲突 | 读取时记录 mtime，保存时校验，冲突则提示刷新 |
| 配置文件被外部修改 | 前端定期轮询（每 5 秒），检测到变化则提示重新加载 |
| 大配置文件 | 前端虚拟列表（Virtual List）渲染，避免 DOM 过多 |
| 保存失败 | 乐观更新 + 回滚机制，失败则 Snackbar 提示并恢复原值 |

### API 响应格式

成功：
```json
{
  "success": true,
  "message": "操作成功",
  "data": { ... }
}
```

失败：
```json
{
  "success": false,
  "error": "错误信息"
}
```

## 界面设计

### 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  AppBar: zcc web - Profile Manager                    [?]   │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│  Drawer  │  Main Content Area                               │
│          │                                                  │
│  • 本地  │  ┌─────────────────────────────────────────────┐ │
│  • 全局  │  │  Profile List Table                         │ │
│          │  │  ┌────┬─────────┬─────────┬──────────────┐  │ │
│  --------│  │  │ ID │ Env     │ Perms   │ Actions      │  │ │
│          │  │  ├────┼─────────┼─────────┼──────────────┤  │ │
│  快速操作│  │  │ ...│ ...     │ ...     │ [Edit][Del]  │  │ │
│  • 导入  │  │  └────┴─────────┴─────────┴──────────────┘  │ │
│  • 导出  │  └─────────────────────────────────────────────┘ │
│  • 查看  │                                                  │
│          │  [Add Profile] [Edit Base] [View Raw YAML]      │
├──────────┴──────────────────────────────────────────────────┤
│  Status Bar: Config: ~/.claude/models.yaml | 5 profiles    │
└─────────────────────────────────────────────────────────────┘
```

### 组件层次

```
App
├── Layout
│   ├── AppBar
│   ├── Drawer (Navigation)
│   └── MainContent
│       ├── ProfileList
│       │   └── DataTable
│       │       └── ActionsCell (Edit, Delete, Launch buttons)
│       ├── QuickActions
│       │   ├── ImportButton
│       │   ├── ExportButton
│       │   └── RawYamlButton
│       └── FAB (Add Profile)
├── ProfileEditor (Dialog)
│   ├── TextField (Profile ID)
│   ├── EnvEditor
│   │   └── KeyValueEditor
│   ├── PermissionsEditor
│   │   ├── AllowList
│   │   └── DenyList
│   └── ModelOverrideEditor
├── BaseEditor (Dialog)
│   └── (same structure as ProfileEditor)
└── RawYamlViewer (Dialog)
    └── CodeHighlight
```

### 视觉风格（Material UI）

- **主色调**: 蓝色 (#1976d2) - 专业、可靠
- **辅色调**: 绿色（成功操作）、红色（危险操作）
- **字体**: Roboto / 系统字体
- **阴影**: Material Design 标准阴影层级
- **圆角**: 4px（小组件）、8px（大组件）
- **间距**: 8px 基础单位

## 安全考虑

1. **仅监听 localhost** - 不暴露到外部网络
2. **动态端口** - 减少端口冲突和固定端口风险
3. **无认证** - 因为是本地访问，暂不需要
4. **文件访问限制** - 仅允许读写配置文件目录

## 配置结构

YAML Schema:

```yaml
settings:
  alias: zcc

base:
  env:
    ANTHROPIC_AUTH_TOKEN: <shared-key>
  permissions:
    deny:
      - "Bash(rm -rf *)"

profiles:
  <profile-id>:
    env:
      ANTHROPIC_BASE_URL: <url>
      ANTHROPIC_MODEL: <model-name>
    permissions:
      allow: [...]
      deny: [...]
    hooks: {...}
    modelOverride:
      <source>: <target>
    proxy:
      url: http://localhost:34567
      pid: 12345
      port: 34567
```

## 启动流程

1. 用户执行 `zcc web`
2. 检查端口占用，选择空闲端口
3. 启动 Express 服务器
4. 自动打开默认浏览器访问 `http://localhost:<port>`
5. 服务器监听文件变化，支持热重载（开发模式）

## 测试策略

1. **API 单元测试** - 测试每个 API 端点的输入输出（Jest）
   - 配置文件读写
   - 错误处理（文件不存在、权限不足等）

2. **组件单元测试** - 测试 React 组件的渲染和交互（React Testing Library）
   - 表单验证逻辑
   - 用户操作反馈

3. **端到端测试** - 使用 Playwright 测试完整用户流程
   - 启动 web 服务器
   - 完整操作流程：添加 profile → 编辑 → 删除
   - 快速操作：启动 Claude Code、应用配置

## 验收标准

- [ ] `zcc web` 命令可正常启动
- [ ] 自动打开浏览器并显示界面
- [ ] 可列出所有 profiles（本地 + 全局）
- [ ] 可添加、编辑、删除 profile
- [ ] 可编辑 base 配置
- [ ] 可查看原始 YAML
- [ ] 可导入/导出配置
- [ ] 快速操作按钮可触发对应命令
- [ ] 界面响应式，适配不同屏幕
- [ ] 操作有明确的反馈（成功/失败通知）
- [ ] 并发编辑冲突处理正确
- [ ] 配置文件外部变更后提示刷新

## 验收标准

- [ ] `zcc web` 命令可正常启动
- [ ] 自动打开浏览器并显示界面
- [ ] 可列出所有 profiles（本地 + 全局）
- [ ] 可添加、编辑、删除 profile
- [ ] 可编辑 base 配置
- [ ] 可查看原始 YAML
- [ ] 可导入/导出配置
- [ ] 快速操作按钮可触发对应命令
- [ ] 界面响应式，适配不同屏幕
- [ ] 操作有明确的反馈（成功/失败通知）

## 参考文档

- [CLAUDE.md](../CLAUDE.md) - 项目架构说明
- [README.md](../README.md) - 用户使用手册
