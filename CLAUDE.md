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

**Entry point:** `bin/cc.js` — Commander.js CLI. The default action (`cc <id>`) runs the launch command. Subcommands: `list`, `add`, `remove`, `edit`, `parse`, `alias`, `use`, `restore`, `serve`. All accept a global `-t, --target <file>` option to override the config file path.

**Command pattern:** Each command in `src/commands/` exports a single function. Commands receive positional args + an `options` object from Commander. No shared base class.

**Config layer** (`src/config/`):
- `loader.js` — YAML read/write/find with three-tier resolution: custom path > local (`./.claude/models.yaml`) > global (`~/.claude/models.yaml`). `findProfile(profileId, customConfigPath, options)` searches `profiles[id]`, with `options.mergeBase` controlling whether to merge base (default: true). `getSettingsDir()` returns the directory where `settings.<id>.json` should be written. `loadConfig()` auto-creates `~/.claude/` and a default config if nothing exists.
- `validator.js` — Validates config IDs match `/^[a-zA-Z9._-]+$/`.
- `merger.js` — `deepMerge()` with array concat+dedup semantics for merging settings.
- `env-registry.js` — Manages env var metadata for interactive picker in add. Includes `buildAutocompleteSource()` for autocomplete search with ~200 built-in Claude Code env vars.

**Launch command** (`src/commands/launch.js`): Reads `profiles[id]` from YAML via `findProfile(id, target, { mergeBase: false })` — **does not merge base** to avoid overriding global `~/.claude/settings.json`. Generates `settings.<id>.json` in the `.claude/` directory next to the `models.yaml`, spawns `claude --settings <path>`. Supports passthrough of any extra CLI arguments to `claude` via `passThroughOptions()` — e.g. `cc myprofile -c` becomes `claude -c --settings <path>`. If profile has a `proxy` field, verifies the proxy is alive via HTTP health check and generates `settings.<id>.proxy.json` with `ANTHROPIC_BASE_URL` set to the proxy URL.

**Use command** (`src/commands/use.js`): Reads `profiles[id]` from YAML via `findProfile()` (with merge base, default behavior), merges with `settings.source.json` (original backup), writes result to settings file. Supports `--base` (`-b`) to apply `config.base` directly without a profile-id.

**Parse command** (`src/commands/parse.js`): Parses a settings JSON file into a profile. `profile-id` is optional when using `--base` (`-b`). Supports `-c` for copy-to-clipboard mode.

**Serve command** (`src/commands/serve.js`): Manages local HTTP reverse proxy servers. Supports start, list, stop, stop-all, log operations. `--base` mode uses `config.base`, `--run` starts proxy then launches Claude Code. Worker stderr is redirected to the log file for crash diagnostics.

**Proxy layer** (`src/proxy/`):
- `server.js` — HTTP reverse proxy core (request interception, model replacement, forwarding, streaming response, health check endpoint, request logging via logger instance)
- `worker.js` — Background process entry point (loads config, creates logger, starts server, IPC ready notification, SIGTERM/flushSync graceful shutdown)
- `logger.js` — Async logging queue with batch file writing. Uses `setImmediate` drain loop to avoid blocking request forwarding. Supports `flush()` (async), `flushSync()` (crash path), auto-disable after consecutive write failures, queue overflow with dropped-count tracking.

**Config YAML schema:**
```yaml
settings:
  alias: cc
base:                           # optional — shared defaults for all profiles
  env:
    ANTHROPIC_AUTH_TOKEN: <key> # profile can override
  permissions:
    deny: [...]
profiles:
  <profile-id>:
    env:                        # optional
      ANTHROPIC_BASE_URL: <url>
      ANTHROPIC_MODEL: <name>
    permissions:                # optional
      allow: [...]
    hooks: {...}                # any Claude Code settings fields
    proxy: {...}                # auto-managed by cc serve
    modelOverride:              # optional model name mapping
      <source>: <target>
```

**Profile resolution:** `findProfile(id, path, { mergeBase: true })` loads both global and local configs, then cascades: `deepMerge(deepMerge(globalBase, localBase), profiles[id])`. Priority: profile > local base > global base. When profile is found globally only, only global base applies. `mergeBase: false` skips base merge (used by launch).

**Settings file handling:**
- `cc <id>` generates `settings.<id>.json` in the same `.claude/` dir as models.yaml, launches with `--settings`. Does NOT merge base (profile only).
- `cc use <id>` writes to `.claude/settings.local.json` (or `~/.claude/settings.json` with `-g`). Merges base.
- `cc use -b` writes base config directly.
- One-time backup of original file as `settings.source.json`, never overwritten
- `cc restore` restores from backup
- Merge with source on each `use`: `deepMerge(sourceSettings, profile)`

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
