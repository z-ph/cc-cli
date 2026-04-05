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

**Entry point:** `bin/cc.js` — Commander.js CLI. The default action (`cc <id>`) runs the launch command. Subcommands: `list`, `add`, `remove`, `edit`, `parse`, `alias`, `use`, `restore`. All accept a global `-t, --target <file>` option to override the config file path.

**Command pattern:** Each command in `src/commands/` exports a single function. Commands receive positional args + an `options` object from Commander. No shared base class.

**Config layer** (`src/config/`):
- `loader.js` — YAML read/write/find with three-tier resolution: custom path > local (`./.claude/models.yaml`) > global (`~/.claude/models.yaml`). `findProfile()` searches `profiles[id]`. `getSettingsDir()` returns the directory where `settings.<id>.json` should be written. `loadConfig()` auto-creates `~/.claude/` and a default config if nothing exists.
- `validator.js` — Validates config IDs match `/^[a-zA-Z9._-]+$/`.
- `merger.js` — `deepMerge()` with array concat+dedup semantics for merging settings.
- `env-registry.js` — Manages env var metadata for interactive picker in add.

**Launch command** (`src/commands/launch.js`): Reads `profiles[id]` from YAML, generates `settings.<id>.json` in the `.claude/` directory next to the `models.yaml`, spawns `claude --settings <path>`.

**Use command** (`src/commands/use.js`): Reads `profiles[id]` from YAML via `findProfile()`, merges with `settings.source.json` (original backup), writes result to settings file.

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
```

**Profile resolution:** `findProfile()` loads both global and local configs, then cascades: `deepMerge(deepMerge(globalBase, localBase), profiles[id])`. Priority: profile > local base > global base. When profile is found globally only, only global base applies.

**Settings file handling:**
- `cc <id>` generates `settings.<id>.json` in the same `.claude/` dir as models.yaml, launches with `--settings`
- `cc use <id>` writes to `.claude/settings.local.json` (or `~/.claude/settings.json` with `-g`)
- One-time backup of original file as `settings.source.json`, never overwritten
- `cc restore` restores from backup
- Merge with source on each `use`: `deepMerge(sourceSettings, profile)`

## Workflow Rules

- **任何需求（新功能、改动、修复）都必须先在 `PRD/` 目录下编写 PRD 文档**，描述背景、目标、方案，经确认后再动手写代码。
- **严格遵循 TDD（测试驱动开发）**：先写测试，再写实现。每个功能点/修复的流程为：
  1. 编写失败的测试用例，运行 `pnpm test` 确认测试失败
  2. 编写最少的代码使测试通过，再次运行 `pnpm test` 确认通过
  3. 在此框架下逐步完善实现，保证每步都通过
  4. 所有变更完成后，运行全量 `pnpm test` 确保无回归

## Key Design Decisions

- No field mapping — env vars stored with their real names under `env` sub-object
- `add` defaults to saving in local config (`./.claude/models.yaml`), while other commands default to global
- `add.js` and `edit.js` are excluded from Jest coverage because they are heavily interactive (inquirer prompts)
- Unified profiles replace former separate envs/configs — single source of truth for each configuration
- Dependencies: `commander`, `inquirer`, `js-yaml`. Dev: `jest` only. No linter/formatter configured.
