# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cc-cli is a CLI tool for launching Claude Code with custom model configurations. It manages YAML config files that map API keys, base URLs, and model names to short config IDs, then spawns `claude` with the appropriate environment variables set.

The CLI is written in Chinese (README, user-facing messages).

## Commands

```bash
pnpm test              # Run all tests with Jest
pnpm test:watch        # Run tests in watch mode
npx jest tests/config/loader.test.js  # Run a single test file
```

No build step — this is plain Node.js (>= 18) with no transpilation.

## Architecture

**Entry point:** `bin/cc.js` — Commander.js CLI. The default action (`cc <config-id>`) runs the launch command. Five named subcommands: `list`, `add`, `remove`, `edit`, `alias`. All accept a global `-t, --target <file>` option to override the config file path.

**Command pattern:** Each command in `src/commands/` exports a single function. Commands receive positional args + an `options` object from Commander. No shared base class.

**Config layer** (`src/config/`):
- `loader.js` — YAML read/write/find with three-tier resolution: custom path > local (`./.claude/models.yaml`) > global (`~/.claude/models.yaml`). `findConfig()` checks whether the requested configId exists in a file before choosing it. `loadConfig()` auto-creates `~/.claude/` and a default config if nothing exists.
- `validator.js` — Validates model configs require `base_url`, `api_key`, `model`. Config IDs must match `/^[a-zA-Z9._-]+$/`.

**Launch command** (`src/commands/launch.js`): Spawns `claude` with env vars `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL` set from the config. Custom env vars in the config's `env` field can override these.

**Config YAML schema:**
```yaml
settings:
  alias: cc
models:
  <config-id>:
    base_url: <url>      # → ANTHROPIC_BASE_URL
    api_key: <key>       # → ANTHROPIC_AUTH_TOKEN
    model: <name>        # → ANTHROPIC_MODEL
    env:                 # 自定义环境变量透传（可选）
      KEY: value         # 这些变量会透传到 Claude Code 进程
```

**Environment variables:**
- `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL` 由配置自动设置
- `env` 字段中的自定义变量会透传到 Claude Code 进程，可用于配置 MCP servers、代理等

## Key Design Decisions

- `api_key` maps to `ANTHROPIC_AUTH_TOKEN` (not `ANTHROPIC_API_KEY`) — this was a post-launch fix.
- `add` defaults to saving in local config (`./.claude/models.yaml`), while other commands default to global.
- `add.js` and `edit.js` are excluded from Jest coverage because they are heavily interactive (inquirer prompts).
- Dependencies: `commander`, `inquirer`, `js-yaml`. Dev: `jest` only. No linter/formatter configured.
