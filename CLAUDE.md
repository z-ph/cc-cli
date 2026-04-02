# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cc-cli is a CLI tool for launching Claude Code with custom configurations. It manages YAML config files with two separate sections:
- **envs**: Environment variable configs (ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_MODEL, etc.) — launched via `cc <id>` with env injection
- **configs**: Claude Code settings configs (permissions, hooks, sandbox, etc.) — applied via `cc use <id>` by writing to settings files

The CLI is written in Chinese (README, user-facing messages).

## Commands

```bash
pnpm test              # Run all tests with Jest
pnpm test:watch        # Run tests in watch mode
npx jest tests/config/loader.test.js  # Run a single test file
```

No build step — this is plain Node.js (>= 18) with no transpilation.

## Architecture

**Entry point:** `bin/cc.js` — Commander.js CLI. The default action (`cc <env-id>`) runs the launch command. Subcommands: `list`, `add`, `add-config`, `remove`, `remove-config`, `edit`, `edit-config`, `alias`, `use`, `restore`. All accept a global `-t, --target <file>` option to override the config file path.

**Command pattern:** Each command in `src/commands/` exports a single function. Commands receive positional args + an `options` object from Commander. No shared base class.

**Config layer** (`src/config/`):
- `loader.js` — YAML read/write/find with three-tier resolution: custom path > local (`./.claude/models.yaml`) > global (`~/.claude/models.yaml`). `findEnvConfig()` searches `envs[id]`, `findConfigEntry()` searches `configs[id]`. `loadConfig()` auto-creates `~/.claude/` and a default config if nothing exists.
- `validator.js` — Validates config IDs match `/^[a-zA-Z9._-]+$/`.
- `merger.js` — `deepMerge()` with array concat+dedup semantics for merging settings.
- `env-registry.js` — Manages env var metadata for interactive picker in add/edit.

**Launch command** (`src/commands/launch.js`): Reads `envs[id]` from YAML, spawns `claude` with `{ ...process.env, ...envVars }` (env injection, no settings file modification).

**Use command** (`src/commands/use.js`): Reads `configs[id]` from YAML, merges with `settings.source.json` (original backup), writes result to settings file.

**Config YAML schema:**
```yaml
settings:
  alias: cc
envs:
  <env-id>:
    ANTHROPIC_BASE_URL: <url>
    ANTHROPIC_AUTH_TOKEN: <key>
    ANTHROPIC_MODEL: <name>
    OTHER_VAR: value       # any env var
configs:
  <config-id>:
    permissions:
      allow: [...]
      deny: [...]
    hooks: {...}
    # any Claude Code settings fields (no env)
```

**Settings file handling:**
- `cc use <id>` writes to `.claude/settings.local.json` (or `~/.claude/settings.json` with `-g`)
- One-time backup of original file as `settings.source.json`, never overwritten
- `cc restore` restores from backup
- Merge with source on each `use`: `deepMerge(sourceSettings, configEntry)`

## Key Design Decisions

- No field mapping — env vars stored with their real names (ANTHROPIC_MODEL, not "model")
- `add` defaults to saving in local config (`./.claude/models.yaml`), while other commands default to global
- `add.js` and `edit.js` are excluded from Jest coverage because they are heavily interactive (inquirer prompts)
- envs and configs are separate: envs for env injection launch, configs for settings file write
- Dependencies: `commander`, `inquirer`, `js-yaml`. Dev: `jest` only. No linter/formatter configured.
