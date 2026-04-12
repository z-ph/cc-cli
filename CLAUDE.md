# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cc-cli is a CLI tool for launching Claude Code with custom configurations. It manages YAML config files with a unified `profiles` section that can contain both environment variables and Claude Code settings.

The CLI is written in Chinese (README, user-facing messages).

## Commands

```bash
pnpm test              # Run all tests with Jest
pnpm test:watch        # Run tests in watch mode
npx jest tests/config/loader.test.js  # Run a single test file
```

No build step — this is plain Node.js (>= 18) with no transpilation.

## Architecture

**Entry point:** `bin/cc.js` — Commander.js CLI. Subcommands: `list`, `add`, `remove`, `edit`, `parse`, `alias`, `use`, `restore`, `serve`, `knowledge`. All accept a global `-t, --target <file>` option. Each command in `src/commands/` exports a single function.

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

- **任何需求（新功能、改动、修复）都必须先在 `PRD/` 目录下编写 PRD 文档**，描述背景、目标、方案，经确认后再动手写代码。
- **PRD 完成后必须启动 review agent 进行审查**：使用 `code-review` skill 对 PRD 进行独立审查，确保方案合理、边界清晰、测试覆盖充分。审查通过后方可进入开发阶段。
- **开发任务使用 git worktree 隔离环境**：每个开发任务（功能、修复、重构）应在独立 worktree 中进行，避免污染主分支的工作区。
  - **创建位置**：worktree 统一创建在项目根目录下的 `.claude/worktrees/` 中（由 `EnterWorktree` 自动管理），不要手动在其他位置创建
  - **分支命名**：`EnterWorktree` 自动生成随机名称，无需手动指定
  - **开发流程**：创建 worktree → 在其中完成开发和测试 → 提交代码
  - **合并与清理**：任务完成后，必须先将 worktree 中的改动合并回主分支（创建 PR 或手动 merge），**合并完成后必须删除 worktree**。使用 `ExitWorktree` 并选择 `action: "remove"` + `discard_changes: false`（有未合并改动时工具会拒绝删除，确保不会误删）
- **严格遵循 TDD（测试驱动开发）**：先写测试，再写实现。每个功能点/修复的流程为：
  1. 编写失败的测试用例，运行 `pnpm test` 确认测试失败
  2. 编写最少的代码使测试通过，再次运行 `pnpm test` 确认通过
  3. 在此框架下逐步完善实现，保证每步都通过
  4. 所有变更完成后，运行全量 `pnpm test` 确保无回归
- **开发完成后必须同步更新文档**：检查并更新 `CLAUDE.md`、`example.yaml`、`README.md`，确保文档与代码实际行为一致。功能新增需在 README 中补充用法说明，配置变更需同步 example.yaml 中的示例。

## Key Design Decisions

- No field mapping — env vars stored with their real names under `env` sub-object
- `add` defaults to saving in local config (`./.claude/models.yaml`), while other commands default to global
- `add.js` and `edit.js` are excluded from Jest coverage because they are heavily interactive (inquirer prompts)
- Unified profiles replace former separate envs/configs — single source of truth for each configuration
- Launch does NOT merge base — to avoid overriding global `~/.claude/settings.json` that Claude Code auto-loads
- `--base` / `-b` parameter allows editing/applying/importing base config across add, edit, use, parse commands
- Dependencies: `commander`, `inquirer`, `inquirer-autocomplete-prompt`, `js-yaml`. Dev: `jest` only. No linter/formatter configured.
