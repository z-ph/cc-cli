# Changelog

## [2.4.2] - 2025-04-15

### Perf

- 优化 zcc web 前端打包体积，从 1.1MB 降至 596KB（减少 46%）
  - 替换 `react-syntax-highlighter` 为 `prism-react-renderer`，消除全语言语法打包
  - Dialog 组件（ProfileEditor、BaseEditor、RawYamlViewer、ConfigImport、ConfigExport）改为 React.lazy 按需加载
  - Vite manualChunks 分包，分离 vendor（React/MUI）与业务代码

## [2.4.1] - 2025-04-15

### Refactor

- 将工作流独立为 SKILL

## [2.4.0] - 2025-04-14

### Refactor

- 将子命令模块异步懒加载，提高响应速度
