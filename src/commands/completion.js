const path = require('path');
const os = require('os');

const { loadConfig, getLocalConfigPath } = require('../config/loader');
const fs = require('fs');

// All registered subcommands (keep in sync with bin/cc.js)
const SUBCOMMANDS = [
  'list', 'add', 'remove', 'edit', 'alias', 'use', 'restore',
  'parse', 'test', 'models', 'knowledge', 'web', 'serve',
  'help', 'completion', 'info', 'import-env'
];

// Top-level flags
const TOP_FLAGS = ['--target', '-t', '--help', '-h', '--version', '-V'];

function getProfileIds() {
  const ids = [];
  try {
    const globalPath = path.join(os.homedir(), '.claude', 'models.yaml');
    if (fs.existsSync(globalPath)) {
      const cfg = loadConfig(globalPath);
      if (cfg.profiles) Object.assign(ids, Object.keys(cfg.profiles));
    }
  } catch (_) { /* ignore */ }
  try {
    const localPath = getLocalConfigPath();
    if (fs.existsSync(localPath)) {
      const cfg = loadConfig(localPath);
      if (cfg.profiles) {
        for (const id of Object.keys(cfg.profiles)) {
          if (!ids.includes(id)) ids.push(id);
        }
      }
    }
  } catch (_) { /* ignore */ }
  return ids;
}

function bashScript() {
  return `# zcc completion for bash
# Add to ~/.bashrc or ~/.bash_profile:
#   source <(zcc completion bash)

_zcc_completion() {
  local cur prev words cword
  _init_completion -s || return

  local subcommands="${SUBCOMMANDS.join(' ')}"

  # Complete top-level profile IDs and subcommands
  if [[ $cword -eq 1 ]]; then
    # Both subcommands and profile IDs
    local profiles
    profiles=$(zcc list 2>/dev/null | grep -E '^  \\S' | sed 's/^  //' | tr '\\n' ' ')
    COMPREPLY=( $(compgen -W "$subcommands $profiles" -- "$cur") )
  elif [[ $cword -gt 1 ]]; then
    local cmd="\${words[1]}"
    case "$cmd" in
      remove|edit|test|models|info|use|launch)
        # Complete profile IDs
        local profiles
        profiles=$(zcc list 2>/dev/null | grep -E '^  \\S' | sed 's/^  //' | tr '\\n' ' ')
        COMPREPLY=( $(compgen -W "$profiles" -- "$cur") )
        ;;
      *)
        COMPREPLY=()
        ;;
    esac
  fi
}

complete -F _zcc_completion zcc
`;
}

function zshScript() {
  return `#compdef zcc

# zcc completion for zsh
# Add to ~/.zshrc:
#   source <(zcc completion zsh)

_zcc() {
  local -a subcommands
  subcommands=(${SUBCOMMANDS.join(' ')})

  local -a profiles
  profiles=(\${(f)"\$(zcc list 2>/dev/null | grep -E '^  \\\\S' | sed 's/^  //')"})

  _arguments -C \\
    '-t[specify custom config file]:file:_files' \\
    '--target[specify custom config file]:file:_files' \\
    '1: :->first' \\
    '*:: :->rest'

  case $state in
    first)
      _values 'command' \$subcommands \$profiles
      ;;
    rest)
      local cmd="\${words[2]}"
      case $cmd in
        remove|edit|test|models|info|use)
          _values 'profile' \$profiles
          ;;
        *)
          ;;
      esac
      ;;
  esac
}

_zcc "\$@"
`;
}

function completionCommand(shell) {
  if (!shell || (shell !== 'bash' && shell !== 'zsh')) {
    console.error('Usage: zcc completion <bash|zsh>');
    console.error('');
    console.error('Generate shell completion script.');
    console.error('');
    console.error('  zcc completion bash  — output bash completion script');
    console.error('  zcc completion zsh   — output zsh completion script');
    console.error('');
    console.error('Installation:');
    console.error('  bash: source <(zcc completion bash) >> ~/.bashrc');
    console.error('  zsh:  source <(zcc completion zsh) >> ~/.zshrc');
    process.exit(1);
  }

  if (shell === 'bash') {
    console.log(bashScript());
  } else if (shell === 'zsh') {
    console.log(zshScript());
  }
}

module.exports = { completionCommand };
