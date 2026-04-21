# Changelog

## [2.5.0] - 2026-04-21

### Feat

- zcc web 国际化支持，顶栏一键切换中英文，语言偏好持久化到 localStorage
- Profile 编辑器输入框添加 Autocomplete 枚举建议（环境变量 Key、权限规则、模型名称）

### Fix

- 修复 Profile 编辑器环境变量 Key 输入框无法输入的 bug（NEW_KEY && 短路逻辑导致重命名永远不生效）
- 修复 zcc web Ctrl+C 无法终止服务的问题（server.close 等待 keep-alive 连接导致卡死，添加 2s 强制退出）
- 修复 React hooks exhaustive-deps 警告（loadData/fetchContent 包裹 useCallback）

### Chore

- 添加前端 eslint + prettier + tsconfig 开发工具链

## [2.4.2] - 2026-04-15

### Perf

- 优化 zcc web 前端打包体积，从 1.1MB 降至 596KB（减少 46%）
  - 替换 `react-syntax-highlighter` 为 `prism-react-renderer`，消除全语言语法打包
  - Dialog 组件（ProfileEditor、BaseEditor、RawYamlViewer、ConfigImport、ConfigExport）改为 React.lazy 按需加载
  - Vite manualChunks 分包，分离 vendor（React/MUI）与业务代码

## [2.4.1] - 2026-04-15

### Refactor

- 将工作流独立为 SKILL

## [2.4.0] - 2026-04-14

### Refactor

- 将子命令模块异步懒加载，提高响应速度

## [2.3.1] - 2026-04-13

### Docs

- 更新 README.md，添加知识库管理命令文档

## [2.3.0] - 2026-04-13

### Feat

- 新增 knowledge 子命令管理项目知识库
  - `knowledge status` — 基于 git diff 检查各 section 时效性
  - `knowledge update` — 增量更新过期 section 文件
  - `knowledge rebuild` — 自动扫描项目目录重建知识库
  - `knowledge verify` — 验证 index.json 和 section 文件完整性
- knowledge rebuild/update 集成 AI 分析自动生成/重写知识章节

### Refactor

- 知识库拆分为多文件结构，每个 section 独立存储
- 知识库通用化，移除项目专属硬编码 section

## [2.2.0] - 2026-04-10

### Feat

- 新增 models 子命令查询可用模型
- 新增 test 子命令测试 API 连接

## [2.1.0] - 2026-04-07

### Feat

- CLI 命令从 cc 重命名为 zcc
- 新增 gh:release 发布脚本

## [2.0.5] - 2026-04-07

### Chore

- 配置 package.json 的 files 字段

## [2.0.4] - 2026-04-07

### Feat

- add/edit 交互流程新增 CLAUDE_CODE_SUBAGENT_MODEL 提示

## [2.0.3] - 2026-04-06

### Feat

- 新增 cc serve 命令 — 本地模型路由反代
- 代理服务请求日志 — 异步队列 + cc serve log 子命令
- cc \<id> 透传 claude CLI 参数
- add 命令环境变量选择器升级为 autocomplete 搜索 + 全量枚举
- cc add 环境变量选择器改为左右分页，Custom/完成常驻顶部
- cc edit 交互流程与 add 同步

### Fix

- 移除 launch 命令中的 base 合并，避免全局配置优先级过高
- parse/use 命令 --base 模式下不再强制要求 profile-id
- serve 启动后父进程自动退出
- cc edit 删除 env 改为 checkbox 选择，修复 inquirer 导入和空默认值

## [2.0.2] - 2026-04-03

### Feat

- add/edit 命令支持 --base 参数编辑 base 配置
- parse 命令支持 --base 参数将配置写入 base 节

### Fix

- 修复 launch 测试在 Windows 上的 spawn 断言

## [2.0.1] - 2026-04-03

### Feat

- 统一 profiles 架构，移除 config 子命令
- 新增 parse 命令，支持 --copy 剪贴板复制

### Fix

- 修复 spawn 使用 shell:true 时的 DEP0190 警告
- 修正 NPM 注册表地址

### Chore

- 更新包名为作用域包并配置发布设置
- 添加发布脚本
