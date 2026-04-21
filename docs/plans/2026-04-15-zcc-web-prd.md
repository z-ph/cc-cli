# zcc web 产品需求文档（PRD）

---

## 概述

**产品名称：** zcc web — Claude Code 配置管理 Web 界面

**产品定位：** 为 zcc-cli 用户提供可视化界面，用于管理 Claude Code 的配置文件（profiles、base 配置、环境变量、权限规则等）。

**目标用户：** 使用 zcc-cli 管理多个 Claude Code 配置的开发者和团队。

**技术栈：** React + Material UI + Vite

---

## 功能需求

### 1. Profile 管理

| 功能 | 说明 |
|------|------|
| 列出所有 Profile | 显示当前配置作用域下的所有 profile，展示 ID 和关键信息（env、permissions 等） |
| 添加 Profile | 通过表单交互式添加新 profile，支持 env、permissions、hooks、proxy、modelOverride 等字段 |
| 编辑 Profile | 修改已有 profile 配置 |
| 删除 Profile | 删除指定 profile，需二次确认 |

### 2. Base 配置管理

| 功能 | 说明 |
|------|------|
| 查看/编辑 Base | Base 配置包含所有 profile 共享的默认值（env、permissions 等） |
| 保存 Base | 将修改保存到配置文件 |

### 3. 配置作用域切换

| 功能 | 说明 |
|------|------|
| Local/Global 切换 | 在本地配置（`.claude/models.yaml`）和全局配置（`~/.claude/models.yaml`）之间切换 |
| 显示当前配置文件路径 | 顶部栏显示当前操作的配置文件路径和 profile 数量 |

### 4. 导入/导出

| 功能 | 说明 |
|------|------|
| 导入配置 | 从 YAML 或 JSON 文件导入配置 |
| 导出配置 | 导出当前配置为 YAML 或 JSON 格式，支持复制和下载 |
| 查看原始 YAML | 以高亮格式显示配置文件的原始 YAML 内容 |

### 5. 国际化（i18n）

| 功能 | 说明 |
|------|------|
| 中英文切换 | 通过顶部按钮切换界面语言 |
| 语言偏好持久化 | 使用 localStorage 保存用户语言选择 |
| 开发环境警告 | 开发模式下，缺失翻译时输出 console.warn |

---

## 用户界面

### 布局结构

```
┌─────────────────────────────────────────────────────┐
│  Logo + 标题                          [EN/中文] 配置路径 │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ 侧边导航  │              主内容区域                   │
│          │                                          │
│ - 作用域  │  Profile 列表 / 编辑器 / 查看器            │
│ - 操作    │                                          │
│ - 文件操作 │                                          │
│          │                                          │
│          │                              [+ FAB 按钮] │
└──────────┴──────────────────────────────────────────┘
```

### 组件清单

| 组件 | 说明 |
|------|------|
| `Layout.jsx` | 主布局：顶部 AppBar + 侧边 Drawer + 主内容区 |
| `App.jsx` | 应用根组件：状态管理、数据加载、路由逻辑 |
| `ProfileList.jsx` | Profile 列表展示 |
| `ProfileEditor.jsx` | Profile 编辑表单 |
| `BaseEditor.jsx` | Base 配置编辑器 |
| `RawYamlViewer.jsx` | 原始 YAML 查看器（语法高亮） |
| `ConfigImport.jsx` | 配置导入对话框 |
| `ConfigExport.jsx` | 配置导出对话框 |
| `LanguageContext.jsx` | 语言状态 Context |
| `api.js` | 与后端 API 通信 |
| `i18n.js` | 国际化翻译函数 |

---

## 技术架构

### 目录结构

```
src/web/
├── index.jsx              # React 入口
├── App.jsx                # 应用根组件
├── api.js                 # API 调用封装
├── i18n.js                # 国际化翻译
├── components/
│   ├── Layout.jsx
│   ├── ProfileList.jsx
│   ├── ProfileEditor.jsx
│   ├── BaseEditor.jsx
│   ├── RawYamlViewer.jsx
│   ├── ConfigImport.jsx
│   ├── ConfigExport.jsx
│   └── LanguageContext.jsx
├── public/                # 构建输出
├── .prettierrc.js         # Prettier 配置
├── eslint.config.js       # ESLint v9 flat config
└── tsconfig.json          # TypeScript 配置
```

### 质量工具配置

| 工具 | 配置 | 说明 |
|------|------|------|
| ESLint | v9.39.0 | flat config 格式，配置 react、react-hooks、typescript-eslint、prettier 插件 |
| TypeScript | v6.0.2 | 使用 `tsc -b` 增量构建，composite: true |
| Prettier | 最新版 | 统一代码格式，与 ESLint 集成 |

### 构建工具

| 工具 | 版本 | 说明 |
|------|------|------|
| Vite | v8.x | 前端打包工具，支持热更新 |
| React | v19.x | UI 框架 |
| Material UI | v6.x | UI 组件库 |

---

## 数据流

### 配置加载流程

```
App.jsx (useEffect)
   │
   ├─ fetchConfig(scope) ───→ GET /api/config?scope={scope}
   │
   └─ fetchProfiles(scope) ─→ GET /api/profiles?scope={scope}
         │
         └─ 设置 profiles 状态 → 渲染 ProfileList
```

### 配置保存流程

```
ProfileEditor / BaseEditor
   │
   └─ onSave()
        │
        └─ PUT /api/profiles/:id 或 PUT /api/base
             │
             └─ 成功 → 显示 Alert → 关闭对话框 → 重新加载数据
```

---

## 用户使用流程

### 添加新 Profile

1. 点击侧边栏「Add Profile」或右下角 FAB 按钮
2. 填写 Profile ID 和配置（env、permissions 等）
3. 点击保存
4. Profile 出现在列表中

### 编辑 Base 配置

1. 点击侧边栏「Edit Base」
2. 在对话框中修改 Base 配置
3. 点击保存
4. 显示保存成功提示

### 导出配置

1. 点击侧边栏「Export」
2. 选择格式（YAML / JSON）
3. 预览内容
4. 点击「Download」下载或「Copy」复制

### 切换语言

1. 点击顶部「EN」或「中文」按钮
2. 界面立即切换语言
3. 语言偏好保存到 localStorage
4. 下次打开时自动恢复

---

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `GET /api/config?scope={scope}` | GET | 获取配置元信息 |
| `GET /api/profiles?scope={scope}` | GET | 获取所有 profiles |
| `PUT /api/profiles/:id?scope={scope}` | PUT | 保存 profile |
| `DELETE /api/profiles/:id?scope={scope}` | DELETE | 删除 profile |
| `PUT /api/base?scope={scope}` | PUT | 保存 base 配置 |
| `GET /api/config/export?scope={scope}&format={format}` | GET | 导出配置 |
| `GET /api/config/raw?scope={scope}` | GET | 获取原始 YAML |

---

## 质量要求

### 代码质量

- ESLint：0 错误，0 警告
- TypeScript：`tsc -b` 构建通过
- Prettier：代码格式化一致

### 性能要求

- 首屏加载时间 < 2 秒
- 配置加载时间 < 1 秒
- 构建产物体积 < 600KB（gzip 后）

### 兼容性

- 浏览器：Chrome 90+、Firefox 90+、Safari 14+
- Node.js：18+

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-10 | 初始版本：Profile 管理、Base 配置、导入导出 |
| v1.1 | 2026-04-15 | 添加中英文语言切换功能、ESLint + TypeScript 配置 |

---

## 未来规划

- [ ] 批量操作（批量删除、导出）
- [ ] 配置差异对比（Diff Viewer）
- [ ] 配置模板（快速创建常用配置）
- [ ] 配置历史版本（Git 集成）
- [ ] 团队共享配置（多用户协作）
