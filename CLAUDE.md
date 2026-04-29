# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cc-cli is a CLI tool for launching Claude Code with custom configurations. It manages YAML config files with a unified `profiles` section that can contain both environment variables and Claude Code settings.

The CLI is written in Chinese (README, user-facing messages).

## Commands

```bash
pnpm test              # Run all tests with Jest
pnpm test:watch        # Run tests in watch mode
pnpm web:build         # Build React frontend for zcc web
pnpm web:dev           # Run Vite dev server for frontend development
npx jest tests/config/loader.test.js  # Run a single test file
```

**注意：** `zcc web` 命令需要先执行 `pnpm web:build` 构建前端。

## Architecture

**Entry point:** `bin/cc.js` — Commander.js CLI. Subcommands: `list`, `add`, `remove`, `edit`, `parse`, `alias`, `use`, `restore`, `serve`, `knowledge`, `web`. All accept a global `-t, --target <file>` option. Each command in `src/commands/` exports a single function.

**Frontend:** `src/web/` — React + Material UI application, built with Vite. Output to `src/web/public/`.

**Config YAML schema:**
```yaml
settings:
  alias: zcc
base:                           # optional — shared defaults for all profiles
  env:
    ANTHROPIC_AUTH_TOKEN: <key>
  permissions:
    deny: [...]
profiles:
  <profile-id>:
    env:                        # optional
    permissions:                # optional
    hooks: {...}
    proxy: {...}                # auto-managed by zcc serve
    modelOverride:
      <source>: <target>
```

## Knowledge Base

项目知识库位于 `.knowledge/`，通过 `zcc knowledge` 管理。`rebuild` 自动扫描项目目录结构发现 sections（src/ 子目录 + 其他顶层目录），每个 section 独立存储为 `sections/<key>.md`。

```
.knowledge/
  index.json          # version 2, sections: { key: { commit, paths } }
  sections/
    bin.md
    config.md
    commands.md
    ...
```

**开始任何开发任务前，执行 `zcc knowledge status`。如果有 stale sections，执行 `zcc knowledge update`。**

- `zcc knowledge status` — 基于 git diff --numstat 检查各 section 时效性
- `zcc knowledge update [--profile <id>]` — 增量更新过期 section 文件（--profile 启用 AI 分析）
- `zcc knowledge verify` — 验证 index.json 和 section 文件完整性
- `zcc knowledge rebuild [--profile <id>]` — 自动扫描项目目录，重建知识库（--profile 启用 AI 填充）

## Workflow Rules

开发工作流已提取为独立 skill（`.claude/skills/zcc-dev-workflow/SKILL.md`），包括 PRD 编写、审查、worktree 隔离、TDD、文档同步的完整流程。标准任务（新功能、跨文件修改、行为变更）自动触发该 skill；简单任务（单文件修复、配置调整）无需走完整流程。

**PRD 是需求的唯一入口**：`PRD/` 目录下的文档是所有需求的唯一权威来源。无论是新增功能、修复 bug、删除功能还是调整行为，都必须在 `PRD/` 中创建或更新文档以留下记录，确保需求变更可追溯。不允许绕过 PRD 直接实施需求。

## Key Design Decisions

- No field mapping — env vars stored with their real names under `env` sub-object
- `add` defaults to saving in local config (`./.claude/models.yaml`), while other commands default to global
- `add.js` and `edit.js` are excluded from Jest coverage because they are heavily interactive (inquirer prompts)
- Unified profiles replace former separate envs/configs — single source of truth for each configuration
- Launch does NOT merge base — to avoid overriding global `~/.claude/settings.json` that Claude Code auto-loads
- `--base` / `-b` parameter allows editing/applying/importing base config across add, edit, use, parse commands
- Dependencies: `commander`, `inquirer`, `inquirer-autocomplete-prompt`, `js-yaml`. Dev: `jest` only. No linter/formatter configured.
