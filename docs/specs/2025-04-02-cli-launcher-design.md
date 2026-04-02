# Claude Code Launcher CLI - Design Spec

**Date:** 2025-04-02

## Overview

A Node.js CLI tool that enables quick launching of Claude Code with different configurations (baseurl, apikey, model, and custom environment variables).

## Core Commands

| Command | Description |
|---------|-------------|
| `cc <config-id>` | Launch Claude Code with specified configuration |
| `cc list` | List all configured models with their settings |
| `cc add <config-id>` | Interactive wizard to add a new configuration |
| `cc remove <config-id>` | Remove a configuration |
| `cc edit <config-id>` | Interactive editor for existing configuration |
| `cc alias <name>` | Change the CLI command alias (e.g., `cl`, `ccl`) |

## Configuration Format

**File Location:** `~/.claude/models.yaml`

```yaml
# CLI settings
settings:
  alias: cc  # Command alias, customizable to avoid conflicts

# Model configurations
models:
  glm5.1:
    baseurl: https://api.example.com/v1
    apikey: sk-xxx
    model: glm-5.1
    env:
      # All environment variables are passed to Claude Code process
      ANTHROPIC_BASE_URL: https://api.example.com/v1
      ANTHROPIC_API_KEY: sk-xxx
      ANTHROPIC_MODEL: claude-3-5-sonnet-20241022
      CUSTOM_VAR: value
```

### Configuration Schema

Each model configuration supports:
- `baseurl`: API base URL
- `apikey`: API key for authentication
- `model`: Model identifier
- `env`: Free-form object containing any environment variables to pass to Claude Code

## Architecture

### Components

```
cli/
├── bin/
│   └── cc.js              # Entry point, command routing
├── src/
│   ├── commands/
│   │   ├── launch.js      # cc <config-id> - spawn Claude Code
│   │   ├── list.js        # cc list - display configs
│   │   ├── add.js         # cc add - interactive wizard
│   │   ├── remove.js      # cc remove - delete config
│   │   ├── edit.js        # cc edit - modify config
│   │   └── alias.js       # cc alias - change command name
│   ├── config/
│   │   ├── loader.js      # YAML read/write operations
│   │   └── validator.js   # Config validation
│   └── utils/
│       ├── path.js        # PATH management utilities
│       └── env.js         # Environment variable handling
└── package.json
```

### Data Flow

1. User runs `cc <config-id>`
2. CLI loads `~/.claude/models.yaml`
3. Validates config exists and is valid
4. Constructs environment variables:
   - `baseurl`, `apikey`, `model` mapped to standard Claude Code env vars
   - All `env` entries merged (user can override defaults)
5. Spawns `claude` process with injected environment
6. Forwards stdio and waits for completion

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Config not found | Clear error message + `cc list` suggestion |
| Missing required fields | Validation error with missing field names |
| Invalid YAML | Parse error with line number |
| Claude Code not installed | Error + installation instructions |
| API connection fails | Pass through to Claude Code's own error handling |

## Implementation Details

### Environment Variable Mapping

Default mapping for common fields:
- `baseurl` → `ANTHROPIC_BASE_URL`
- `apikey` → `ANTHROPIC_API_KEY`
- `model` → `ANTHROPIC_MODEL`

User's `env` object can override these defaults.

### Interactive Commands

Use `inquirer` package for:
- `add`: Prompt for baseurl, apikey, model, optional env vars
- `edit`: Show current values, allow modification field by field
- `alias`: Confirm before changing

### PATH Installation

On first run or `cc install`:
- Check if binary is in PATH
- If not, offer to add symlink in common locations
- Windows: Add to PATH via registry or suggest manual steps
- macOS/Linux: Symlink to `~/.local/bin` or `/usr/local/bin`

## Dependencies

- `js-yaml`: YAML parsing and serialization
- `inquirer`: Interactive CLI prompts
- `commander`: CLI argument parsing
- `chalk`: Terminal colors (optional)

## Testing Strategy

- Unit tests for config loader/validator
- Integration tests for command routing
- Manual testing on Windows, macOS, Linux

## Success Criteria

- [ ] `cc glm5.1` launches Claude Code with specified config
- [ ] All management commands work as specified
- [ ] Custom environment variables are properly passed through
- [ ] Configurable alias works correctly
- [ ] Installation to PATH is straightforward
